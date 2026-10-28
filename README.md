# DelayFlow

分布式延时 / 周期任务调度与执行引擎。

## 这是干什么的？

一句话：**让业务说「过一会儿再做这件事」或「每隔一段时间做这件事」，由 DelayFlow 负责准时触发，并回调对方的接口。**

业务系统自己用 `time.Sleep`、本地定时器或轮询数据库也能「延时」，但会有这些问题：

- 服务一重启，内存里的定时任务就丢了
- 多实例部署时，不知道该谁执行，容易重复或漏执行
- 高并发下用数据库轮询「到期任务」会把库打爆
- 回调失败后谁来重试、重试几次、失败进死信，没有统一方案

DelayFlow 就是把这类能力抽成**通用中间件**：上游只负责「注册任务」，调度与执行交给平台。

### 生活化例子

| 业务场景 | 注册的任务 |
|----------|------------|
| 下单未支付 | 15 分钟后检查订单，未支付则自动取消 |
| 直播预约 | 开播前 10 分钟给用户发提醒 |
| 财务对账 | 每天凌晨 2 点跑一次日终对账 |
| 优惠券 | 到期当天清理或通知 |

上游调用 API 注册一条任务，例如：

> 「在 `2026-10-27 10:30:00` 请求 `http://order-svc/cancel`，带上 `{ orderId: 10086 }`」

DelayFlow 保证到点后去调这个回调地址；失败会按策略重试，耗尽后进入死信，可在控制台查看与人工重试。

### 核心承诺

- **准时**：到点触发（允许少量调度延迟，工程上可量化）
- **至少一次（At-least-once）**：网络抖动或宕机时可能重复回调，所以业务回调必须**幂等**（同一业务键处理多次结果一样）
- **可观测**：任务状态、重试次数、回调耗时、失败原因可查

### 和「消息队列延迟消息」的关系

Kafka / RocketMQ 等也能做延时消息，但 DelayFlow 更像**任务中心**：带元数据落库、控制台、取消/重试/对账、周期任务（cron），面向「业务定时动作」而不是纯消息管道。

---

## 技术栈与落地顺序

| 阶段 | 技术 | 目标 |
|------|------|------|
| **P1** | **Gin + GORM + MySQL** | API CRUD + 单机扫表调度，跑通「注册 → 到期 → 回调 → 日志」 |
| **P2** | **Redis** | ZSET 延时队列 + Lua 原子拉取，热点不再靠狂扫 MySQL |
| **P3** | **Kafka** | 到期任务投递与 Worker 解耦；重试队列 / DLQ |
| **P4** | **Docker Compose** | 一键拉起 MySQL / Redis / Kafka + 服务 |
| **P5** | **K8s** | Deployment / 探针 / 扩缩容 / 调度器 HA |

最终形态：

```
业务服务 ──注册任务──▶ API (Gin)
                         │
                         ├─ MySQL：任务元数据、状态、执行日志
                         ├─ Redis ZSET：按执行时间排队（延时队列）
                         ├─ 调度器：到期任务捞出，投递 Kafka
                         └─ Worker：消费 Kafka，HTTP 回调业务
                                      │
                                      ├─ 成功 → 标记 success
                                      └─ 失败 → 重试 / 死信 DLQ
```

### P1 说明（先做这个）

栈：**Gin + GORM + MySQL**。不只是死 CRUD，要带一个**最小闭环调度**：

- 接口对齐前端：`/api/stats`、`/api/tasks`、详情 / 日志、创建、取消、重试
- 表：任务表 + 执行日志表；`biz_key` 唯一做幂等
- 进程内 ticker：定时查 `status=pending AND execute_at <= now`，HTTP 回调，写日志与状态
- 分层：`web(handler) → service → repository`（GORM）

P1 单机扫表即可，性能问题留给 P2 Redis。

---

## 后端实现步骤（P1 细拆）

约定顺序：**先契约与环境，再配置与入口，再连库与 CRUD，最后最小调度闭环。**

写代码时 **自底向上**（与运行时依赖相反）：

```text
运行时：  web → service → repository → model
手写时：  model → repository → service → web → platform 组装 → scheduler
```

### 实现过程总览（手写顺序）

```text
1 环境契约
   sql/001_schema.sql、002_seed.sql
   → docker-compose.yaml
   → etc/config.yaml

2 启动骨架
   config/config.go（Init / DSN）
   → platform/db.go（NewDB）
   → cmd/main.go + platform/server.go（后补全装配）

3 领域与持久化
   model/enums → model/task.go、task_execution_log.go
   → repository/task.go（CRUD，后补 ListDue / ClaimRunning）
   → repository/task_log.go（Create / ListByTaskID）

4 业务与 HTTP
   service/task.go（CRUD / Cancel / Retry / Stats）
   → service/task_log.go（ListLogs）
   → service/executor.go（ProcessDue）
   → web（types / request / response / task.go / task_log.go）

5 调度闭环与组装
   scheduler/scheduler.go（Start）
   → platform/server.go 注入 repo/service/handler + Start 调度
   → cmd/main.go 停机时 stop()
```

