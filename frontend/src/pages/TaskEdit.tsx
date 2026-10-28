import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getTask, updateTask } from '../api/tasks'

export function TaskEdit() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [callbackUrl, setCallbackUrl] = useState('')
  const [payload, setPayload] = useState('{}')
  const [maxRetries, setMaxRetries] = useState(3)
  const [delaySeconds, setDelaySeconds] = useState(60)
  const [cronExpr, setCronExpr] = useState('')
  const [type, setType] = useState<'delay' | 'cron'>('delay')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    getTask(id)
      .then((t) => {
        if (!alive) return
        if (!['pending', 'cancelled'].includes(t.status)) {
          setError('仅等待中或已取消的任务可编辑')
          setLoading(false)
          return
        }
        setName(t.name)
        setCallbackUrl(t.callbackUrl)
        setPayload(t.payload)
        setMaxRetries(t.maxRetries)
        setType(t.type)
        setCronExpr(t.cronExpr ?? '')
        const sec = Math.max(1, Math.round((+new Date(t.executeAt) - Date.now()) / 1000))
        setDelaySeconds(sec > 0 ? sec : 60)
        setLoading(false)
      })
      .catch((e: Error) => {
        if (alive) {
          setError(e.message)
          setLoading(false)
        }
      })
    return () => {
      alive = false
    }
  }, [id])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      JSON.parse(payload || '{}')
      const task = await updateTask(id, {
        name,
        callbackUrl,
        payload,
        maxRetries,
        delaySeconds: type === 'delay' ? delaySeconds : undefined,
        cronExpr: type === 'cron' ? cronExpr : undefined,
      })
      navigate(`/tasks/${task.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="page">
        <p className="muted">加载中…</p>
      </div>
    )
  }

  return (
    <div className="page narrow">
      <div className="page-head">
        <div>
          <h1>编辑任务</h1>
          <p className="muted mono">{id}</p>
        </div>
        <div className="actions">
          <Link className="btn" to="/">
            返回列表
          </Link>
          <Link className="btn" to={`/tasks/${id}`}>
            返回详情
          </Link>
        </div>
      </div>

      {error && <p className="error-banner">{error}</p>}

      {!error.includes('可编辑') && (
        <form className="panel form" onSubmit={onSubmit}>
          <label>
            <span>任务名称</span>
            <input required value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          {type === 'delay' ? (
            <label>
              <span>延时秒数（相对当前时间重新计算执行点）</span>
              <input
                type="number"
                min={1}
                required
                value={delaySeconds}
                onChange={(e) => setDelaySeconds(Number(e.target.value))}
              />
            </label>
          ) : (
            <label>
              <span>Cron</span>
              <input
                required
                className="mono"
                value={cronExpr}
                onChange={(e) => setCronExpr(e.target.value)}
              />
            </label>
          )}
          <label>
            <span>回调 URL</span>
            <input
              required
              className="mono"
              value={callbackUrl}
              onChange={(e) => setCallbackUrl(e.target.value)}
            />
          </label>
          <label>
            <span>最大重试</span>
            <input
              type="number"
              min={0}
              max={10}
              required
              value={maxRetries}
              onChange={(e) => setMaxRetries(Number(e.target.value))}
            />
          </label>
          <label>
            <span>Payload（JSON）</span>
            <textarea
              rows={6}
              className="mono"
              value={payload}
              onChange={(e) => setPayload(e.target.value)}
            />
          </label>
          <div className="form-actions">
            <button type="submit" className="btn primary" disabled={submitting}>
              {submitting ? '保存中…' : '保存'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
