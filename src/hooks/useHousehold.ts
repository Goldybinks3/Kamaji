import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { parisToday } from '../lib/dates.ts'
import { isSupabaseConfigured, supabase } from '../lib/supabase.ts'
import {
  acceptAssignmentRpc,
  completeAssignmentRpc,
  createRequestRpc,
  fetchAssignments,
  releaseAssignmentRpc,
} from '../services/assignments.ts'
import {
  createHousehold as createHouseholdApi,
  getSessionUserId,
  joinHousehold as joinHouseholdApi,
  loadHouseholdState,
  signOutDevice,
  updateSelfEnergy,
  updateSelfProfile,
} from '../services/household.ts'
import {
  addShoppingItem as addShoppingItemApi,
  deleteMeal as deleteMealApi,
  fetchMeals,
  fetchShopping,
  removeShoppingItem as removeShoppingItemApi,
  toggleShoppingItem,
  upsertMeal as upsertMealApi,
} from '../services/meals.ts'
import type {
  Assignment,
  AvatarKey,
  Energy,
  Household,
  Meal,
  MealDraft,
  Member,
  NewRequest,
  ProfileUpdate,
  SheetState,
  ShoppingItem,
} from '../types/domain.ts'

export type AppStatus = 'unconfigured' | 'loading' | 'onboarding' | 'ready'

type HouseholdValue = {
  status: AppStatus
  error: string | null
  clearError: () => void
  today: string
  household: Household | null
  currentUser: Member | null
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
  createHousehold: (input: {
    familyName: string
    displayName: string
    avatarKey: AvatarKey
  }) => Promise<void>
  joinHousehold: (input: {
    code: string
    displayName: string
    avatarKey: AvatarKey
  }) => Promise<void>
  updateProfile: (patch: ProfileUpdate) => Promise<void>
  completeAssignment: (id: string) => Promise<void>
  acceptAssignment: (id: string) => Promise<void>
  releaseAssignment: (id: string) => Promise<void>
  createRequest: (input: NewRequest) => Promise<void>
  setEnergy: (energy: Energy) => Promise<void>
  addShopping: (label: string) => Promise<void>
  toggleShopping: (id: string) => Promise<void>
  removeShopping: (id: string) => Promise<void>
  saveMeal: (draft: MealDraft) => Promise<void>
  removeMeal: (id: string) => Promise<void>
  signOut: () => Promise<void>
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

function errorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message
  return 'Une erreur est survenue.'
}

