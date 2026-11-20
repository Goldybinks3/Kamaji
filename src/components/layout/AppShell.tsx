import { Outlet } from 'react-router'
import { useHousehold } from '../../hooks/useHousehold.ts'
import { MemberSheet } from '../family/MemberSheet.tsx'
import { RequestSheet } from '../requests/RequestSheet.tsx'
import { TaskDetailSheet } from '../tasks/TaskDetailSheet.tsx'
import { TabBar } from './TabBar.tsx'

export function AppShell() {
  const { sheet } = useHousehold()

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-white text-neutral-950">
      <main className="flex-1 px-4 pt-6 pb-4">
        <Outlet />
      </main>
      <TabBar />
      {sheet.type === 'member' ? <MemberSheet memberId={sheet.memberId} /> : null}
      {sheet.type === 'request' ? <RequestSheet key={sheet.assigneeId ?? 'all'} assigneeId={sheet.assigneeId} /> : null}
      {sheet.type === 'detail' ? <TaskDetailSheet assignmentId={sheet.assignmentId} /> : null}
    </div>
  )
}
