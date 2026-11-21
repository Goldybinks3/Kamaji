import { useState, type FormEvent } from 'react'
import { useHousehold } from '../../hooks/useHousehold.ts'
import { addDays, formatDay, mondayOf } from '../../lib/dates.ts'
import { slotLabel } from '../../lib/slots.ts'
import type { Effort, MealSlot } from '../../types/domain.ts'

const efforts: { id: Effort; label: string }[] = [
  { id: 'light', label: 'Léger' },
  { id: 'normal', label: 'Normal' },
  { id: 'heavy', label: 'Lourd' },
]

const days = [
  { id: 1, label: 'Lun' },
  { id: 2, label: 'Mar' },
  { id: 3, label: 'Mer' },
  { id: 4, label: 'Jeu' },
  { id: 5, label: 'Ven' },
  { id: 6, label: 'Sam' },
  { id: 7, label: 'Dim' },
]

const effortLabel: Record<Effort, string> = {
  light: 'léger',
  normal: 'normal',
  heavy: 'lourd',
}

export function WeekSection() {
  const { templates, today, assignments, addTemplate, removeTemplate, prepareWeek } = useHousehold()
  const [title, setTitle] = useState('')
  const [effort, setEffort] = useState<Effort>('normal')
  const [weekdays, setWeekdays] = useState<number[]>([1, 2, 3, 4, 5])
  const [slot, setSlot] = useState<MealSlot | ''>('dinner')
  const [busy, setBusy] = useState(false)

  const thisMonday = mondayOf(today)
  const drawn = assignments.some(
    (item) =>
      item.kind === 'rotation' && item.dueOn >= thisMonday && item.dueOn < addDays(thisMonday, 7),
  )
  const target = drawn ? addDays(thisMonday, 7) : thisMonday

  function toggleDay(day: number) {
    setWeekdays((current) => {
      if (current.includes(day)) {
        if (current.length === 1) return current
        return current.filter((item) => item !== day)
      }
      return [...current, day].sort((a, b) => a - b)
    })
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!title.trim() || busy) return
    setBusy(true)
    try {
      await addTemplate({
        title,
        effort,
        weekdays,
        slot: slot === '' ? null : slot,
      })
      setTitle('')
    } catch {
      // L'erreur est affichée dans AppShell
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="grid gap-3">
      <h2 className="text-lg font-bold">Ça revient</h2>
      <p className="text-sm text-neutral-600">
        Ces tâches sont réparties quand tu prépares la semaine. Une énergie basse ne reçoit pas une
        tâche lourde.
      </p>
      {templates.map((template) => (
        <div
          key={template.id}
          className="flex items-center justify-between gap-2 rounded-2xl bg-neutral-100 px-4 py-3"
        >
          <p>
            <span className="font-bold">{template.title}</span>
            <span className="block text-sm text-neutral-600">
              {effortLabel[template.effort]}
              {template.slot ? ` · ${slotLabel[template.slot]}` : ''}
              {' · '}
              {template.weekdays
                .map((day) => days.find((item) => item.id === day)?.label)
                .filter(Boolean)
                .join(' ')}
            </span>
          </p>
          <button
            type="button"
            className="min-h-11 min-w-11 text-xl text-neutral-500"
            aria-label={`Retirer ${template.title}`}
            onClick={() => void removeTemplate(template.id).catch(() => {})}
          >
            ×
          </button>
        </div>
      ))}
      <form className="grid gap-2" onSubmit={(event) => void submit(event)}>
        <input
          type="text"
          className="min-h-11 rounded-2xl border border-neutral-300 px-3 text-base"
          placeholder="Ex. Vider le lave-vaisselle"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          aria-label="Tâche qui revient"
          required
        />
        <div className="grid grid-cols-3 gap-2">
          {efforts.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={effort === item.id}
              className={`min-h-11 rounded-full border font-bold ${
                effort === item.id
                  ? 'border-neutral-950 bg-neutral-950 text-white'
                  : 'border-neutral-300 bg-white'
              }`}
              onClick={() => setEffort(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((day) => {
            const active = weekdays.includes(day.id)
            return (
              <button
                key={day.id}
                type="button"
                aria-pressed={active}
                className={`min-h-11 rounded-full border text-sm font-bold ${
                  active
                    ? 'border-neutral-950 bg-neutral-950 text-white'
                    : 'border-neutral-300 bg-white'
                }`}
                onClick={() => toggleDay(day.id)}
              >
                {day.label}
              </button>
            )
          })}
        </div>
        <div className="grid grid-cols-3 gap-2">
          {(['', 'lunch', 'dinner'] as const).map((option) => {
            const active = slot === option
            const label = option === '' ? 'Sans' : slotLabel[option]
            return (
              <button
                key={option || 'none'}
                type="button"
                aria-pressed={active}
                className={`min-h-11 rounded-full border font-bold ${
                  active
                    ? 'border-neutral-950 bg-neutral-950 text-white'
                    : 'border-neutral-300 bg-white'
                }`}
                onClick={() => setSlot(option)}
              >
                {label}
              </button>
            )
          })}
        </div>
        <button
          type="submit"
          disabled={busy || !title.trim()}
          className="min-h-11 rounded-full bg-neutral-200 font-bold disabled:opacity-50"
        >
          Ajouter
        </button>
      </form>
      <button
        type="button"
        disabled={busy || templates.length === 0}
        className="min-h-11 rounded-full bg-green-500 font-bold text-neutral-950 disabled:opacity-50"
        onClick={() => {
          setBusy(true)
          void prepareWeek(target)
            .catch(() => {})
            .finally(() => setBusy(false))
        }}
      >
        {busy ? 'Préparation…' : `Préparer la semaine du ${formatDay(target)}`}
      </button>
    </section>
  )
}