---

### 手写复现顺序（文件 → 关键符号）

按序号写；每步写完应能 `go build`（或该包可编译）。括号内为**先写谁**。

#### 阶段 A：环境（无 Go 业务）

| 序 | 文件 | 写什么 |
|----|------|--------|
| A1 | `sql/001_schema.sql` | 表 `tasks`、`task_execution_logs`；索引 `uk_biz_key`、`idx_status_execute_at` |
| A2 | `sql/002_seed.sql` | 几条样例任务 + 日志 |
| A3 | `docker-compose.yaml` + `mysql/conf.d` | 只起 MySQL，挂载 sql init，utf8mb4 |
| A4 | `etc/config.yaml` | `server.port`、`mysql.*`（与 compose 账号一致，**平级**） |

#### 阶段 B：配置与进程入口

| 序 | 文件 | 关键函数 / 类型 |
|----|------|----------------|
| B1 | `internal/config/config.go` | `Config`、`Init`、`Mysql.DSN`、`setDefaults` |
| B2 | `internal/platform/db.go` | `NewDB`（GORM 打开 + Ping） |
| B3 | `cmd/main.go` | 先能起 HTTP + 优雅停机（可暂写死端口） |
| B4 | `internal/platform/server.go` | `NewServer`：读配置 → 连库 → 路由 → 返回 `*http.Server`（调度后补） |

#### 阶段 C：Model（对齐 SQL / 前端类型）

| 序 | 文件 | 关键符号 |
|----|------|----------|
| C1 | `internal/model/enums/task_enums.go` | `TaskType`、`TaskStatus` 常量 |
| C2 | `internal/model/task.go` | `Task` 结构体（**无 json tag**）、`TableName` |
| C3 | `internal/model/task_execution_log.go` | `TaskExecutionLog` |

#### 阶段 D：Repository（只谈 DB，不谈 HTTP）

| 序 | 文件 | 关键符号（建议实现顺序） |
|----|------|--------------------------|
| D1 | `repository/task.go` | `TaskRepository` 接口 → `NewTaskRepository` → `Create` / `GetByID` / `GetByBizKey` / `List` / `Update`（Select+Updates）/ `UpdateMap` / `Delete` / `CountByStatus` |
| D2 | 同上（调度用，可 CRUD 通后再加） | `ListDue`、`ClaimRunning` |
| D3 | `repository/task_log.go` | `TaskLogRepository` → `NewTaskLogRepository` → `Create`、`ListByTaskID` |

说明：`List`（管理端列表）与 `ListDue`（到期扫描）条件不同，**不要合并成一个**。

#### 阶段 E：Service（业务规则；DTO 无 json tag）

| 序 | 文件 | 关键符号 |
|----|------|----------|
| E1 | `service/task.go` | `CreateInput` / `UpdateInput` / `ListQuery` / `Stats`；`TaskService` 接口；`NewTaskService`；`Create` `List` `Get` `Update` `Cancel` `Retry` `Delete` `Stats`；哨兵错误 |
| E2 | `service/task_log.go` | `ListLogs`（先确认任务存在；**挂在 TaskService 上**，不单独 New） |
| E3 | `service/executor.go` | `ProcessDue` → `executeClaimed` → `doCallback` → `finishSuccess` / `finishFailure`（**实现见本文件**，接口声明在 task.go） |

调度主路径（心里记住即可）：

```text
ListDue → ClaimRunning(pending→running) → POST callback
  成功 → 写 log + status=success
  失败 → 写 log + retry_count++；未超限则回 pending 并推迟 execute_at；否则 dead
```

#### 阶段 F：Web（HTTP 协议；有 json / binding）

| 序 | 文件 | 关键符号 |
|----|------|----------|
| F1 | `web/types.go` | `RegisterRouter`、`RegisterHandlers` |
| F2 | `web/request.go` | `createTaskReq`、`updateTaskReq` |
| F3 | `web/response.go` | `taskResp` / `taskLogResp` / `statsResp`、`to*`、`writeError` |
| F4 | `web/task.go` | `NewTaskHandler`、`Register`、`List` `Create` `Get` `Update` `Delete` `Cancel` `Retry` `Stats` |
| F5 | `web/task_log.go` | `ListLogs`（挂在 TaskHandler；路由 `GET /:id/logs`） |

handler 只做：绑参 → 填 `service.*Input` → 调 service → 返回 VO。

#### 阶段 G：调度器与装配

