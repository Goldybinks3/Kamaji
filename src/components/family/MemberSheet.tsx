import { useState } from 'react'
import { useHousehold } from '../../hooks/useHousehold.ts'
import { balanceWith } from '../../lib/balances.ts'
import { formatPrice } from '../../lib/dates.ts'
import { Sheet } from '../ui/Sheet.tsx'
import { MemberAvatar } from './MemberAvatar.tsx'

function BalanceLine({ cents, name }: { cents: number; name: string }) {
  if (cents === 0) return <p className="text-sm text-neutral-600">Rien à régler entre vous.</p>
  const amount = formatPrice(Math.abs(cents))
  return (
    <p className="text-center text-sm">
      {cents < 0 ? `Tu dois ${amount} à ${name}` : `${name} te doit ${amount}`}
    </p>
  )
}

export function MemberSheet({ memberId }: { memberId: string }) {
  const { memberById, closeSheet, openRequest, sendPing, sendThanks, debts, currentUser } =
    useHousehold()
  const [body, setBody] = useState('')
  const [sent, setSent] = useState('')
  const [busy, setBusy] = useState(false)
  const member = memberById(memberId)
  if (!member) return null

  const phone = member.phone?.replace(/\s/g, '')

  async function ping() {
    if (!body.trim() || busy) return
    setBusy(true)
    try {
      await sendPing(memberId, body)
      setBody('')
      setSent('Message envoyé')
    } catch {
      // L'erreur est affichée dans AppShell
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet title={member.displayName} onClose={closeSheet}>
      <div className="flex flex-col items-center gap-4">
        <MemberAvatar member={member} size={96} />
        {currentUser ? <BalanceLine cents={balanceWith(debts, currentUser.id, member.id)} name={member.displayName} /> : null}
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
        <button
          type="button"
          className="min-h-11 w-full rounded-full bg-green-500 font-bold text-neutral-950"
          onClick={() => {
            void sendThanks(memberId)
              .then(() => setSent('Merci envoyé'))
              .catch(() => {})
          }}
        >
          Merci
        </button>
        <label className="grid w-full gap-2">
          <span className="font-bold">Petit message</span>
          <input
            className="min-h-11 rounded-full border border-neutral-300 px-4 text-base"
            maxLength={140}
            value={body}
            placeholder="Un mot pour ce soir"
            onChange={(event) => setBody(event.target.value)}
          />
        </label>
        <button
          type="button"
          disabled={!body.trim() || busy}
          className="min-h-11 w-full rounded-full bg-neutral-950 font-bold text-white disabled:opacity-50"
          onClick={() => void ping()}
        >
          Envoyer
        </button>
        {sent ? <p className="text-sm text-neutral-600">{sent}</p> : null}
      </div>
    </Sheet>
  )
}
