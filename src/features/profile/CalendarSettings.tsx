import { useState, type FormEvent } from 'react'
import { useHousehold } from '../../hooks/useHousehold.ts'
import { formatDay } from '../../lib/dates.ts'
import { slotLabel, toggleSlot } from '../../lib/slots.ts'
import type { HouseholdRhythm, MealSlot } from '../../types/domain.ts'

const both: MealSlot[] = ['lunch', 'dinner']

function SlotChecks({
  slots,
  onChange,
}: {
  slots: MealSlot[]
  onChange: (slots: MealSlot[]) => void
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {both.map((slot) => {
        const active = slots.includes(slot)
        return (
          <button
            key={slot}
            type="button"
            aria-pressed={active}
            className={`min-h-11 rounded-full border font-bold ${
              active ? 'border-neutral-950 bg-neutral-950 text-white' : 'border-neutral-300 bg-white'
            }`}
            onClick={() => {
              const next = toggleSlot(slots, slot)
              if (next) onChange(next)
            }}
          >
            {slotLabel[slot]}
          </button>
        )
      })}
    </div>
  )
}

export function CalendarSettings() {
  const {
    rhythm,
    periods,
    absences,
    members,
    saveRhythm,
    addPeriod,
    removePeriod,
    addAbsence,
    removeAbsence,
    memberById,
  } = useHousehold()
  const [label, setLabel] = useState('Vacances')
  const [startsOn, setStartsOn] = useState('')
  const [endsOn, setEndsOn] = useState('')
  const [vacationSlots, setVacationSlots] = useState<MealSlot[]>(['lunch', 'dinner'])
  const [profileId, setProfileId] = useState('')
  const [awayFrom, setAwayFrom] = useState('')
  const [awayTo, setAwayTo] = useState('')
  const [busy, setBusy] = useState(false)
  const selectedId = members.some((member) => member.id === profileId)
    ? profileId
    : (members[0]?.id ?? '')

  if (!rhythm) {
    return (
      <section className="grid w-full gap-2">
        <h2 className="text-lg font-bold">Rythme de la maison</h2>
        <p className="text-sm text-neutral-600">
          Disponible après avoir exécuté la nouvelle migration dans Supabase.
        </p>
      </section>
    )
  }

  async function changeRhythm(next: HouseholdRhythm) {
    try {
      await saveRhythm(next)
    } catch {
      // L'erreur est affichée dans AppShell
    }
  }

  async function submitVacation(event: FormEvent) {
    event.preventDefault()
    if (!label.trim() || !startsOn || !endsOn || endsOn < startsOn || busy) return
    setBusy(true)
    try {
      await addPeriod({ label, startsOn, endsOn, slots: vacationSlots })
      setLabel('Vacances')
      setStartsOn('')
      setEndsOn('')
    } catch {
      // L'erreur est affichée dans AppShell
    } finally {
      setBusy(false)
    }
  }

  async function submitAbsence(event: FormEvent) {
    event.preventDefault()
    if (!selectedId || !awayFrom || !awayTo || awayTo < awayFrom || busy) return
    setBusy(true)
    try {
      await addAbsence({ profileId: selectedId, startsOn: awayFrom, endsOn: awayTo })
      setAwayFrom('')
      setAwayTo('')
    } catch {
      // L'erreur est affichée dans AppShell
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid w-full gap-6">
      <section className="grid gap-3">
        <h2 className="text-lg font-bold">Rythme de la maison</h2>
        <p className="text-sm text-neutral-600">Semaine, du lundi au vendredi</p>
        <SlotChecks
          slots={rhythm.weekdaySlots}
          onChange={(weekdaySlots) => void changeRhythm({ ...rhythm, weekdaySlots })}
        />
        <p className="text-sm text-neutral-600">Week-end</p>
        <SlotChecks
          slots={rhythm.weekendSlots}
          onChange={(weekendSlots) => void changeRhythm({ ...rhythm, weekendSlots })}
        />
      </section>

      <section className="grid gap-3">
        <h2 className="text-lg font-bold">Vacances</h2>
        <p className="text-sm text-neutral-600">
          Pendant ces dates, ce choix remplace le rythme habituel.
        </p>
        {periods.map((period) => (
          <div key={period.id} className="flex items-center justify-between gap-2 rounded-2xl bg-neutral-100 px-4 py-3">
            <p>
              <span className="font-bold">{period.label}</span>
              <span className="block text-sm text-neutral-600">
                {formatDay(period.startsOn)} – {formatDay(period.endsOn)} ·{' '}
                {period.slots.map((slot) => slotLabel[slot]).join(' et ')}
              </span>
            </p>
            <button
              type="button"
              className="min-h-11 min-w-11 text-xl text-neutral-500"
              aria-label={`Retirer ${period.label}`}
              onClick={() => void removePeriod(period.id).catch(() => {})}
            >
              ×
            </button>
          </div>
        ))}
        <form className="grid gap-2" onSubmit={(event) => void submitVacation(event)}>
          <input
            type="text"
            className="min-h-11 rounded-2xl border border-neutral-300 px-3 text-base"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            aria-label="Nom de la période"
            required
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              type="date"
              className="min-h-11 rounded-2xl border border-neutral-300 px-3 text-base"
              value={startsOn}
              onChange={(event) => setStartsOn(event.target.value)}
              aria-label="Début des vacances"
              required
            />
            <input
              type="date"
              className="min-h-11 rounded-2xl border border-neutral-300 px-3 text-base"
              value={endsOn}
              onChange={(event) => setEndsOn(event.target.value)}
              aria-label="Fin des vacances"
              required
            />
          </div>
          <SlotChecks slots={vacationSlots} onChange={setVacationSlots} />
          <button
            type="submit"
            disabled={busy}
            className="min-h-11 rounded-full bg-green-500 font-bold text-neutral-950 disabled:opacity-50"
          >
            Ajouter les vacances
          </button>
        </form>
      </section>

      <section className="grid gap-3">
        <h2 className="text-lg font-bold">Absences</h2>
        <p className="text-sm text-neutral-600">
          La personne reste dans la famille et ne reçoit pas de tâche sur ces dates.
        </p>
        {absences.map((absence) => {
          const person = memberById(absence.profileId)
          return (
            <div key={absence.id} className="flex items-center justify-between gap-2 rounded-2xl bg-neutral-100 px-4 py-3">
              <p>
                <span className="font-bold">{person?.displayName ?? 'Quelqu’un'}</span>
                <span className="block text-sm text-neutral-600">
                  {formatDay(absence.startsOn)} – {formatDay(absence.endsOn)}
                </span>
              </p>
              <button
                type="button"
                className="min-h-11 min-w-11 text-xl text-neutral-500"
                aria-label="Retirer l’absence"
                onClick={() => void removeAbsence(absence.id).catch(() => {})}
              >
                ×
              </button>
            </div>
          )
        })}
        <form className="grid gap-2" onSubmit={(event) => void submitAbsence(event)}>
          <select
            className="min-h-11 rounded-2xl border border-neutral-300 bg-white px-3 text-base"
            value={selectedId}
            onChange={(event) => setProfileId(event.target.value)}
            aria-label="Personne absente"
          >
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.displayName}
              </option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="date"
              className="min-h-11 rounded-2xl border border-neutral-300 px-3 text-base"
              value={awayFrom}
              onChange={(event) => setAwayFrom(event.target.value)}
              aria-label="Début de l’absence"
              required
            />
            <input
              type="date"
              className="min-h-11 rounded-2xl border border-neutral-300 px-3 text-base"
              value={awayTo}
              onChange={(event) => setAwayTo(event.target.value)}
              aria-label="Fin de l’absence"
              required
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="min-h-11 rounded-full bg-green-500 font-bold text-neutral-950 disabled:opacity-50"
          >
            Noter l’absence
          </button>
        </form>
      </section>
    </div>
  )
}
