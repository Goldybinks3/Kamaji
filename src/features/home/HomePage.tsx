import { MemberAvatar } from '../../components/family/MemberAvatar.tsx'
import { NextMealCard } from '../../components/meals/NextMealCard.tsx'
import { ProposalCard } from '../../components/tasks/ProposalCard.tsx'
import { TaskCard } from '../../components/tasks/TaskCard.tsx'
import { useHousehold } from '../../hooks/useHousehold.ts'

export function HomePage() {
  const { currentUser, myTasks, proposals, others, today, completeAssignment, openDetail, openMember } =
    useHousehold()
  const task = myTasks[0]
  const proposal = proposals[0]

  return (
    <div className="grid gap-6">
      <h1 className="text-3xl font-bold">{currentUser.displayName}</h1>
      {task ? (
        <TaskCard
          task={task}
          today={today}
          onDone={() => completeAssignment(task.id)}
          onOpen={() => openDetail(task.id)}
        />
      ) : (
        <p className="rounded-[2rem] bg-neutral-100 px-4 py-6 text-center">Rien à faire pour le moment.</p>
      )}
      {proposal ? <ProposalCard task={proposal} today={today} /> : null}
      <NextMealCard />
      <section>
        <h2 className="mb-4 text-lg font-bold">Profils de la famille</h2>
        <ul className="flex justify-between">
          {others.map((member) => (
            <li key={member.id}>
              <button
                type="button"
                className="flex min-h-11 flex-col items-center gap-2"
                onClick={() => openMember(member.id)}
              >
                <MemberAvatar member={member} />
                <span className="text-sm">{member.displayName}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