export function HouseholdProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AppStatus>(
    isSupabaseConfigured ? 'loading' : 'unconfigured',
  )
  const [error, setError] = useState<string | null>(null)
  const [today, setToday] = useState<string>(() => parisToday())
  const [userId, setUserId] = useState<string | null>(null)
  const [household, setHousehold] = useState<Household | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [meals, setMeals] = useState<Meal[]>([])
  const [shopping, setShopping] = useState<ShoppingItem[]>([])
  const [sheet, setSheet] = useState<SheetState>({ type: 'none' })

  const refreshAll = useCallback(async () => {
    if (!isSupabaseConfigured) return
    try {
      const uid = await getSessionUserId()
      setUserId(uid)
      if (!uid) {
        setHousehold(null)
        setMembers([])
        setAssignments([])
        setMeals([])
        setShopping([])
        setStatus('onboarding')
        return
      }

      const state = await loadHouseholdState(uid)
      if (!state.household) {
        setHousehold(null)
        setMembers([])
        setAssignments([])
        setMeals([])
        setShopping([])
        setStatus('onboarding')
        return
      }

      const [nextAssignments, nextMeals, nextShopping] = await Promise.all([
        fetchAssignments(state.household.id),
        fetchMeals(state.household.id),
        fetchShopping(state.household.id),
      ])

      setHousehold(state.household)
      setMembers(state.members)
      setAssignments(nextAssignments)
      setMeals(nextMeals)
      setShopping(nextShopping)
      setError(null)
      setStatus('ready')
    } catch (err) {
      setError(errorMessage(err))
      setStatus('onboarding')
    }
  }, [])

  useEffect(() => {
    if (!isSupabaseConfigured) return
    const timer = window.setTimeout(() => {
      void refreshAll()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [refreshAll])

  useEffect(() => {
    function syncDate() {
      setToday(parisToday())
    }
    document.addEventListener('visibilitychange', syncDate)
    return () => document.removeEventListener('visibilitychange', syncDate)
  }, [])

  useEffect(() => {
    if (!supabase || !household?.id || !userId) return
    const householdId = household.id
    const filter = `household_id=eq.${householdId}`

    const channel = supabase
      .channel(`household:${householdId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles', filter },
        () => {
          void loadHouseholdState(userId)
            .then((state) => {
              if (state.household) setHousehold(state.household)
              setMembers(state.members)
            })
            .catch(() => {})
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'assignments', filter },
        () => {
          void fetchAssignments(householdId)
            .then(setAssignments)
            .catch(() => {})
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'meals', filter },
        () => {
          void fetchMeals(householdId)
            .then(setMeals)
            .catch(() => {})
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'shopping_items', filter },
        () => {
          void fetchShopping(householdId)
            .then(setShopping)
            .catch(() => {})
        },
      )
      .subscribe()

    return () => {
      void supabase?.removeChannel(channel)
    }
  }, [household?.id, userId])

  const value = useMemo<HouseholdValue>(() => {
    const currentUser = userId ? (members.find((member) => member.id === userId) ?? null) : null
    const myTasks = userId
      ? assignments
          .filter((item) => item.status === 'accepted' && item.assigneeId === userId)
          .sort(compareDue)
      : []
    const proposals = userId
      ? assignments
          .filter(
            (item) =>
              item.status === 'open' &&
              item.requestedBy !== userId &&
              (item.assigneeId === null || item.assigneeId === userId),
          )
          .sort(compareDue)
      : []
    const sent = userId
      ? assignments
          .filter((item) => item.status === 'open' && item.requestedBy === userId)
          .sort(compareDue)
      : []
    const nextMeal =
      meals
        .filter((meal) => meal.servedOn >= today)
        .sort(
          (a, b) =>
            a.servedOn.localeCompare(b.servedOn) || slotOrder[a.slot] - slotOrder[b.slot],
        )[0] ?? null

    async function run(action: () => Promise<void>) {
      setError(null)
      try {
        await action()
      } catch (err) {
        const message = errorMessage(err)
        setError(message)
        throw new Error(message)
      }
    }

    return {
      status,
      error,
      clearError: () => setError(null),
      today,
      household,
      currentUser,
      members,
      others: userId ? members.filter((member) => member.id !== userId) : [],
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
      createHousehold: async (input) => {
        await run(async () => {
          await createHouseholdApi(input)
          await refreshAll()
        })
      },
      joinHousehold: async (input) => {
        await run(async () => {
          await joinHouseholdApi(input)
          await refreshAll()
        })
      },
      updateProfile: async (patch) => {
        if (!userId) return
        await run(async () => {
          await updateSelfProfile(userId, patch)
          const state = await loadHouseholdState(userId)
          setMembers(state.members)
        })
      },
      completeAssignment: async (id) => {
        if (!household) return
        await run(async () => {
          await completeAssignmentRpc(id)
          setSheet((current) =>
            current.type === 'detail' && current.assignmentId === id ? { type: 'none' } : current,
          )
          setAssignments(await fetchAssignments(household.id))
        })
      },
      acceptAssignment: async (id) => {
        if (!household) return
        await run(async () => {
          await acceptAssignmentRpc(id)
          setAssignments(await fetchAssignments(household.id))
        })
      },
      releaseAssignment: async (id) => {
        if (!household) return
        await run(async () => {
          await releaseAssignmentRpc(id)
          setSheet({ type: 'none' })
          setAssignments(await fetchAssignments(household.id))
        })
      },
      createRequest: async (input) => {
        if (!household || !userId) return
        if (!input.title.trim() || input.assigneeId === userId) return
        await run(async () => {
          await createRequestRpc(input)
          setSheet({ type: 'none' })
          setAssignments(await fetchAssignments(household.id))
        })
      },
      setEnergy: async (energy) => {
        if (!userId || !household) return
        await run(async () => {
          setMembers((current) =>
            current.map((member) => (member.id === userId ? { ...member, energy } : member)),
          )
          await updateSelfEnergy(userId, household.id, energy)
        })
      },
      addShopping: async (label) => {
        if (!household || !userId || !label.trim()) return
        await run(async () => {
          await addShoppingItemApi(household.id, userId, label)
          setShopping(await fetchShopping(household.id))
        })
      },
      toggleShopping: async (id) => {
        if (!household) return
        const target = shopping.find((item) => item.id === id)
        if (!target) return
        const nextDone = !target.done
        await run(async () => {
          setShopping((current) =>
            current.map((item) => (item.id === id ? { ...item, done: nextDone } : item)),
          )
          await toggleShoppingItem(id, nextDone)
        })
      },
      removeShopping: async (id) => {
        if (!household) return
        await run(async () => {
          setShopping((current) => current.filter((item) => item.id !== id))
          await removeShoppingItemApi(id)
        })
      },
      saveMeal: async (draft) => {
        if (!household || !draft.title.trim()) return
        await run(async () => {
          await upsertMealApi(household.id, draft)
          setMeals(await fetchMeals(household.id))
        })
      },
      removeMeal: async (id) => {
        if (!household) return
        await run(async () => {
          await deleteMealApi(id)
          setMeals(await fetchMeals(household.id))
        })
      },
      signOut: async () => {
        await run(async () => {
          await signOutDevice()
          setSheet({ type: 'none' })
          setUserId(null)
          setHousehold(null)
          setMembers([])
          setAssignments([])
          setMeals([])
          setShopping([])
          setStatus('onboarding')
        })
      },
      memberById: (id) => members.find((member) => member.id === id),
      assignmentById: (id) => assignments.find((item) => item.id === id),
    }
  }, [assignments, error, household, meals, members, refreshAll, sheet, shopping, status, today, userId])

  return createElement(HouseholdContext, { value }, children)
}

export function useHousehold(): HouseholdValue {
  const value = useContext(HouseholdContext)
  if (!value) throw new Error('useHousehold doit être utilisé dans HouseholdProvider')
  return value
}
