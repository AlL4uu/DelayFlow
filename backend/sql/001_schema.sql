-- 初始化脚本必须先声明客户端编码，否则中文 COMMENT/数据会按 latin1 误读入库
SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;

CREATE DATABASE IF NOT EXISTS delayflow
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE delayflow;

-- 任务主表
CREATE TABLE IF NOT EXISTS tasks (
  id                    VARCHAR(64)  NOT NULL COMMENT '任务 ID',
  name                  VARCHAR(128) NOT NULL COMMENT '任务名称',
  biz_key               VARCHAR(191) NOT NULL COMMENT '业务幂等键',
  type                  VARCHAR(16)  NOT NULL COMMENT 'delay | cron',
  status                VARCHAR(16)  NOT NULL DEFAULT 'pending' COMMENT 'pending|ready|running|success|failed|cancelled|dead',
  execute_at            DATETIME(3)  NOT NULL COMMENT '计划执行时间',
  cron_expr             VARCHAR(64)  NULL     COMMENT 'cron 表达式，仅 type=cron',
  callback_url          VARCHAR(512) NOT NULL COMMENT '回调 URL',
  payload               JSON         NOT NULL COMMENT '回调请求体',
  max_retries           INT UNSIGNED NOT NULL DEFAULT 3 COMMENT '最大重试次数',
  retry_count           INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '已重试次数',
  last_error            VARCHAR(1024) NULL    COMMENT '最近一次错误',
  callback_latency_ms   INT UNSIGNED NULL     COMMENT '最近一次回调耗时(ms)',
  created_at            DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at            DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                        ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_biz_key (biz_key),
  KEY idx_status_execute_at (status, execute_at),
  KEY idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='延时/周期任务';

-- 执行日志表
CREATE TABLE IF NOT EXISTS task_execution_logs (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  task_id     VARCHAR(64)     NOT NULL COMMENT '关联 tasks.id',
  attempt     INT UNSIGNED    NOT NULL COMMENT '第几次尝试，从 1 起',
  status      VARCHAR(16)     NOT NULL COMMENT 'success | failed',
  http_code   INT UNSIGNED    NULL     COMMENT '回调 HTTP 状态码',
  latency_ms  INT UNSIGNED    NULL     COMMENT '回调耗时(ms)',
  error       VARCHAR(1024)   NULL     COMMENT '失败原因',
  created_at  DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  
  PRIMARY KEY (id),
  KEY idx_task_id_created (task_id, created_at),
  CONSTRAINT fk_logs_task
    FOREIGN KEY (task_id) REFERENCES tasks (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='任务执行日志';