| 序 | 文件 | 关键符号 |
|----|------|----------|
| G1 | `scheduler/scheduler.go` | `Start(ctx, svc)`：ticker 调 `svc.ProcessDue`（可无 New，无状态） |
| G2 | `platform/server.go` | 注入：`NewTaskRepository` + `NewTaskLogRepository` → `NewTaskService` → `NewTaskHandler`；`RegisterHandlers`；`scheduler.Start`；返回 `stop` 取消调度 |
| G3 | `cmd/main.go` | `NewServer()` → Listen；信号到达先 `stop()` 再 `Shutdown` |

#### 阶段 H：联调前端（可选）

| 序 | 做什么 |
|----|--------|
| H1 | `frontend/src/api/tasks.ts`：`USE_MOCK = false` |
| H2 | 建短延时任务，callback 指向可通 URL（如 httpbin）；到点变 success 且详情有 logs |

---

### 运行时调用链（读代码时顺着跳）

**HTTP CRUD 一例（创建）：**

```text
web.TaskHandler.Create
  → service.TaskService.Create
    → repository.TaskRepository.Create
```

**调度一例（到期执行）：**

```text
scheduler.Start 每 tick
  → service.ProcessDue          (executor.go)
    → repo.ListDue
    → repo.ClaimRunning
    → doCallback (HTTP POST)
    → logRepo.Create + repo.UpdateMap
```

**分文件怎么找实现（减少瞎跳）：**

| 想看… | 打开 |
|--------|------|
| 接口 + CRUD 业务 | `service/task.go` |
| 到期执行 / 回调 | `service/executor.go` |
| 任务日志只读 | `service/task_log.go` / `web/task_log.go` |
| 路由注册入口 | `web/task.go` → `Register` |
| 进程组装 | `platform/server.go` |

---

### P1 接口清单（对齐前端，前缀 `/api/v1`）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/stats` | 各状态计数 |
| GET | `/api/v1/tasks` | 列表（`status`、`q`） |
| GET | `/api/v1/tasks/:id` | 详情 |
| GET | `/api/v1/tasks/:id/logs` | 执行日志 |
| POST | `/api/v1/tasks` | 创建 |
| PUT | `/api/v1/tasks/:id` | 编辑 |
| DELETE | `/api/v1/tasks/:id` | 删除 |
| POST | `/api/v1/tasks/:id/cancel` | 取消 |
| POST | `/api/v1/tasks/:id/retry` | 失败/死信重试（复活同一条） |
| GET | `/health` | 探活 |

前端：`frontend/src/api/tasks.ts` 里把 `USE_MOCK` 改为 `false`，Vite 代理已指向 `localhost:8080`。

### 建议目录（P1 现状）

```text
backend/
  cmd/main.go
  etc/config.yaml
  sql/
  mysql/conf.d/
  docker-compose.yaml
  internal/
    config/
    model/
      enums/task_enums.go
      task.go
      task_execution_log.go
    repository/
      task.go
      task_log.go
    service/
      task.go          # 接口 + CRUD
      task_log.go      # ListLogs
      executor.go      # ProcessDue
    web/
      types.go
      request.go
      response.go
      task.go
      task_log.go
    scheduler/
      scheduler.go
    platform/
      db.go
      server.go
```

### 当前进度（随做随改）

- [x] 1～2 SQL + docker-compose  
- [x] 3～4 config  
- [x] 5～7 main / platform / GORM  
- [x] 8 model + enums  
- [x] 9 repository → service → web（含 logs、stats）  
- [x] 10 扫表回调闭环（scheduler + executor）  
- [x] 前端 `USE_MOCK=false` 联调（创建默认回调 `http://127.0.0.1:8080/demo`）  
- [ ] 失败指数退避（当前失败后固定延迟再试）  

---

## 目录

- `frontend/` — 控制台（React + TypeScript），可用 Mock 独立跑通  
- `backend/sql/` — 建表与种子数据  
- `backend/` — Gin + GORM 应用（按上表步骤推进）  

```bash
cd backend
docker compose up -d
# 验证
docker compose exec mysql mysql -uroot -proot --default-character-set=utf8mb4 -e "USE delayflow; SHOW TABLES;"
```

Compose 命令细节见 [`../05_docker/实战篇/02_DelayFlow_Compose命令速查.md`](../05_docker/实战篇/02_DelayFlow_Compose命令速查.md)。

## 前端

```bash
cd frontend
npm install
npm run dev
```

控制台可：概览、任务列表、创建、详情、取消/重试。后端 CRUD 就绪后关闭 Mock。

## 后端本地跑（P1）

```bash
cd backend
# 确保 MySQL 已 up
go run ./cmd
```

默认 DSN 形态（与 `etc/config.yaml` 一致即可）：

`df:abcd1234@tcp(127.0.0.1:3306)/delayflow?charset=utf8mb4&parseTime=True&loc=Local`
