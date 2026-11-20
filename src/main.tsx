import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { router } from './app/router.tsx'
import { HouseholdProvider } from './hooks/useHousehold.ts'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HouseholdProvider>
      <RouterProvider router={router} />
    </HouseholdProvider>
  </StrictMode>,
)
