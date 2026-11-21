import { formatDue, formatPrice, formatTime } from '../../lib/dates.ts'
import { slotLabel } from '../../lib/slots.ts'
import { useHousehold } from '../../hooks/useHousehold.ts'
import { Sheet } from '../ui/Sheet.tsx'

export function TaskDetailSheet({ assignmentId }: { assignmentId: string }) {
  const { assignmentById, closeSheet, releaseAssignment, markNotDone, sendThanks, today, currentUser } =
    useHousehold()
  const task = assignmentById(assignmentId)
  if (!task || !currentUser) return null

  const mine = task.assigneeId === currentUser.id && task.status === 'accepted'
  const price = formatPrice(task.priceCents)
  const canThank = task.assigneeId !== null && task.assigneeId !== currentUser.id

  return (
    <Sheet title={task.title} onClose={closeSheet}>
      <p>{task.details ?? 'Pas de détail.'}</p>
      <p className="mt-3">
        {formatDue(task.dueOn, today)}
        {task.slot ? ` · ${slotLabel[task.slot]}` : ''}
        {formatTime(task.dueTime) ? ` · ${formatTime(task.dueTime)}` : ''}
      </p>
      {price ? <p className="mt-2">{price}</p> : null}
      {task.assumed ? <p className="mt-3 font-bold">Considérée faite</p> : null}
      {task.status === 'done' ? (
        <button
          type="button"
          className="mt-6 min-h-11 w-full rounded-full bg-neutral-200 font-bold"
          onClick={() => void markNotDone(task.id).catch(() => {})}
        >
          Pas faite
        </button>
      ) : null}
      {mine ? (
        <button
          type="button"
          className="mt-6 min-h-11 w-full rounded-full bg-neutral-200 font-bold"
          onClick={() => void releaseAssignment(task.id).catch(() => {})}
        >
          Pas possible
        </button>
      ) : null}
      {canThank ? (
        <button
          type="button"
          className="mt-3 min-h-11 w-full rounded-full bg-green-500 font-bold text-neutral-950"
          onClick={() => void sendThanks(task.assigneeId as string, task.id).catch(() => {})}
        >
          Merci
        </button>
      ) : null}
    </Sheet>
  )
}
