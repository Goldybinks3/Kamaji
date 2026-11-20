import { formatDue, formatPrice, formatTime } from '../../lib/dates.ts'
import { useHousehold } from '../../hooks/useHousehold.ts'
import { Sheet } from '../ui/Sheet.tsx'

export function TaskDetailSheet({ assignmentId }: { assignmentId: string }) {
  const { assignmentById, closeSheet, releaseAssignment, today, currentUser } = useHousehold()
  const task = assignmentById(assignmentId)
  if (!task || !currentUser) return null

  const mine = task.assigneeId === currentUser.id && task.status === 'accepted'
  const price = formatPrice(task.priceCents)

  return (
    <Sheet title={task.title} onClose={closeSheet}>
      <p>{task.details ?? 'Pas de détail.'}</p>
      <p className="mt-3">
        {formatDue(task.dueOn, today)}
        {formatTime(task.dueTime) ? ` · ${formatTime(task.dueTime)}` : ''}
      </p>
      {price ? <p className="mt-2">{price}</p> : null}
      {mine ? (
        <button
          type="button"
          className="mt-6 min-h-11 w-full rounded-full bg-neutral-200 font-bold"
          onClick={() => void releaseAssignment(task.id).catch(() => {})}
        >
          Pas possible
        </button>
      ) : null}
    </Sheet>
  )
}
