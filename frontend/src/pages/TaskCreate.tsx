import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { createTask } from '../api/tasks'
import type { TaskType } from '../types/task'

export function TaskCreate() {
  const navigate = useNavigate()
  const [type, setType] = useState<TaskType>('delay')
  const [name, setName] = useState('')
  const [bizKey, setBizKey] = useState('')
  const [delaySeconds, setDelaySeconds] = useState(5)
  const [cronExpr, setCronExpr] = useState('0 0 2 * * *')
  const [callbackUrl, setCallbackUrl] = useState('http://127.0.0.1:8080/demo')
  const [payload, setPayload] = useState('{\n  "ping": true\n}')
  const [maxRetries, setMaxRetries] = useState(3)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      JSON.parse(payload || '{}')
      const task = await createTask({
        name,
        bizKey,
        type,
        delaySeconds: type === 'delay' ? delaySeconds : undefined,
        cronExpr: type === 'cron' ? cronExpr : undefined,
        callbackUrl,
        payload,
        maxRetries,
      })
      navigate(`/tasks/${task.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建失败')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="page narrow">
      <div className="page-head">
        <div>
          <h1>创建任务</h1>
          <p className="muted">注册延时或周期回调，后端就绪后走同一套字段</p>
        </div>
        <Link className="btn" to="/">
          返回列表
        </Link>
      </div>

      {error && <p className="error-banner">{error}</p>}

      <form className="panel form" onSubmit={onSubmit}>
        <label>
          <span>任务名称</span>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="订单超时取消"
          />
        </label>

        <label>
          <span>业务键 bizKey（幂等）</span>
          <input
            required
            value={bizKey}
            onChange={(e) => setBizKey(e.target.value)}
            placeholder="order:pay_timeout:10086"
            className="mono"
          />
        </label>

        <fieldset className="type-switch">
          <legend>任务类型</legend>
          <label className="radio">
            <input
              type="radio"
              name="type"
              checked={type === 'delay'}
              onChange={() => setType('delay')}
            />
            延时一次
          </label>
          <label className="radio">
            <input
              type="radio"
              name="type"
              checked={type === 'cron'}
              onChange={() => setType('cron')}
            />
            周期 cron
          </label>
        </fieldset>

        {type === 'delay' ? (
          <label>
            <span>延时秒数</span>
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
            <span>Cron 表达式</span>
            <input
              required
              value={cronExpr}
              onChange={(e) => setCronExpr(e.target.value)}
              className="mono"
              placeholder="0 0 2 * * *"
            />
          </label>
        )}

        <label>
          <span>回调 URL</span>
          <input
            required
            value={callbackUrl}
            onChange={(e) => setCallbackUrl(e.target.value)}
            className="mono"
            placeholder="http://127.0.0.1:8080/demo"
          />
        </label>

        <label>
          <span>最大重试次数</span>
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
            value={payload}
            onChange={(e) => setPayload(e.target.value)}
            className="mono"
          />
        </label>

        <div className="form-actions">
          <button type="submit" className="btn primary" disabled={submitting}>
            {submitting ? '提交中…' : '创建'}
          </button>
        </div>
      </form>
    </div>
  )
}
