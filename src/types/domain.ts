export type Energy = 'low' | 'ok' | 'high'

export type AvatarKey = 'cercle' | 'carre' | 'triangle' | 'etoile'

export const avatarKeys: AvatarKey[] = ['cercle', 'carre', 'triangle', 'etoile']

export type AssignmentKind = 'rotation' | 'request' | 'offer' | 'paid'

export type AssignmentStatus = 'open' | 'accepted' | 'done' | 'missed' | 'cancelled'

export type Household = {
  id: string
  name: string
  timezone: string
  inviteCode: string
}

export type Member = {
  id: string
  displayName: string
  avatarKey: AvatarKey
  phone?: string
  energy: Energy
}

export type Assignment = {
  id: string
  title: string
  details?: string
  kind: AssignmentKind
  status: AssignmentStatus
  assigneeId: string | null
  requestedBy: string | null
  dueOn: string
  dueTime?: string
  priceCents?: number | null
}

export type MealSlot = 'lunch' | 'dinner'

export type Meal = {
  id: string
  servedOn: string
  slot: MealSlot
  title: string
  cookId: string | null
}

export type ShoppingItem = {
  id: string
  label: string
  done: boolean
}

export type NewRequest = {
  title: string
  assigneeId: string | null
  dueOn: string
  dueTime?: string | null
  priceCents: number | null
}

export type MealDraft = {
  servedOn: string
  slot: MealSlot
  title: string
  cookId: string | null
}

export type ProfileUpdate = {
  displayName?: string
  avatarKey?: AvatarKey
  phone?: string | null
}

export type SheetState =
  | { type: 'none' }
  | { type: 'member'; memberId: string }
  | { type: 'request'; assigneeId: string | null }
  | { type: 'detail'; assignmentId: string }
