import { useHousehold } from '../../hooks/useHousehold.ts'
import { Sheet } from '../ui/Sheet.tsx'
import { MemberAvatar } from './MemberAvatar.tsx'

export function MemberSheet({ memberId }: { memberId: string }) {
  const { memberById, closeSheet, openRequest } = useHousehold()
  const member = memberById(memberId)
  if (!member) return null

  const phone = member.phone?.replace(/\s/g, '')

  return (
    <Sheet title={member.displayName} onClose={closeSheet}>
      <div className="flex flex-col items-center gap-4">
        <MemberAvatar member={member} size={96} />
        {phone ? (
          <a
            className="inline-flex min-h-11 items-center rounded-full bg-neutral-900 px-5 font-bold text-white"
            href={`tel:${phone}`}
          >
            Appeler
          </a>
        ) : (
          <p className="text-neutral-600">Pas de numéro</p>
        )}
        <button
          type="button"
          className="min-h-11 w-full rounded-full bg-violet-700 font-bold text-white"
          onClick={() => openRequest(member.id)}
        >
          Demander un service
        </button>
      </div>
    </Sheet>
  )
}
