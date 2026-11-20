import { ProposalCard } from '../../components/tasks/ProposalCard.tsx'
import { TaskCard } from '../../components/tasks/TaskCard.tsx'
import { useHousehold } from '../../hooks/useHousehold.ts'

export function TasksPage() {
  const { myTasks, proposals, sent, today, completeAssignment, openDetail, openRequest, memberById } =
    useHousehold()

  return (
    <div className="grid gap-6">
      <h1 className="text-3xl font-bold">Tâches</h1>
      <section className="grid gap-3">
        <h2 className="text-lg font-bold">Mes tâches</h2>
        {myTasks.slice(0, 3).map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            today={today}
            onDone={() => void completeAssignment(task.id).catch(() => {})}
            onOpen={() => openDetail(task.id)}
          />
        ))}
        {myTasks.length === 0 ? <p>Rien à faire pour le moment.</p> : null}
      </section>
      <section className="grid gap-3">
        <h2 className="text-lg font-bold">Propositions</h2>
        {proposals.map((task) => (
          <ProposalCard key={task.id} task={task} today={today} />
        ))}
        {proposals.length === 0 ? <p>Aucune proposition.</p> : null}
      </section>
      {sent.length > 0 ? (
        <section className="grid gap-2">
          <h2 className="text-lg font-bold">Envoyées</h2>
          {sent.map((task) => {
            const person = memberById(task.assigneeId)
            return (
              <p key={task.id} className="rounded-2xl bg-neutral-100 px-4 py-3">
                {task.title}
                {person ? ` · pour ${person.displayName}` : ' · pour tout le monde'}
              </p>
            )
          })}
        </section>
      ) : null}
      <div className="flex flex-col items-center pt-2">
        <p className="text-sm text-neutral-600">Demander</p>
        <button
          type="button"
          className="mt-2 flex h-16 w-16 items-center justify-center rounded-full border-2 border-neutral-500 text-4xl leading-none"
          aria-label="Demander un service"
          onClick={() => openRequest(null)}
        >
          +
        </button>
      </div>
    </div>
  )
}
