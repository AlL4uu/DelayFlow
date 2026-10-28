SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;

USE delayflow;

INSERT INTO tasks (
  id, name, biz_key, type, status, execute_at, cron_expr,
  callback_url, payload, max_retries, retry_count,
  last_error, callback_latency_ms
) VALUES
(
  'tsk_01hxyz001',
  '订单超时取消',
  'order:pay_timeout:10086',
  'delay',
  'pending',
  DATE_ADD(NOW(3), INTERVAL 15 MINUTE),
  NULL,
  'http://order-svc/internal/cancel',
  JSON_OBJECT('orderId', '10086'),
  3, 0, NULL, NULL
),
(
  'tsk_01hxyz002',
  '预约开播提醒',
  'live:remind:42',
  'delay',
  'success',
  DATE_SUB(NOW(3), INTERVAL 5 MINUTE),
  NULL,
  'http://notify-svc/push',
  JSON_OBJECT('userId', 'u_42', 'liveId', '42'),
  3, 0, NULL, 48
),
(
  'tsk_01hxyz003',
  '日终对账',
  'recon:daily',
  'cron',
  'failed',
  DATE_SUB(NOW(3), INTERVAL 2 MINUTE),
  '0 0 2 * * *',
  'http://billing-svc/recon/daily',
  JSON_OBJECT('date', '2026-10-26'),
  3, 2, 'callback timeout after 3000ms', NULL
),
(
  'tsk_01hxyz004',
  '优惠券过期清理',
  'coupon:expire:batch',
  'delay',
  'dead',
  DATE_SUB(NOW(3), INTERVAL 1 HOUR),
  NULL,
  'http://marketing-svc/coupon/expire',
  JSON_OBJECT('batchId', 'b_9'),
  3, 3, 'HTTP 500: internal error', NULL
);

INSERT INTO task_execution_logs (task_id, attempt, status, http_code, latency_ms, error, created_at)
VALUES
('tsk_01hxyz002', 1, 'success', 200, 48, NULL, DATE_SUB(NOW(3), INTERVAL 5 MINUTE)),
('tsk_01hxyz003', 1, 'failed', NULL, 3001, 'callback timeout after 3000ms', DATE_SUB(NOW(3), INTERVAL 10 MINUTE)),
('tsk_01hxyz003', 2, 'failed', NULL, 3002, 'callback timeout after 3000ms', DATE_SUB(NOW(3), INTERVAL 2 MINUTE)),
('tsk_01hxyz004', 1, 'failed', 500, 120, 'HTTP 500: internal error', DATE_SUB(NOW(3), INTERVAL 58 MINUTE)),
('tsk_01hxyz004', 2, 'failed', 500, 98,  'HTTP 500: internal error', DATE_SUB(NOW(3), INTERVAL 56 MINUTE)),
('tsk_01hxyz004', 3, 'failed', 500, 110, 'HTTP 500: internal error', DATE_SUB(NOW(3), INTERVAL 55 MINUTE));
