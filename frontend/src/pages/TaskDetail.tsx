import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { cancelTask, deleteTask, getTask, getTaskLogs, retryTask } from '../api/tasks'
import { StatusBadge } from '../components/StatusBadge'
import type { ExecutionLog, Task } from '../types/task'
import { formatRelative, formatTime } from '../utils/format'

export function TaskDetail() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const [task, setTask] = useState<Task | null>(null)
  const [logs, setLogs] = useState<ExecutionLog[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let alive = true
    setError('')
    setTask(null)
    Promise.all([getTask(id), getTaskLogs(id)])
      .then(([t, l]) => {
        if (!alive) return
        setTask(t)
        setLogs(l)
      })
      .catch((e: Error) => {
        if (alive) setError(e.message)
      })
    return () => {
      alive = false
    }
  }, [id])

  async function onCancel() {
    if (!task || !confirm('确认取消该任务？')) return
    setBusy(true)
    try {
      const t = await cancelTask(task.id)
      setTask(t)
    } catch (e) {
      setError(e instanceof Error ? e.message : '取消失败')
    } finally {
      setBusy(false)
    }
  }

  async function onRetry() {
    if (!task || !confirm('确认重新投递？')) return
    setBusy(true)
    try {
      const t = await retryTask(task.id)
      setTask(t)
      setLogs(await getTaskLogs(t.id))
    } catch (e) {
      setError(e instanceof Error ? e.message : '重试失败')
    } finally {
      setBusy(false)
    }
  }

  async function onDelete() {
    if (!task || !confirm(`确认删除任务「${task.name}」？`)) return
    setBusy(true)
    try {
      await deleteTask(task.id)
      navigate('/')
    } catch (e) {
      setError(e instanceof Error ? e.message : '删除失败')
      setBusy(false)
    }
  }

  if (!task && !error) {
    return (
      <div className="page">
        <p className="muted">加载中…</p>
      </div>
    )
  }

  if (!task) {
    return (
      <div className="page">
        <p className="error-banner">{error || '任务不存在'}</p>
        <Link to="/">返回列表</Link>
      </div>
    )
  }

  const canCancel = ['pending', 'ready', 'failed'].includes(task.status)
  const canRetry = ['failed', 'dead'].includes(task.status)
  const canEdit = ['pending', 'cancelled'].includes(task.status)

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <p className="crumb">
            <Link to="/">任务</Link> / <span className="mono">{task.id}</span>
          </p>
          <h1>{task.name}</h1>
          <div className="meta-row">
            <StatusBadge status={task.status} />
            <span className="muted">{task.type === 'cron' ? '周期任务' : '延时任务'}</span>
          </div>
        </div>
        <div className="actions">
          <Link className="btn" to="/">
            返回
          </Link>
          {canEdit && (
            <Link className="btn" to={`/tasks/${task.id}/edit`}>
              编辑
            </Link>
          )}
          {canCancel && (
            <button type="button" className="btn" disabled={busy} onClick={onCancel}>
              取消
            </button>
          )}
          {canRetry && (
            <button type="button" className="btn primary" disabled={busy} onClick={onRetry}>
              重试
            </button>
          )}
          <button type="button" className="btn danger" disabled={busy} onClick={onDelete}>
            删除
          </button>
        </div>
      </div>

      {error && <p className="error-banner">{error}</p>}

      <section className="detail-grid">
        <div className="panel">
          <h2>基本信息</h2>
          <dl className="kv">
            <div>
              <dt>业务键</dt>
              <dd className="mono">{task.bizKey}</dd>
            </div>
            <div>
              <dt>计划执行</dt>
              <dd>
                <span className="mono">{formatTime(task.executeAt)}</span>
                <span className="muted"> · {formatRelative(task.executeAt)}</span>
              </dd>
            </div>
            {task.cronExpr && (
              <div>
                <dt>Cron</dt>
                <dd className="mono">{task.cronExpr}</dd>
              </div>
            )}
            <div>
              <dt>回调 URL</dt>
              <dd className="mono">{task.callbackUrl}</dd>
            </div>
            <div>
              <dt>重试</dt>
              <dd className="mono">
                {task.retryCount} / {task.maxRetries}
              </dd>
            </div>
            <div>
              <dt>回调耗时</dt>
              <dd className="mono">
                {task.callbackLatencyMs != null ? `${task.callbackLatencyMs} ms` : '—'}
              </dd>
            </div>
            <div>
              <dt>创建 / 更新</dt>
              <dd className="mono">
                {formatTime(task.createdAt)} / {formatTime(task.updatedAt)}
              </dd>
            </div>
            {task.lastError && (
              <div>
                <dt>最近错误</dt>
                <dd className="error-text">{task.lastError}</dd>
              </div>
            )}
          </dl>
        </div>

        <div className="panel">
          <h2>Payload</h2>
          <pre className="code-block">{task.payload}</pre>
        </div>
      </section>

      <section className="panel">
        <h2>执行日志</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>次数</th>
                <th>结果</th>
                <th>HTTP</th>
                <th>耗时</th>
                <th>时间</th>
                <th>错误</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="muted">
                    尚无执行记录
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id}>
                    <td className="mono">#{log.attempt}</td>
                    <td>{log.status === 'success' ? '成功' : '失败'}</td>
                    <td className="mono">{log.httpCode ?? '—'}</td>
                    <td className="mono">
                      {log.latencyMs != null ? `${log.latencyMs}ms` : '—'}
                    </td>
                    <td className="mono">{formatTime(log.createdAt)}</td>
                    <td className="muted">{log.error ?? '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
