import type { TaskStatus } from '../types/task'
import { STATUS_LABEL } from '../types/task'

export function StatusBadge({ status }: { status: TaskStatus }) {
  return <span className={`badge badge-${status}`}>{STATUS_LABEL[status]}</span>
}
