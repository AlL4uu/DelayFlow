import type {
  CreateTaskInput,
  ExecutionLog,
  Task,
  TaskStats,
  TaskStatus,
} from '../types/task'

/** 编辑可改字段（Mock / 后端对齐时再用） */
export type UpdateTaskInput = {
  name: string
  callbackUrl: string
  payload: string
  maxRetries: number
  delaySeconds?: number
  cronExpr?: string
}

/** 设为 true 走内存 Mock；false 走 Vite 代理到后端 /api */
const USE_MOCK = true

const now = Date.now()

let tasks: Task[] = [
  {
    id: 'tsk_01hxyz001',
    name: '订单超时取消',
    bizKey: 'order:pay_timeout:10086',
    type: 'delay',
    status: 'pending',
    executeAt: new Date(now + 15 * 60 * 1000).toISOString(),
    callbackUrl: 'http://order-svc/internal/cancel',
    payload: JSON.stringify({ orderId: '10086' }, null, 2),
    maxRetries: 3,
    retryCount: 0,
    createdAt: new Date(now - 60_000).toISOString(),
    updatedAt: new Date(now - 60_000).toISOString(),
  },
  {
    id: 'tsk_01hxyz002',
    name: '预约开播提醒',
    bizKey: 'live:remind:42',
    type: 'delay',
    status: 'success',
    executeAt: new Date(now - 5 * 60_000).toISOString(),
    callbackUrl: 'http://notify-svc/push',
    payload: JSON.stringify({ userId: 'u_42', liveId: '42' }, null, 2),
    maxRetries: 3,
    retryCount: 0,
    callbackLatencyMs: 48,
    createdAt: new Date(now - 30 * 60_000).toISOString(),
    updatedAt: new Date(now - 5 * 60_000).toISOString(),
  },
  {
    id: 'tsk_01hxyz003',
    name: '日终对账',
    bizKey: 'recon:daily',
    type: 'cron',
    status: 'failed',
    executeAt: new Date(now - 2 * 60_000).toISOString(),
    cronExpr: '0 0 2 * * *',
    callbackUrl: 'http://billing-svc/recon/daily',
    payload: JSON.stringify({ date: '2026-10-26' }, null, 2),
    maxRetries: 3,
    retryCount: 2,
    lastError: 'callback timeout after 3000ms',
    createdAt: new Date(now - 24 * 3600_000).toISOString(),
    updatedAt: new Date(now - 2 * 60_000).toISOString(),
  },
  {
    id: 'tsk_01hxyz004',
    name: '优惠券过期清理',
    bizKey: 'coupon:expire:batch',
    type: 'delay',
    status: 'dead',
    executeAt: new Date(now - 60 * 60_000).toISOString(),
    callbackUrl: 'http://marketing-svc/coupon/expire',
    payload: JSON.stringify({ batchId: 'b_9' }, null, 2),
    maxRetries: 3,
    retryCount: 3,
    lastError: 'HTTP 500: internal error',
    createdAt: new Date(now - 2 * 3600_000).toISOString(),
    updatedAt: new Date(now - 55 * 60_000).toISOString(),
  },
]

const logs: Record<string, ExecutionLog[]> = {
  tsk_01hxyz002: [
    {
      id: 'log_1',
      taskId: 'tsk_01hxyz002',
      attempt: 1,
      status: 'success',
      httpCode: 200,
      latencyMs: 48,
      createdAt: new Date(now - 5 * 60_000).toISOString(),
    },
  ],
  tsk_01hxyz003: [
    {
      id: 'log_2',
      taskId: 'tsk_01hxyz003',
      attempt: 1,
      status: 'failed',
      latencyMs: 3001,
      error: 'callback timeout after 3000ms',
      createdAt: new Date(now - 10 * 60_000).toISOString(),
    },
    {
      id: 'log_3',
      taskId: 'tsk_01hxyz003',
      attempt: 2,
      status: 'failed',
      latencyMs: 3002,
      error: 'callback timeout after 3000ms',
      createdAt: new Date(now - 2 * 60_000).toISOString(),
    },
  ],
  tsk_01hxyz004: [
    {
      id: 'log_4',
      taskId: 'tsk_01hxyz004',
      attempt: 1,
      status: 'failed',
      httpCode: 500,
      latencyMs: 120,
      error: 'HTTP 500: internal error',
      createdAt: new Date(now - 58 * 60_000).toISOString(),
    },
    {
      id: 'log_5',
      taskId: 'tsk_01hxyz004',
      attempt: 2,
      status: 'failed',
      httpCode: 500,
      latencyMs: 98,
      error: 'HTTP 500: internal error',
      createdAt: new Date(now - 56 * 60_000).toISOString(),
    },
    {
      id: 'log_6',
      taskId: 'tsk_01hxyz004',
      attempt: 3,
      status: 'failed',
      httpCode: 500,
      latencyMs: 110,
      error: 'HTTP 500: internal error',
      createdAt: new Date(now - 55 * 60_000).toISOString(),
    },
  ],
}

