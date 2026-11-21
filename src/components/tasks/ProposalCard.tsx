import { formatDue, formatPrice } from '../../lib/dates.ts'
import { slotLabel } from '../../lib/slots.ts'
import { useHousehold } from '../../hooks/useHousehold.ts'
import type { Assignment } from '../../types/domain.ts'

export function ProposalCard({ task, today }: { task: Assignment; today: string }) {
  const { acceptAssignment, memberById } = useHousehold()
  const asker = memberById(task.requestedBy)
  const price = formatPrice(task.priceCents)

  return (
    <article className="flex items-center gap-3 rounded-[2rem] bg-violet-200 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm">{asker ? `${asker.displayName} te demande :` : 'À prendre'}</p>
        <p className="text-lg font-bold">{task.title}</p>
        <p className="text-sm text-violet-950/70">
          {formatDue(task.dueOn, today)}
          {task.slot ? ` · ${slotLabel[task.slot]}` : ''}
          {price ? ` · ${price}` : ''}
        </p>
      </div>
      <button
        type="button"
        className="min-h-11 rounded-full bg-violet-700 px-4 font-bold text-white"
        onClick={() => void acceptAssignment(task.id).catch(() => {})}
      >
        Oui
      </button>
    </article>
  )
}
