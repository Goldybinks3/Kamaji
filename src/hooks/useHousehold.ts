import { createContext, createElement, useContext, useMemo, useState, type ReactNode } from 'react'
import { currentUserId, createInitialState } from '../data/mock.ts'
import type {
  Assignment,
  Energy,
  Meal,
  Member,
  NewRequest,
  SheetState,
  ShoppingItem,
} from '../types/domain.ts'

type HouseholdValue = {
  today: string
  currentUser: Member
  members: Member[]
  others: Member[]
  myTasks: Assignment[]
  proposals: Assignment[]
  sent: Assignment[]
  meals: Meal[]
  nextMeal: Meal | null
  shopping: ShoppingItem[]
  sheet: SheetState
  openMember: (memberId: string) => void
  openRequest: (assigneeId: string | null) => void
  openDetail: (assignmentId: string) => void
  closeSheet: () => void
  completeAssignment: (id: string) => void
  acceptAssignment: (id: string) => void
  releaseAssignment: (id: string) => void
  createRequest: (input: NewRequest) => void
  setEnergy: (energy: Energy) => void
  toggleShopping: (id: string) => void
  memberById: (id: string | null) => Member | undefined
  assignmentById: (id: string) => Assignment | undefined
}

const HouseholdContext = createContext<HouseholdValue | null>(null)

const slotOrder = { lunch: 0, dinner: 1 }

function compareDue(a: Assignment, b: Assignment): number {
  const byDate = a.dueOn.localeCompare(b.dueOn)
  if (byDate !== 0) return byDate
  return (a.dueTime ?? '99:99').localeCompare(b.dueTime ?? '99:99')
}

export function HouseholdProvider({ children }: { children: ReactNode }) {
  const [initial] = useState(createInitialState)
  const [members, setMembers] = useState(initial.members)
  const [assignments, setAssignments] = useState(initial.assignments)
  const [meals] = useState(initial.meals)
  const [shopping, setShopping] = useState(initial.shopping)
  const [sheet, setSheet] = useState<SheetState>({ type: 'none' })
  const today = initial.today

  const value = useMemo<HouseholdValue>(() => {
    const currentUser = members.find((member) => member.id === currentUserId) ?? members[0]
    const myTasks = assignments
      .filter((item) => item.status === 'accepted' && item.assigneeId === currentUserId)
      .sort(compareDue)
    const proposals = assignments
      .filter(
        (item) =>
          item.status === 'open' &&
          item.requestedBy !== currentUserId &&
          (item.assigneeId === null || item.assigneeId === currentUserId),
      )
      .sort(compareDue)
    const sent = assignments
      .filter((item) => item.status === 'open' && item.requestedBy === currentUserId)
      .sort(compareDue)
    const nextMeal =
      meals
        .filter((meal) => meal.servedOn >= today)
        .sort(
          (a, b) =>
            a.servedOn.localeCompare(b.servedOn) || slotOrder[a.slot] - slotOrder[b.slot],
        )[0] ?? null

    return {
      today,
      currentUser,
      members,
      others: members.filter((member) => member.id !== currentUserId),
      myTasks,
      proposals,
      sent,
      meals,
      nextMeal,
      shopping,
      sheet,
      openMember: (memberId) => setSheet({ type: 'member', memberId }),
      openRequest: (assigneeId) => setSheet({ type: 'request', assigneeId }),
      openDetail: (assignmentId) => setSheet({ type: 'detail', assignmentId }),
      closeSheet: () => setSheet({ type: 'none' }),
      completeAssignment: (id) => {
        setAssignments((current) =>
          current.map((item) =>
            item.id === id && item.assigneeId === currentUserId && item.status === 'accepted'
              ? { ...item, status: 'done' }
              : item,
          ),
        )
        setSheet((current) =>
          current.type === 'detail' && current.assignmentId === id ? { type: 'none' } : current,
        )
      },
      acceptAssignment: (id) => {
        setAssignments((current) =>
          current.map((item) => {
            if (item.id !== id || item.status !== 'open' || item.requestedBy === currentUserId) {
              return item
            }
            if (item.assigneeId !== null && item.assigneeId !== currentUserId) return item
            return { ...item, assigneeId: currentUserId, status: 'accepted' }
          }),
        )
      },
      releaseAssignment: (id) => {
        setAssignments((current) =>
          current.map((item) => {
            if (item.id !== id || item.assigneeId !== currentUserId || item.status !== 'accepted') {
              return item
            }
            return {
              ...item,
              assigneeId: null,
              status: 'open',
              kind: item.kind === 'paid' ? 'paid' : 'offer',
            }
          }),
        )
        setSheet({ type: 'none' })
      },
      createRequest: (input) => {
        const title = input.title.trim()
        if (!title || input.assigneeId === currentUserId) return
        const kind = input.priceCents != null ? 'paid' : input.assigneeId ? 'request' : 'offer'
        setAssignments((current) => [
          ...current,
          {
            id: crypto.randomUUID(),
            title,
            kind,
            status: 'open',
            assigneeId: input.assigneeId,
            requestedBy: currentUserId,
            dueOn: input.dueOn,
            priceCents: input.priceCents,
          },
        ])
        setSheet({ type: 'none' })
      },
      setEnergy: (energy) => {
        setMembers((current) =>
          current.map((member) =>
            member.id === currentUserId ? { ...member, energy } : member,
          ),
        )
      },
      toggleShopping: (id) => {
        setShopping((current) =>
          current.map((item) => (item.id === id ? { ...item, done: !item.done } : item)),
        )
      },
      memberById: (id) => members.find((member) => member.id === id),
      assignmentById: (id) => assignments.find((item) => item.id === id),
    }
  }, [assignments, meals, members, sheet, shopping, today])

  return createElement(HouseholdContext, { value }, children)
}

export function useHousehold(): HouseholdValue {
  const value = useContext(HouseholdContext)
  if (!value) throw new Error('useHousehold doit être utilisé dans HouseholdProvider')
  return value
}
