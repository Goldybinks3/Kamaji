import { Navigate } from 'react-router'
import { AppShell } from '../../components/layout/AppShell.tsx'
import { useHousehold } from '../../hooks/useHousehold.ts'
import { OnboardingPage } from './OnboardingPage.tsx'

export function JoinRoute() {
  const { status } = useHousehold()
  if (status === 'ready') return <Navigate to="/" replace />
  if (status === 'loading') {
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-md items-center justify-center bg-white px-5 text-neutral-600">
        Chargement…
      </div>
    )
  }
  if (status === 'unconfigured') return <AppShell />
  return <OnboardingPage />
}
