import { createBrowserRouter } from 'react-router'
import { AppShell } from '../components/layout/AppShell.tsx'
import { HomePage } from '../features/home/HomePage.tsx'
import { MealsPage } from '../features/meals/MealsPage.tsx'
import { JoinRoute } from '../features/onboarding/JoinRoute.tsx'
import { ProfilePage } from '../features/profile/ProfilePage.tsx'
import { TasksPage } from '../features/tasks/TasksPage.tsx'

export const router = createBrowserRouter([
  {
    path: '/rejoindre',
    element: <JoinRoute />,
  },
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'taches', element: <TasksPage /> },
      { path: 'repas', element: <MealsPage /> },
      { path: 'profil', element: <ProfilePage /> },
    ],
  },
])
