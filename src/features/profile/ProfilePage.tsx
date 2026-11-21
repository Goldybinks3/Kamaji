import { useState, type FormEvent } from 'react'
import { InviteCard } from '../../components/family/InviteCard.tsx'
import { MemberAvatar } from '../../components/family/MemberAvatar.tsx'
import { useHousehold } from '../../hooks/useHousehold.ts'
import { canNotify, requestNotifyPermission } from '../../lib/notify.ts'
import { avatarKeys, type AvatarKey, type Energy, type Member } from '../../types/domain.ts'
import { CalendarSettings } from './CalendarSettings.tsx'

const energies: { id: Energy; label: string }[] = [
  { id: 'low', label: 'Basse' },
  { id: 'ok', label: 'Ok' },
  { id: 'high', label: 'En forme' },
]

function ProfileEditForm({
  member,
  onSave,
}: {
  member: Member
  onSave: (patch: { displayName: string; phone: string; avatarKey: AvatarKey }) => Promise<void>
}) {
  const [displayName, setDisplayName] = useState(member.displayName)
  const [phone, setPhone] = useState(member.phone ?? '')
  const [avatarKey, setAvatarKey] = useState<AvatarKey>(member.avatarKey)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)

  const dirty =
    displayName.trim() !== member.displayName ||
    phone.trim() !== (member.phone ?? '') ||
    avatarKey !== member.avatarKey

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!displayName.trim() || saving) return
    setSaving(true)
    try {
      await onSave({ displayName, phone, avatarKey })
      setSaved(true)
      window.setTimeout(() => setSaved(false), 2000)
    } catch {
      // L'erreur est affichée dans AppShell
    } finally {
      setSaving(false)
    }
  }

  return (
    <form
      className="grid w-full gap-3 rounded-3xl border border-neutral-200 p-4"
      onSubmit={(event) => void submit(event)}
    >
      <h2 className="text-lg font-bold">Mes infos</h2>
      <label className="grid gap-1">
        <span className="text-sm font-bold">Prénom</span>
        <input
          type="text"
          className="min-h-11 rounded-2xl border border-neutral-300 px-3 text-base"
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          required
        />
      </label>
      <label className="grid gap-1">
        <span className="text-sm font-bold">Téléphone (optionnel)</span>
        <input
          type="tel"
          className="min-h-11 rounded-2xl border border-neutral-300 px-3 text-base"
          placeholder="06 01 02 03 04"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
        />
      </label>
      <div className="flex justify-between gap-2 pt-1">
        {avatarKeys.map((key) => {
          const selected = avatarKey === key
          return (
            <button
              key={key}
              type="button"
              aria-pressed={selected}
              aria-label={key}
              className={`rounded-full p-1 ${selected ? 'ring-2 ring-neutral-950 ring-offset-2' : 'opacity-65'}`}
              onClick={() => setAvatarKey(key)}
            >
              <MemberAvatar
                member={{ id: key, displayName: '', avatarKey: key, energy: 'ok' }}
                size={48}
              />
            </button>
          )
        })}
      </div>
      <button
        type="submit"
        disabled={!dirty || saving || !displayName.trim()}
        className="mt-1 min-h-11 rounded-full bg-green-500 font-bold text-neutral-950 disabled:opacity-50"
      >
        {saving ? 'Enregistrement…' : saved ? 'Enregistré' : 'Enregistrer'}
      </button>
    </form>
  )
}

export function ProfilePage() {
  const { currentUser, household, setEnergy, updateProfile, signOut, thanks, memberById } =
    useHousehold()
  const [confirmOut, setConfirmOut] = useState(false)
  const [notifyLabel, setNotifyLabel] = useState(() =>
    canNotify() && Notification.permission === 'granted'
      ? 'Notifications activées'
      : 'Activer les notifications',
  )

  if (!currentUser || !household) return null

  const formKey = `${currentUser.id}|${currentUser.displayName}|${currentUser.phone ?? ''}|${currentUser.avatarKey}`

  return (
    <div className="grid justify-items-start gap-6">
      <div className="flex items-center gap-4">
        <MemberAvatar member={currentUser} size={72} />
        <div>
          <h1 className="text-3xl font-bold">{currentUser.displayName}</h1>
          <p className="text-sm text-neutral-600">{household.name}</p>
        </div>
      </div>

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
                  active
                    ? 'border-neutral-950 bg-neutral-950 text-white'
                    : 'border-neutral-300 bg-white'
                }`}
                onClick={() => void setEnergy(energy.id).catch(() => {})}
              >
                {energy.label}
              </button>
            )
          })}
        </div>
        <p className="text-sm text-neutral-600">
          Enregistré pour le tirage de la semaine. Visible seulement par toi.
        </p>
      </section>

      <InviteCard household={household} />

      <CalendarSettings />

      {thanks.length > 0 ? (
        <section className="grid w-full gap-2">
          <h2 className="text-lg font-bold">Mercis</h2>
          {thanks.map((item) => (
            <p key={item.id} className="rounded-2xl bg-neutral-100 px-4 py-3 text-sm">
              {memberById(item.fromProfileId)?.displayName ?? 'Quelqu’un'} t’a dit merci
              {item.note ? ` : ${item.note}` : '.'}
            </p>
          ))}
        </section>
      ) : null}

      <section className="grid w-full gap-2">
        <h2 className="text-lg font-bold">Notifications</h2>
        <p className="text-sm text-neutral-600">
          Un rappel après 17 h si des tâches restent, et un message quand quelqu’un t’écrit pendant
          que Kamaji est ouvert. Sur iPhone, ajoute d’abord Kamaji à l’écran d’accueil depuis Safari.
        </p>
        <button
          type="button"
          className="min-h-11 rounded-full border border-neutral-300 font-bold"
          onClick={() => {
            void requestNotifyPermission().then((result) => {
              setNotifyLabel(
                result === 'granted' ? 'Notifications activées' : 'Notifications refusées',
              )
            })
          }}
        >
          {notifyLabel}
        </button>
      </section>

      <ProfileEditForm key={formKey} member={currentUser} onSave={updateProfile} />

      <div className="w-full pt-2">
        {confirmOut ? (
          <div className="grid gap-2 rounded-3xl border border-neutral-300 p-4">
            <p className="text-sm text-neutral-700">
              Tu pourras rejoindre de nouveau avec le code famille.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                className="min-h-11 rounded-full border border-neutral-300 font-bold"
                onClick={() => setConfirmOut(false)}
              >
                Annuler
              </button>
              <button
                type="button"
                className="min-h-11 rounded-full bg-neutral-950 font-bold text-white"
                onClick={() => void signOut().catch(() => {})}
              >
                Se déconnecter
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="min-h-11 w-full rounded-full border border-neutral-300 font-bold text-neutral-700"
            onClick={() => setConfirmOut(true)}
          >
            Se déconnecter de cet appareil
          </button>
        )}
      </div>
    </div>
  )
}
