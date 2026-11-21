import { useState, type FormEvent } from 'react'
import { Sheet } from '../../components/ui/Sheet.tsx'
import { useHousehold } from '../../hooks/useHousehold.ts'
import { formatDay, weekDates } from '../../lib/dates.ts'
import { isAbsent, openSlotsFor, slotLabel } from '../../lib/slots.ts'
import type { Meal, MealSlot } from '../../types/domain.ts'

export function MealsPage() {
  const {
    meals,
    shopping,
    members,
    today,
    rhythm,
    periods,
    absences,
    addShopping,
    toggleShopping,
    removeShopping,
    saveMeal,
    removeMeal,
    memberById,
  } = useHousehold()
  const days = weekDates(today)

  const [newItem, setNewItem] = useState('')
  const [addingItem, setAddingItem] = useState(false)

  const [editingDay, setEditingDay] = useState<string | null>(null)
  const [slot, setSlot] = useState<MealSlot>('dinner')
  const [mealTitle, setMealTitle] = useState('')
  const [cookId, setCookId] = useState<string>('')
  const [editingMealId, setEditingMealId] = useState<string | null>(null)
  const [savingMeal, setSavingMeal] = useState(false)

  function openDayEditor(day: string, existing?: Meal) {
    const open = openSlotsFor(day, rhythm, periods)
    setEditingDay(day)
    if (existing) {
      setSlot(existing.slot)
      setMealTitle(existing.title)
      setCookId(existing.cookId ?? '')
      setEditingMealId(existing.id)
    } else {
      setSlot(open[0] ?? 'dinner')
      setMealTitle('')
      setCookId('')
      setEditingMealId(null)
    }
  }

  function onSlotChange(nextSlot: MealSlot) {
    setSlot(nextSlot)
    if (!editingDay) return
    const existing = meals.find((m) => m.servedOn === editingDay && m.slot === nextSlot)
    if (existing) {
      setMealTitle(existing.title)
      setCookId(existing.cookId ?? '')
      setEditingMealId(existing.id)
    } else {
      setEditingMealId(null)
    }
  }

  async function submitMeal(event: FormEvent) {
    event.preventDefault()
    if (!editingDay || !mealTitle.trim() || savingMeal) return
    setSavingMeal(true)
    try {
      await saveMeal({
        servedOn: editingDay,
        slot,
        title: mealTitle,
        cookId: cookId || null,
      })
      setEditingDay(null)
    } catch {
      // L'erreur est affichée dans AppShell
    } finally {
      setSavingMeal(false)
    }
  }

  async function onDeleteMeal() {
    if (!editingMealId || savingMeal) return
    setSavingMeal(true)
    try {
      await removeMeal(editingMealId)
      setEditingDay(null)
    } catch {
      // L'erreur est affichée dans AppShell
    } finally {
      setSavingMeal(false)
    }
  }

  async function submitShopping(event: FormEvent) {
    event.preventDefault()
    if (!newItem.trim() || addingItem) return
    setAddingItem(true)
    try {
      await addShopping(newItem)
      setNewItem('')
    } catch {
      // L'erreur est affichée dans AppShell
    } finally {
      setAddingItem(false)
    }
  }

  return (
    <div className="grid gap-8">
      <h1 className="text-3xl font-bold">Repas</h1>
      <section>
        <h2 className="mb-2 text-lg font-bold">Menu de la semaine</h2>
        <ul>
          {days.map((day) => {
            const open = openSlotsFor(day, rhythm, periods)
            const items = meals.filter((meal) => meal.servedOn === day && open.includes(meal.slot))
            return (
              <li key={day} className="border-b border-neutral-200 py-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold">{formatDay(day)}</p>
                    <p className="text-sm text-neutral-500">
                      {open.map((item) => slotLabel[item]).join(' · ')}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="min-h-11 rounded-full px-3 text-sm font-bold text-violet-700"
                    onClick={() => openDayEditor(day, items[0])}
                  >
                    {items.length === 0 ? '+ Ajouter' : 'Modifier'}
                  </button>
                </div>
                {items.length === 0 ? (
                  <p className="text-neutral-600">Rien de prévu</p>
                ) : (
                  items.map((meal) => {
                    const cook = memberById(meal.cookId)
                    return (
                      <button
                        key={meal.id}
                        type="button"
                        className="block w-full py-1 text-left"
                        onClick={() => openDayEditor(day, meal)}
                      >
                        {slotLabel[meal.slot]} : {meal.title}
                        {cook ? ` · ${cook.displayName}` : ''}
                      </button>
                    )
                  })
                )}
              </li>
            )
          })}
        </ul>
      </section>

      <section className="grid gap-3">
        <h2 className="text-lg font-bold">Courses</h2>
        <form className="flex gap-2" onSubmit={(event) => void submitShopping(event)}>
          <input
            type="text"
            className="min-h-11 flex-1 rounded-full border border-neutral-300 px-4 text-base"
            placeholder="Ajouter un article…"
            value={newItem}
            onChange={(event) => setNewItem(event.target.value)}
          />
          <button
            type="submit"
            disabled={!newItem.trim() || addingItem}
            className="min-h-11 rounded-full bg-green-500 px-4 font-bold text-neutral-950 disabled:opacity-50"
          >
            Ajouter
          </button>
        </form>

        {shopping.length === 0 ? (
          <p className="text-neutral-600">Liste vide.</p>
        ) : (
          <ul className="grid gap-1">
            {shopping.map((item) => (
              <li key={item.id} className="flex items-center gap-2">
                <button
                  type="button"
                  className="flex min-h-11 flex-1 items-center gap-3 text-left"
                  aria-pressed={item.done}
                  onClick={() => void toggleShopping(item.id).catch(() => {})}
                >
                  <span
                    className={`h-6 w-6 shrink-0 rounded border border-neutral-900 ${item.done ? 'bg-green-500' : 'bg-white'}`}
                    aria-hidden="true"
                  />
                  <span className={item.done ? 'text-neutral-500 line-through' : ''}>
                    {item.label}
                  </span>
                </button>
                <button
                  type="button"
                  className="min-h-11 min-w-11 text-xl text-neutral-500"
                  aria-label={`Supprimer ${item.label}`}
                  onClick={() => void removeShopping(item.id).catch(() => {})}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {editingDay ? (
        <Sheet title={formatDay(editingDay)} onClose={() => setEditingDay(null)}>
          <form className="grid gap-4" onSubmit={(event) => void submitMeal(event)}>
            <div className={`grid gap-2 ${openSlotsFor(editingDay, rhythm, periods).length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {openSlotsFor(editingDay, rhythm, periods).map((option) => (
                <button
                  key={option}
                  type="button"
                  className={`min-h-11 rounded-full border font-bold ${
                    slot === option
                      ? 'border-neutral-950 bg-neutral-950 text-white'
                      : 'border-neutral-300 bg-white'
                  }`}
                  onClick={() => onSlotChange(option)}
                >
                  {slotLabel[option]}
                </button>
              ))}
            </div>
            <label className="grid gap-1">
              <span className="text-sm font-bold">Plat</span>
              <input
                type="text"
                className="min-h-11 rounded-2xl border border-neutral-300 px-3 text-base"
                placeholder="Ex. Pâtes au pesto"
                value={mealTitle}
                onChange={(event) => setMealTitle(event.target.value)}
                required
              />
            </label>
            <label className="grid gap-1">
              <span className="text-sm font-bold">Cuisinier</span>
              <select
                className="min-h-11 rounded-2xl border border-neutral-300 bg-white px-3 text-base"
                value={cookId}
                onChange={(event) => setCookId(event.target.value)}
              >
                <option value="">À définir</option>
                {members
                  .filter((member) => !isAbsent(member.id, editingDay, absences))
                  .map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.displayName}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              disabled={!mealTitle.trim() || savingMeal}
              className="min-h-11 rounded-full bg-green-500 font-bold text-neutral-950 disabled:opacity-50"
            >
              {savingMeal ? 'Enregistrement…' : 'Enregistrer'}
            </button>
            {editingMealId ? (
              <button
                type="button"
                disabled={savingMeal}
                className="min-h-11 rounded-full bg-neutral-200 font-bold"
                onClick={() => void onDeleteMeal()}
              >
                Supprimer ce repas
              </button>
            ) : null}
          </form>
        </Sheet>
      ) : null}
    </div>
  )
}
