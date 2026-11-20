import { useState } from 'react'
import { addDays } from '../../lib/dates.ts'
import { useHousehold } from '../../hooks/useHousehold.ts'
import { Sheet } from '../ui/Sheet.tsx'

const reasons = [
  { id: 'vaisselle', label: 'Vaisselle' },
  { id: 'linge', label: 'Linge' },
  { id: 'courses', label: 'Courses' },
  { id: 'menage', label: 'Ménage' },
  { id: 'autre', label: 'Autre' },
]

const whens = [
  { id: 'today', label: "Aujourd'hui", offset: 0 },
  { id: 'tomorrow', label: 'Demain', offset: 1 },
  { id: 'later', label: 'Dans 3 jours', offset: 3 },
]

const prices = [
  { id: 'none', label: 'Aucun', cents: null },
  { id: '5', label: '5 €', cents: 500 },
  { id: '10', label: '10 €', cents: 1000 },
  { id: '20', label: '20 €', cents: 2000 },
  { id: '50', label: '50 €', cents: 5000 },
]

export function RequestSheet({ assigneeId }: { assigneeId: string | null }) {
  const { others, today, createRequest, closeSheet } = useHousehold()
  const [reason, setReason] = useState('')
  const [customTitle, setCustomTitle] = useState('')
  const [who, setWho] = useState(assigneeId ?? 'all')
  const [when, setWhen] = useState('today')
  const [price, setPrice] = useState('none')
  const [busy, setBusy] = useState(false)

  const custom = reason === 'autre'
  const title = custom ? customTitle.trim() : (reasons.find((item) => item.id === reason)?.label ?? '')
  const canSubmit = !busy && title.length > 0 && who !== ''

  async function submit() {
    if (!canSubmit) return
    setBusy(true)
    const offset = whens.find((item) => item.id === when)?.offset ?? 0
    const cents = prices.find((item) => item.id === price)?.cents ?? null
    try {
      await createRequest({
        title,
        assigneeId: who === 'all' ? null : who,
        dueOn: addDays(today, offset),
        priceCents: cents,
      })
    } catch {
      // L'erreur est affichée dans AppShell
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet title="Demande" onClose={closeSheet} tone="request">
      <div className="grid gap-4">
        <label className="grid grid-cols-[5.5rem_1fr] items-center gap-3">
          <span className="font-bold">Quoi</span>
          <select
            className="min-h-11 rounded-full bg-violet-700 px-4 text-base text-white"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          >
            <option value="">Choisir</option>
            {reasons.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        {custom ? (
          <label className="grid gap-2">
            <span className="font-bold">Préciser</span>
            <input
              className="min-h-11 rounded-full bg-white px-4 text-base"
              value={customTitle}
              onChange={(event) => setCustomTitle(event.target.value)}
              placeholder="La tâche"
            />
          </label>
        ) : null}
        <label className="grid grid-cols-[5.5rem_1fr] items-center gap-3">
          <span className="font-bold">À qui</span>
          <select
            className="min-h-11 rounded-full bg-violet-700 px-4 text-base text-white"
            value={who}
            onChange={(event) => setWho(event.target.value)}
          >
            <option value="all">Tout le monde</option>
            {others.map((member) => (
              <option key={member.id} value={member.id}>
                {member.displayName}
              </option>
            ))}
          </select>
        </label>
        <label className="grid grid-cols-[5.5rem_1fr] items-center gap-3">
          <span className="font-bold">Quand</span>
          <select
            className="min-h-11 rounded-full bg-violet-700 px-4 text-base text-white"
            value={when}
            onChange={(event) => setWhen(event.target.value)}
          >
            {whens.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label className="grid grid-cols-[5.5rem_1fr] items-center gap-3">
          <span className="font-bold">Prix</span>
          <select
            className="min-h-11 rounded-full bg-violet-700 px-4 text-base text-white"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
          >
            {prices.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="min-h-11 rounded-full bg-lime-300 font-bold disabled:opacity-50"
          disabled={!canSubmit}
          onClick={() => void submit()}
        >
          {busy ? 'Envoi…' : 'Valider'}
        </button>
      </div>
    </Sheet>
  )
}
