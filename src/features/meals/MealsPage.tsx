import { formatDay, weekDates } from '../../lib/dates.ts'
import { useHousehold } from '../../hooks/useHousehold.ts'

const slotLabel = { lunch: 'Déjeuner', dinner: 'Dîner' }

export function MealsPage() {
  const { meals, shopping, today, toggleShopping, memberById } = useHousehold()
  const days = weekDates(today)

  return (
    <div className="grid gap-8">
      <h1 className="text-3xl font-bold">Repas</h1>
      <section>
        <h2 className="mb-2 text-lg font-bold">Menu de la semaine</h2>
        <ul>
          {days.map((day) => {
            const items = meals.filter((meal) => meal.servedOn === day)
            return (
              <li key={day} className="border-b border-neutral-200 py-3">
                <p className="font-semibold">{formatDay(day)}</p>
                {items.length === 0 ? (
                  <p className="text-neutral-600">Rien de prévu</p>
                ) : (
                  items.map((meal) => {
                    const cook = memberById(meal.cookId)
                    return (
                      <p key={meal.id}>
                        {slotLabel[meal.slot]} : {meal.title}
                        {cook ? ` · ${cook.displayName}` : ''}
                      </p>
                    )
                  })
                )}
              </li>
            )
          })}
        </ul>
      </section>
      <section>
        <h2 className="mb-2 text-lg font-bold">Courses</h2>
        <ul className="grid gap-1">
          {shopping.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className="flex min-h-11 w-full items-center gap-3 text-left"
                aria-pressed={item.done}
                onClick={() => toggleShopping(item.id)}
              >
                <span
                  className={`h-6 w-6 rounded border border-neutral-900 ${item.done ? 'bg-green-500' : 'bg-white'}`}
                  aria-hidden="true"
                />
                <span className={item.done ? 'text-neutral-500 line-through' : ''}>{item.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
