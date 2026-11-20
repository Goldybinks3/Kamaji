import { MemberAvatar } from '../../components/family/MemberAvatar.tsx'
import { useHousehold } from '../../hooks/useHousehold.ts'
import type { Energy } from '../../types/domain.ts'

const energies: { id: Energy; label: string }[] = [
  { id: 'low', label: 'Basse' },
  { id: 'ok', label: 'Ok' },
  { id: 'high', label: 'En forme' },
]

export function ProfilePage() {
  const { currentUser, setEnergy } = useHousehold()

  return (
    <div className="grid justify-items-start gap-6">
      <h1 className="text-3xl font-bold">{currentUser.displayName}</h1>
      <MemberAvatar member={currentUser} size={96} />
      <section className="grid w-full gap-3">
        <h2 className="text-lg font-bold">Énergie</h2>
        <div className="grid grid-cols-3 gap-2">
          {energies.map((energy) => {
            const active = currentUser.energy === energy.id
            return (
              <button
                key={energy.id}
                type="button"
                aria-pressed={active}
                className={`min-h-11 rounded-full border font-bold ${
                  active ? 'border-neutral-950 bg-neutral-950 text-white' : 'border-neutral-300 bg-white'
                }`}
                onClick={() => setEnergy(energy.id)}
              >
                {energy.label}
              </button>
            )
          })}
        </div>
        <p className="text-sm text-neutral-600">
          Le tirage de la semaine en tiendra compte quand Supabase sera branché.
        </p>
      </section>
      <p className="text-neutral-600">La déconnexion arrivera avec Supabase.</p>
    </div>
  )
}
