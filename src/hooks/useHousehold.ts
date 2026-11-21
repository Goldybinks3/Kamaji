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
import { remindEveningTasks, showNotice } from '../lib/notify.ts'
import { notifyProfile } from '../lib/push.ts'
import { isSupabaseConfigured, supabase } from '../lib/supabase.ts'
import { openSlotsFor } from '../lib/slots.ts'
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
  addAbsence as addAbsenceApi,
  addPeriod as addPeriodApi,
  fetchAbsences,
  fetchPeriods,
  fetchRhythm,
  removeAbsence as removeAbsenceApi,
  removePeriod as removePeriodApi,
  saveRhythm as saveRhythmApi,
} from '../services/calendar.ts'
import {
  addShoppingItem as addShoppingItemApi,
  deleteMeal as deleteMealApi,
  fetchMeals,
  fetchShopping,
  removeShoppingItem as removeShoppingItemApi,
  toggleShoppingItem,
  upsertMeal as upsertMealApi,
} from '../services/meals.ts'
import { fetchDebts } from '../services/debts.ts'
import {
  fetchInbox,
  markNotDoneRpc,
  markPingRead,
  sendPing as sendPingApi,
  sendThanks as sendThanksApi,
  settlePastDays,
} from '../services/presence.ts'
import { addTemplate as addTemplateApi, fetchTemplates, prepareWeek as prepareWeekApi, removeTemplate as removeTemplateApi } from '../services/templates.ts'
import type {
  Absence,
  Assignment,
  ChoreTemplate,
  Debt,
  AvatarKey,
  CalendarPeriod,
  Energy,
  Household,
  HouseholdRhythm,
  Meal,
  MealDraft,
  MealSlot,
  Member,
  NewRequest,
  Ping,
  ProfileUpdate,
  SheetState,
  ShoppingItem,
  ThanksNote,
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
  assumedTasks: Assignment[]
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
  rhythm: HouseholdRhythm | null
  periods: CalendarPeriod[]
  absences: Absence[]
  pings: Ping[]
  thanks: ThanksNote[]
  assignments: Assignment[]
  templates: ChoreTemplate[]
  debts: Debt[]
  addTemplate: (input: {
    title: string
    effort: ChoreTemplate['effort']
    weekdays: number[]
    slot: MealSlot | null
  }) => Promise<void>
  removeTemplate: (id: string) => Promise<void>
  prepareWeek: (monday: string) => Promise<void>
  saveRhythm: (rhythm: HouseholdRhythm) => Promise<void>
  addPeriod: (input: {
    label: string
    startsOn: string
    endsOn: string
    slots: MealSlot[]
  }) => Promise<void>
  removePeriod: (id: string) => Promise<void>
  addAbsence: (input: { profileId: string; startsOn: string; endsOn: string }) => Promise<void>
  removeAbsence: (id: string) => Promise<void>
  markNotDone: (id: string) => Promise<void>
  sendPing: (toId: string, body: string) => Promise<void>
  dismissPing: (id: string) => Promise<void>
  sendThanks: (toId: string, assignmentId?: string) => Promise<void>
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
  const [rhythm, setRhythm] = useState<HouseholdRhythm | null>(null)
  const [periods, setPeriods] = useState<CalendarPeriod[]>([])
  const [absences, setAbsences] = useState<Absence[]>([])
  const [pings, setPings] = useState<Ping[]>([])
  const [thanks, setThanks] = useState<ThanksNote[]>([])
  const [templates, setTemplates] = useState<ChoreTemplate[]>([])
  const [debts, setDebts] = useState<Debt[]>([])
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
        setRhythm(null)
        setPeriods([])
        setAbsences([])
        setPings([])
        setThanks([])
        setTemplates([])
        setDebts([])
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
        setRhythm(null)
        setPeriods([])
        setAbsences([])
        setPings([])
        setThanks([])
        setTemplates([])
        setDebts([])
        setStatus('onboarding')
        return
      }

      const day = parisToday()
      try {
        await settlePastDays()
      } catch {
        // La fonction arrive avec la migration. Le foyer reste utilisable avant.
      }

      const [nextAssignments, nextMeals, nextShopping] = await Promise.all([
        fetchAssignments(state.household.id, day),
        fetchMeals(state.household.id),
        fetchShopping(state.household.id),
      ])

      setHousehold(state.household)
      setMembers(state.members)
      setAssignments(nextAssignments)
      setMeals(nextMeals)
      setShopping(nextShopping)
      setToday(day)
      setStatus('ready')

      try {
        const [nextRhythm, nextPeriods, nextAbsences, inbox] = await Promise.all([
          fetchRhythm(state.household.id),
          fetchPeriods(state.household.id),
          fetchAbsences(state.household.id),
          fetchInbox(uid),
        ])
        setRhythm(nextRhythm)
        setPeriods(nextPeriods)
        setAbsences(nextAbsences)
        setPings(inbox.pings)
        setThanks(inbox.thanks)
        setError(null)
      } catch (err) {
        setRhythm(null)
        setPeriods([])
        setAbsences([])
        setError(errorMessage(err))
      }

      try {
        setTemplates(await fetchTemplates(state.household.id))
      } catch {
        setTemplates([])
      }
      try {
        setDebts(await fetchDebts(state.household.id))
      } catch {
        setDebts([])
      }
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
          void fetchAssignments(householdId, parisToday())
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
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'household_rhythms', filter },
        () => {
          void fetchRhythm(householdId).then(setRhythm).catch(() => {})
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'calendar_periods', filter },
        () => {
          void fetchPeriods(householdId).then(setPeriods).catch(() => {})
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'absences', filter },
        () => {
          void fetchAbsences(householdId).then(setAbsences).catch(() => {})
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pings', filter },
        () => {
          if (!userId) return
          void fetchInbox(userId)
            .then((inbox) => {
              setPings(inbox.pings)
              setThanks(inbox.thanks)
              const latest = inbox.pings[0]
              if (latest && document.hidden) {
                showNotice('Kamaji', latest.body)
              }
            })
            .catch(() => {})
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'thanks', filter },
        () => {
          if (!userId) return
          void fetchInbox(userId)
            .then((inbox) => setThanks(inbox.thanks))
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
    const momentOpen = (item: Assignment) =>
      !item.slot || openSlotsFor(item.dueOn, rhythm, periods).includes(item.slot)
    const myTasks = userId
      ? assignments
          .filter((item) => item.status === 'accepted' && item.assigneeId === userId && momentOpen(item))
          .sort(compareDue)
      : []
    const proposals = userId
      ? assignments
          .filter(
            (item) =>
              item.status === 'open' &&
              item.requestedBy !== userId &&
              (item.assigneeId === null || item.assigneeId === userId) &&
              momentOpen(item),
          )
          .sort(compareDue)
      : []
    const sent = userId
      ? assignments
          .filter((item) => item.status === 'open' && item.requestedBy === userId && momentOpen(item))
          .sort(compareDue)
      : []
    const assumedTasks = assignments
      .filter((item) => item.status === 'done' && item.assumed && momentOpen(item))
      .sort((a, b) => b.dueOn.localeCompare(a.dueOn))
    const nextMeal =
      meals
        .filter(
          (meal) =>
            meal.servedOn >= today && openSlotsFor(meal.servedOn, rhythm, periods).includes(meal.slot),
        )
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
      assumedTasks,
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
          setAssignments(await fetchAssignments(household.id, today))
          try {
            setDebts(await fetchDebts(household.id))
          } catch {
            setDebts([])
          }
        })
      },
      acceptAssignment: async (id) => {
        if (!household) return
        await run(async () => {
          await acceptAssignmentRpc(id)
          setAssignments(await fetchAssignments(household.id, today))
        })
      },
      releaseAssignment: async (id) => {
        if (!household) return
        await run(async () => {
          await releaseAssignmentRpc(id)
          setSheet({ type: 'none' })
          setAssignments(await fetchAssignments(household.id, today))
        })
      },
      createRequest: async (input) => {
        if (!household || !userId) return
        if (!input.title.trim() || input.assigneeId === userId) return
        await run(async () => {
          await createRequestRpc(input)
          setSheet({ type: 'none' })
          setAssignments(await fetchAssignments(household.id, today))
          const targets = input.assigneeId
            ? [input.assigneeId]
            : members.filter((member) => member.id !== userId).map((member) => member.id)
          for (const target of targets) {
            void notifyProfile(target, 'Kamaji', input.title.trim())
          }
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
      rhythm,
      periods,
      absences,
      pings,
      thanks,
      assignments,
      templates,
      debts,
      addTemplate: async (input) => {
        if (!household) return
        await run(async () => {
          await addTemplateApi(household.id, input)
          setTemplates(await fetchTemplates(household.id))
        })
      },
      removeTemplate: async (id) => {
        if (!household) return
        await run(async () => {
          await removeTemplateApi(id)
          setTemplates(await fetchTemplates(household.id))
        })
      },
      prepareWeek: async (monday) => {
        if (!household) return
        await run(async () => {
          await prepareWeekApi(monday)
          setAssignments(await fetchAssignments(household.id, today))
        })
      },
      saveRhythm: async (next) => {
        if (!household) return
        await run(async () => {
          await saveRhythmApi(household.id, next)
          setRhythm(next)
        })
      },
      addPeriod: async (input) => {
        if (!household) return
        await run(async () => {
          await addPeriodApi(household.id, input)
          setPeriods(await fetchPeriods(household.id))
        })
      },
      removePeriod: async (id) => {
        if (!household) return
        await run(async () => {
          await removePeriodApi(id)
          setPeriods(await fetchPeriods(household.id))
        })
      },
      addAbsence: async (input) => {
        if (!household) return
        await run(async () => {
          await addAbsenceApi(household.id, input)
          setAbsences(await fetchAbsences(household.id))
        })
      },
      removeAbsence: async (id) => {
        if (!household) return
        await run(async () => {
          await removeAbsenceApi(id)
          setAbsences(await fetchAbsences(household.id))
        })
      },
      markNotDone: async (id) => {
        if (!household) return
        await run(async () => {
          await markNotDoneRpc(id)
          setSheet({ type: 'none' })
          setAssignments(await fetchAssignments(household.id, today))
          try {
            setDebts(await fetchDebts(household.id))
          } catch {
            setDebts([])
          }
        })
      },
      sendPing: async (toId, body) => {
        if (!household || !userId || !body.trim()) return
        await run(async () => {
          await sendPingApi({ householdId: household.id, fromId: userId, toId, body })
          void notifyProfile(toId, 'Kamaji', body.trim())
        })
      },
      dismissPing: async (id) => {
        await run(async () => {
          setPings((current) => current.filter((item) => item.id !== id))
          await markPingRead(id)
        })
      },
      sendThanks: async (toId, assignmentId) => {
        if (!household || !userId || toId === userId) return
        await run(async () => {
          await sendThanksApi({ householdId: household.id, fromId: userId, toId, assignmentId })
          void notifyProfile(toId, 'Kamaji', 'On t’a dit merci')
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
          setRhythm(null)
          setPeriods([])
          setAbsences([])
          setPings([])
          setThanks([])
          setTemplates([])
          setDebts([])
          setStatus('onboarding')
        })
      },
      memberById: (id) => members.find((member) => member.id === id),
      assignmentById: (id) => assignments.find((item) => item.id === id),
    }
  }, [absences, assignments, debts, error, household, meals, members, periods, pings, refreshAll, rhythm, sheet, shopping, status, templates, thanks, today, userId])

  useEffect(() => {
    if (status !== 'ready' || !userId) return
    const remaining = assignments.filter(
      (item) =>
        item.status === 'accepted' &&
        item.assigneeId === userId &&
        (!item.slot || openSlotsFor(item.dueOn, rhythm, periods).includes(item.slot)),
    ).length
    remindEveningTasks(today, remaining)
  }, [assignments, periods, rhythm, status, today, userId])

  return createElement(HouseholdContext, { value }, children)
}

export function useHousehold(): HouseholdValue {
  const value = useContext(HouseholdContext)
  if (!value) throw new Error('useHousehold doit être utilisé dans HouseholdProvider')
  return value
}
