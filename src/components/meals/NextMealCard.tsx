import { formatDue } from '../../lib/dates.ts'
import { useHousehold } from '../../hooks/useHousehold.ts'

export function NextMealCard() {
  const { nextMeal, today, memberById } = useHousehold()
  const cook = memberById(nextMeal?.cookId ?? null)

  return (
    <section className="overflow-hidden rounded-[2rem] border border-neutral-300">
      <header className="flex items-start justify-between gap-3 bg-neutral-300 px-5 py-3">
        <h2 className="text-xl font-bold">Menu</h2>
        <p className="max-w-40 text-right text-sm">
          {cook ? `Cuisinier : ${cook.displayName}` : 'Cuisinier à définir'}
        </p>
      </header>
      <div className="px-5 py-8 text-center">
        {nextMeal ? (
          <>
            <p className="text-sm text-neutral-600">{formatDue(nextMeal.servedOn, today)}</p>
            <p className="mt-1 text-xl font-bold">{nextMeal.title}</p>
          </>
        ) : (
          <p className="text-xl font-bold">Aucun repas prévu</p>
        )}
      </div>
    </section>
  )
}
