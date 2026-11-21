import { formatDue, formatPrice, formatTime } from '../../lib/dates.ts'
import { slotLabel } from '../../lib/slots.ts'
import type { Assignment } from '../../types/domain.ts'

export function TaskCard({
  task,
  today,
  onDone,
  onOpen,
}: {
  task: Assignment
  today: string
  onDone: () => void
  onOpen: () => void
}) {
  const when = [formatDue(task.dueOn, today), task.slot ? slotLabel[task.slot] : null, formatTime(task.dueTime)]
    .filter(Boolean)
    .join(' · ')
  const price = formatPrice(task.priceCents)

  return (
    <article className="flex items-center gap-3 rounded-[2rem] bg-green-500 px-4 py-3 text-neutral-950">
      <button type="button" className="min-h-11 flex-1 text-left" onClick={onOpen}>
        <p className="text-lg font-bold">{task.title}</p>
        <p className="text-sm">{when}</p>
        {price ? <p className="text-sm">{price}</p> : null}
        <p className="text-sm text-green-950/70">Détails</p>
      </button>
      <button
        type="button"
        className="min-h-11 rounded-full bg-lime-300 px-4 font-bold"
        onClick={onDone}
      >
        Fait
      </button>
    </article>
  )
}
