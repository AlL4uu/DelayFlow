export function formatTime(iso?: string) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(+d)) return iso
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

export function formatRelative(iso: string) {
  const diff = +new Date(iso) - Date.now()
  const abs = Math.abs(diff)
  const sec = Math.round(abs / 1000)
  if (sec < 60) return diff >= 0 ? `${sec}s 后` : `${sec}s 前`
  const min = Math.round(sec / 60)
  if (min < 60) return diff >= 0 ? `${min} 分钟后` : `${min} 分钟前`
  const hr = Math.round(min / 60)
  if (hr < 48) return diff >= 0 ? `${hr} 小时后` : `${hr} 小时前`
  const day = Math.round(hr / 24)
  return diff >= 0 ? `${day} 天后` : `${day} 天前`
}
