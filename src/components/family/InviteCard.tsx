import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import type { Household } from '../../types/domain.ts'

export function InviteCard({ household }: { household: Household }) {
  const [qrUrl, setQrUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState<'code' | 'link' | null>(null)

  const inviteLink = `${window.location.origin}/rejoindre?code=${encodeURIComponent(household.inviteCode)}`

  useEffect(() => {
    let cancelled = false
    void QRCode.toDataURL(inviteLink, {
      width: 240,
      margin: 2,
      errorCorrectionLevel: 'M',
    })
      .then((url) => {
        if (!cancelled) setQrUrl(url)
      })
      .catch(() => {
        if (!cancelled) setQrUrl(null)
      })
    return () => {
      cancelled = true
    }
  }, [inviteLink])

  async function copyText(text: string, kind: 'code' | 'link') {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(kind)
      window.setTimeout(() => setCopied(null), 2500)
    } catch {
      window.prompt('Copie ce texte :', text)
    }
  }

  async function shareLink() {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Rejoindre ${household.name} sur Kamaji`,
          text: `Rejoins notre famille sur Kamaji (code : ${household.inviteCode})`,
          url: inviteLink,
        })
        return
      } catch {
        // Annulation ou partage indisponible : on copie le lien.
      }
    }
    await copyText(inviteLink, 'link')
  }

  return (
    <section className="grid w-full gap-4 rounded-3xl border border-neutral-200 p-4">
      <div>
        <h2 className="text-lg font-bold">Inviter la famille</h2>
        <p className="text-sm text-neutral-600">
          Famille {household.name} · scanne le QR code ou partage le code ci-dessous.
        </p>
      </div>

      {qrUrl ? (
        <div className="flex justify-center">
          <img
            src={qrUrl}
            alt={`QR code pour rejoindre ${household.name}`}
            width={200}
            height={200}
            className="rounded-2xl border border-neutral-200"
          />
        </div>
      ) : null}

      <p className="rounded-2xl bg-neutral-100 px-3 py-3 text-center font-mono text-base font-bold tracking-wider select-all">
        {household.inviteCode}
      </p>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          className="min-h-11 rounded-full border border-neutral-300 bg-white px-3 text-sm font-bold"
          onClick={() => void copyText(household.inviteCode, 'code')}
        >
          {copied === 'code' ? 'Code copié' : 'Copier le code'}
        </button>
        <button
          type="button"
          className="min-h-11 rounded-full bg-violet-700 px-3 text-sm font-bold text-white"
          onClick={() => void shareLink()}
        >
          {copied === 'link' ? 'Lien copié' : 'Partager le lien'}
        </button>
      </div>
    </section>
  )
}
