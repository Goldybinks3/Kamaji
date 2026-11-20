import { Outlet } from 'react-router'
import { OnboardingPage } from '../../features/onboarding/OnboardingPage.tsx'
import { useHousehold } from '../../hooks/useHousehold.ts'
import { MemberSheet } from '../family/MemberSheet.tsx'
import { RequestSheet } from '../requests/RequestSheet.tsx'
import { TaskDetailSheet } from '../tasks/TaskDetailSheet.tsx'
import { TabBar } from './TabBar.tsx'

export function AppShell() {
  const { status, error, clearError, sheet } = useHousehold()

  if (status === 'unconfigured') {
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-4 bg-white px-5 py-8 text-neutral-950">
        <h1 className="text-3xl font-bold">Kamaji</h1>
        <p className="text-neutral-700">
          Les variables Supabase ne sont pas encore configurées sur cet environnement.
        </p>
        <ol className="grid list-decimal gap-2 pl-5 text-sm text-neutral-700">
          <li>
            Copie <code className="font-mono">.env.example</code> en{' '}
            <code className="font-mono">.env.local</code> à la racine du projet.
          </li>
          <li>
            Renseigne <code className="font-mono">VITE_SUPABASE_URL</code> et{' '}
            <code className="font-mono">VITE_SUPABASE_ANON_KEY</code>.
          </li>
          <li>
            Relance <code className="font-mono">npm run dev</code> (ou redéploie sur Vercel après
            les avoir ajoutées).
          </li>
        </ol>
      </div>
    )
  }

  if (status === 'loading') {
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-md items-center justify-center bg-white px-5 text-neutral-600">
        Chargement…
      </div>
    )
  }

  if (status === 'onboarding') {
    return <OnboardingPage />
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-white text-neutral-950">
      <main className="flex-1 px-4 pt-6 pb-4">
        {error ? (
          <div
            role="alert"
            className="mb-4 flex items-start justify-between gap-3 rounded-2xl bg-red-100 px-4 py-3 text-sm text-red-900"
          >
            <span>{error}</span>
            <button type="button" className="font-bold" onClick={clearError} aria-label="Fermer">
              ×
            </button>
          </div>
        ) : null}
        <Outlet />
      </main>
      <TabBar />
      {sheet.type === 'member' ? <MemberSheet memberId={sheet.memberId} /> : null}
      {sheet.type === 'request' ? (
        <RequestSheet key={sheet.assigneeId ?? 'all'} assigneeId={sheet.assigneeId} />
      ) : null}
      {sheet.type === 'detail' ? <TaskDetailSheet assignmentId={sheet.assignmentId} /> : null}
    </div>
  )
}
