import { NavLink } from 'react-router'

const tabs = [
  { to: '/', label: 'Accueil', end: true },
  { to: '/taches', label: 'Tâches', end: false },
  { to: '/repas', label: 'Repas', end: false },
  { to: '/profil', label: 'Profil', end: false },
]

export function TabBar() {
  return (
    <nav className="sticky bottom-0 z-20 mt-auto w-full bg-neutral-300 pb-[env(safe-area-inset-bottom)]">
      <ul className="grid grid-cols-4">
        {tabs.map((tab) => (
          <li key={tab.to}>
            <NavLink
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                `flex min-h-16 flex-col items-center justify-center gap-1 text-sm ${
                  isActive ? 'font-bold' : 'font-medium text-neutral-800'
                }`
              }
            >
              <TabIcon label={tab.label} />
              {tab.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}

function TabIcon({ label }: { label: string }) {
  if (label === 'Tâches') {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
        <rect x="4" y="4" width="16" height="16" rx="3" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M8 12l2.5 2.5L16 9" fill="none" stroke="currentColor" strokeWidth="2" />
      </svg>
    )
  }
  if (label === 'Repas') {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 3v8a3 3 0 0 0 3 3V21M9 3v8M18 3v18M18 3c2 2 2 5 0 7" fill="none" stroke="currentColor" strokeWidth="2" />
      </svg>
    )
  }
  if (label === 'Profil') {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="8" r="3" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M5 19c1.5-3 3.8-4 7-4s5.5 1 7 4" fill="none" stroke="currentColor" strokeWidth="2" />
      </svg>
    )
  }
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  )
}
