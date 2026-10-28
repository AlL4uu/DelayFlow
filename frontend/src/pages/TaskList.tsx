import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { listTasks } from '../api/tasks'
import { StatusBadge } from '../components/StatusBadge'
import type { Task, TaskStatus } from '../types/task'
import { STATUS_LABEL } from '../types/task'
import { formatRelative, formatTime } from '../utils/format'

const FILTERS: { value: TaskStatus | ''; label: string }[] = [
  { value: '', label: '全部' },
  ...Object.entries(STATUS_LABEL).map(([value, label]) => ({
    value: value as TaskStatus,
    label,
  })),
]

export function TaskList() {
  const navigate = useNavigate()
  const [status, setStatus] = useState<TaskStatus | ''>('')
  const [q, setQ] = useState('')
  const [input, setInput] = useState('')
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    setLoading(true)
    listTasks({ status, q })
      .then((list) => {
        if (!alive) return
        setTasks(list)
        setError('')
      })
      .catch((e: Error) => alive && setError(e.message))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [status, q])

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>任务</h1>
          <p className="muted">点击行进入详情进行编辑、取消、重试或删除</p>
        </div>
        <Link className="btn primary" to="/tasks/new">
          创建任务
        </Link>
      </div>

      <div className="toolbar">
        <div className="filter-row">
          {FILTERS.map((f) => (
            <button
              key={f.value || 'all'}
              type="button"
              className={`chip ${status === f.value ? 'active' : ''}`}
              onClick={() => setStatus(f.value)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <form
          className="search"
          onSubmit={(e) => {
            e.preventDefault()
            setQ(input.trim())
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="搜索…"
            aria-label="搜索任务"
          />
          <button type="submit" className="btn">
            搜索
          </button>
        </form>
      </div>

      {error && <p className="error-banner">{error}</p>}

      <section className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>名称</th>
                <th>类型</th>
                <th>状态</th>
                <th>计划执行</th>
                <th>重试</th>
                <th>业务键</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="muted">
                    加载中…
                  </td>
                </tr>
              ) : tasks.length === 0 ? (
                <tr>
                  <td colSpan={6} className="muted">
                    没有匹配的任务
                  </td>
                </tr>
              ) : (
                tasks.map((t) => (
                  <tr
                    key={t.id}
                    className="row-click"
                    onClick={() => navigate(`/tasks/${t.id}`)}
                  >
                    <td>
                      <div>{t.name}</div>
                      <div className="mono tiny muted">{t.id}</div>
                    </td>
                    <td>{t.type === 'cron' ? '周期' : '延时'}</td>
                    <td>
                      <StatusBadge status={t.status} />
                    </td>
                    <td>
                      <span className="mono">{formatTime(t.executeAt)}</span>
                      <div className="muted tiny">{formatRelative(t.executeAt)}</div>
                    </td>
                    <td className="mono">
                      {t.retryCount}/{t.maxRetries}
                    </td>
                    <td className="mono muted">{t.bizKey}</td>
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
