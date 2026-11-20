import { useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { MemberAvatar } from '../../components/family/MemberAvatar.tsx'
import { useHousehold } from '../../hooks/useHousehold.ts'
import { avatarKeys, type AvatarKey } from '../../types/domain.ts'

export function OnboardingPage() {
  const { createHousehold, joinHousehold, error, clearError } = useHousehold()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const initialCode = searchParams.get('code')?.trim() ?? ''
  const [mode, setMode] = useState<'create' | 'join'>(initialCode ? 'join' : 'create')
  const [familyName, setFamilyName] = useState('')
  const [code, setCode] = useState(initialCode)
  const [displayName, setDisplayName] = useState('')
  const [avatarKey, setAvatarKey] = useState<AvatarKey>('cercle')
  const [busy, setBusy] = useState(false)

  const canSubmit =
    !busy &&
    displayName.trim().length > 0 &&
    (mode === 'create' ? familyName.trim().length > 0 : code.trim().length >= 6)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!canSubmit) return
    setBusy(true)
    try {
      if (mode === 'create') {
        await createHousehold({ familyName, displayName, avatarKey })
      } else {
        await joinHousehold({ code, displayName, avatarKey })
      }
      navigate('/', { replace: true })
    } catch {
      // L'erreur est déjà affichée via useHousehold().error
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center bg-white px-5 py-8 text-neutral-950">
      <h1 className="text-3xl font-bold">Kamaji</h1>
      <p className="mt-1 text-neutral-600">
        Crée ta famille avec un code sécurisé, ou rejoins celle qui existe déjà.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-2 rounded-full bg-neutral-100 p-1">
        <button
          type="button"
          className={`min-h-11 rounded-full text-sm font-bold ${
            mode === 'create' ? 'bg-neutral-950 text-white' : 'text-neutral-700'
          }`}
          onClick={() => {
            clearError()
            setMode('create')
          }}
        >
          Créer une famille
        </button>
        <button
          type="button"
          className={`min-h-11 rounded-full text-sm font-bold ${
            mode === 'join' ? 'bg-neutral-950 text-white' : 'text-neutral-700'
          }`}
          onClick={() => {
            clearError()
            setMode('join')
          }}
        >
          Rejoindre
        </button>
      </div>

      <form className="mt-6 grid gap-4" onSubmit={(event) => void onSubmit(event)}>
        {mode === 'create' ? (
          <label className="grid gap-1.5">
            <span className="text-sm font-bold">Nom de la famille</span>
            <input
              type="text"
              className="min-h-11 rounded-2xl border border-neutral-300 px-4 text-base"
              placeholder="Ex. Maison Martin"
              value={familyName}
              onChange={(event) => setFamilyName(event.target.value)}
              autoComplete="organization"
              required
            />
          </label>
        ) : (
          <label className="grid gap-1.5">
            <span className="text-sm font-bold">Code famille</span>
            <input
              type="text"
              className="min-h-11 rounded-2xl border border-neutral-300 px-4 font-mono text-base uppercase"
              placeholder="XXXX-XXXX-XXXX-XXXX"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              required
            />
          </label>
        )}

        <label className="grid gap-1.5">
          <span className="text-sm font-bold">Ton prénom</span>
          <input
            type="text"
            className="min-h-11 rounded-2xl border border-neutral-300 px-4 text-base"
            placeholder="Ex. Eden"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            autoComplete="given-name"
            required
          />
        </label>

        <fieldset className="grid gap-2">
          <legend className="text-sm font-bold">Ton icône</legend>
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
                    size={56}
                  />
                </button>
              )
            })}
          </div>
        </fieldset>

        {error ? (
          <p role="alert" className="rounded-2xl bg-red-100 px-4 py-3 text-sm text-red-900">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={!canSubmit}
          className="mt-2 min-h-12 rounded-full bg-green-500 font-bold text-neutral-950 disabled:opacity-50"
        >
          {busy
            ? 'Connexion...'
            : mode === 'create'
              ? 'Créer la famille'
              : 'Rejoindre la famille'}
        </button>
      </form>
    </div>
  )
}