function delay(ms = 180) {
  return new Promise((r) => setTimeout(r, ms))
}

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`
}

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || res.statusText)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export interface ListTasksQuery {
  status?: TaskStatus | ''
  q?: string
}

export async function listTasks(query: ListTasksQuery = {}): Promise<Task[]> {
  if (!USE_MOCK) {
    const params = new URLSearchParams()
    if (query.status) params.set('status', query.status)
    if (query.q) params.set('q', query.q)
    const qs = params.toString()
    return http<Task[]>(`/api/v1/tasks${qs ? `?${qs}` : ''}`)
  }

  await delay()
  let list = [...tasks].sort(
    (a, b) => +new Date(b.createdAt) - +new Date(a.createdAt),
  )
  if (query.status) list = list.filter((t) => t.status === query.status)
  if (query.q?.trim()) {
    const q = query.q.trim().toLowerCase()
    list = list.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.bizKey.toLowerCase().includes(q) ||
        t.id.toLowerCase().includes(q),
    )
  }
  return list
}

export async function getTask(id: string): Promise<Task> {
  if (!USE_MOCK) return http<Task>(`/api/v1/tasks/${id}`)
  await delay()
  const task = tasks.find((t) => t.id === id)
  if (!task) throw new Error('任务不存在')
  return { ...task }
}

export async function getTaskLogs(id: string): Promise<ExecutionLog[]> {
  if (!USE_MOCK) return http<ExecutionLog[]>(`/api/v1/tasks/${id}/logs`)
  await delay()
  return [...(logs[id] ?? [])].sort(
    (a, b) => +new Date(b.createdAt) - +new Date(a.createdAt),
  )
}

export async function getStats(): Promise<TaskStats> {
  if (!USE_MOCK) return http<TaskStats>('/api/v1/stats')
  await delay()
  const base: TaskStats = {
    pending: 0,
    ready: 0,
    running: 0,
    success: 0,
    failed: 0,
    cancelled: 0,
    dead: 0,
    total: tasks.length,
  }
  for (const t of tasks) base[t.status] += 1
  return base
}

export async function createTask(input: CreateTaskInput): Promise<Task> {
  if (!USE_MOCK) {
    return http<Task>('/api/v1/tasks', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  }

  await delay()
  const ts = new Date().toISOString()
  let executeAt = input.executeAt
  if (input.type === 'delay' && input.delaySeconds != null) {
    executeAt = new Date(Date.now() + input.delaySeconds * 1000).toISOString()
  }
  if (!executeAt) throw new Error('请指定执行时间或延时秒数')

  const task: Task = {
    id: uid('tsk'),
    name: input.name.trim(),
    bizKey: input.bizKey.trim(),
    type: input.type,
    status: 'pending',
    executeAt,
    cronExpr: input.type === 'cron' ? input.cronExpr : undefined,
    callbackUrl: input.callbackUrl.trim(),
    payload: input.payload.trim() || '{}',
    maxRetries: input.maxRetries,
    retryCount: 0,
    createdAt: ts,
    updatedAt: ts,
  }
  tasks = [task, ...tasks]
  return { ...task }
}

export async function cancelTask(id: string): Promise<Task> {
  if (!USE_MOCK) {
    return http<Task>(`/api/v1/tasks/${id}/cancel`, { method: 'POST' })
  }
  await delay()
  const task = tasks.find((t) => t.id === id)
  if (!task) throw new Error('任务不存在')
  if (!['pending', 'ready', 'failed'].includes(task.status)) {
    throw new Error('当前状态不可取消')
  }
  task.status = 'cancelled'
  task.updatedAt = new Date().toISOString()
  return { ...task }
}

export async function retryTask(id: string): Promise<Task> {
  if (!USE_MOCK) {
    return http<Task>(`/api/v1/tasks/${id}/retry`, { method: 'POST' })
  }
  await delay()
  const task = tasks.find((t) => t.id === id)
  if (!task) throw new Error('任务不存在')
  if (!['failed', 'dead'].includes(task.status)) {
    throw new Error('仅失败或死信任务可重试')
  }
  task.status = 'pending'
  task.retryCount = 0
  task.lastError = undefined
  task.executeAt = new Date(Date.now() + 5_000).toISOString()
  task.updatedAt = new Date().toISOString()
  return { ...task }
}

export async function updateTask(id: string, input: UpdateTaskInput): Promise<Task> {
  if (!USE_MOCK) {
    return http<Task>(`/api/v1/tasks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    })
  }
  await delay()
  const task = tasks.find((t) => t.id === id)
  if (!task) throw new Error('任务不存在')
  if (!['pending', 'cancelled'].includes(task.status)) {
    throw new Error('仅等待中或已取消的任务可编辑')
  }
  JSON.parse(input.payload || '{}')
  task.name = input.name.trim()
  task.callbackUrl = input.callbackUrl.trim()
  task.payload = input.payload.trim() || '{}'
  task.maxRetries = input.maxRetries
  if (task.type === 'delay' && input.delaySeconds != null) {
    task.executeAt = new Date(Date.now() + input.delaySeconds * 1000).toISOString()
  }
  if (task.type === 'cron' && input.cronExpr) {
    task.cronExpr = input.cronExpr
  }
  if (task.status === 'cancelled') {
    task.status = 'pending'
  }
  task.updatedAt = new Date().toISOString()
  return { ...task }
}

export async function deleteTask(id: string): Promise<void> {
  if (!USE_MOCK) {
    await http<void>(`/api/v1/tasks/${id}`, { method: 'DELETE' })
    return
  }
  await delay()
  const idx = tasks.findIndex((t) => t.id === id)
  if (idx < 0) throw new Error('任务不存在')
  tasks = tasks.filter((t) => t.id !== id)
  delete logs[id]
}
