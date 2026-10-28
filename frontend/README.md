# DelayFlow Frontend

延时任务调度控制台（React + TypeScript + Vite）。

## 功能

- 概览：状态计数 + 最近任务
- 任务列表：状态筛选 / 搜索
- 创建任务：延时一次 / 周期 cron
- 任务详情：元数据、Payload、执行日志、取消 / 重试

当前 `src/api/tasks.ts` 使用内存 Mock。后端就绪后把 `USE_MOCK` 改为 `false`，请求会走 `/api`（开发代理到 `localhost:8080`）。

## 启动

```bash
npm install
npm run dev
```

## 约定 API（供后端对齐）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/stats` | 各状态计数 |
| GET | `/api/tasks?status=&q=` | 任务列表 |
| GET | `/api/tasks/:id` | 任务详情 |
| GET | `/api/tasks/:id/logs` | 执行日志 |
| POST | `/api/tasks` | 创建任务 |
| POST | `/api/tasks/:id/cancel` | 取消 |
| POST | `/api/tasks/:id/retry` | 失败/死信重试 |
