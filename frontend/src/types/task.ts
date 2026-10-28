export type TaskStatus =
  | 'pending'
  | 'ready'
  | 'running'
  | 'success'
  | 'failed'
  | 'cancelled'
  | 'dead'

export type TaskType = 'delay' | 'cron'

export interface Task {
  id: string
  name: string
  bizKey: string
  type: TaskType
  status: TaskStatus
  /** 计划执行时间 ISO */
  executeAt: string
  /** cron 表达式，仅 type=cron 时有值 */
  cronExpr?: string
  callbackUrl: string
  payload: string
  maxRetries: number
  retryCount: number
  lastError?: string
  callbackLatencyMs?: number
  createdAt: string
  updatedAt: string
}

export interface ExecutionLog {
  id: string | number
  taskId: string
  attempt: number
  status: 'success' | 'failed'
  httpCode?: number
  latencyMs?: number
  error?: string
  createdAt: string
}

export interface TaskStats {
  pending: number
  ready: number
  running: number
  success: number
  failed: number
  cancelled: number
  dead: number
  total: number
}

export interface CreateTaskInput {
  name: string
  bizKey: string
  type: TaskType
  /** 相对延时秒数；delay 任务二选一：delaySeconds 或 executeAt */
  delaySeconds?: number
  executeAt?: string
  cronExpr?: string
  callbackUrl: string
  payload: string
  maxRetries: number
}

export const STATUS_LABEL: Record<TaskStatus, string> = {
  pending: '等待中',
  ready: '已到期',
  running: '执行中',
  success: '成功',
  failed: '失败',
  cancelled: '已取消',
  dead: '死信',
}
