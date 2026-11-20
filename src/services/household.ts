import { requireSupabase } from '../lib/supabase.ts'
import type { AvatarKey, Energy, Household, Member, ProfileUpdate } from '../types/domain.ts'

type HouseholdRow = {
  id: string
  name: string
  timezone: string
  invite_code: string
}

type ProfileRow = {
  id: string
  household_id: string
  display_name: string
  avatar_key: string
  phone: string | null
  energy: Energy
}

function toAvatarKey(value: string): AvatarKey {
  if (value === 'carre' || value === 'triangle' || value === 'etoile') return value
  return 'cercle'
}

export function mapHousehold(row: HouseholdRow): Household {
  return {
    id: row.id,
    name: row.name,
    timezone: row.timezone,
    inviteCode: row.invite_code,
  }
}

export function mapMember(row: ProfileRow): Member {
  return {
    id: row.id,
    displayName: row.display_name,
    avatarKey: toAvatarKey(row.avatar_key),
    phone: row.phone ?? undefined,
    energy: row.energy,
  }
}

function humanizeAuthError(message: string): string {
  const lower = message.toLowerCase()
  if (lower.includes('anonymous sign-ins are disabled')) {
    return 'Active « Anonymous Sign-Ins » dans Supabase (Authentication → Providers → Anonymous Sign-Ins).'
  }
  return message
}

export async function getSessionUserId(): Promise<string | null> {
  const client = requireSupabase()
  const { data, error } = await client.auth.getSession()
  if (error) throw new Error(humanizeAuthError(error.message))
  return data.session?.user.id ?? null
}

export async function ensureAnonymousSession(): Promise<string> {
  const client = requireSupabase()
  const existing = await getSessionUserId()
  if (existing) return existing

  const { data, error } = await client.auth.signInAnonymously()
  if (error) throw new Error(humanizeAuthError(error.message))
  if (!data.user) throw new Error('Impossible d’ouvrir une session sur cet appareil.')
  return data.user.id
}

export async function loadHouseholdState(userId: string): Promise<{
  household: Household | null
  members: Member[]
}> {
  const client = requireSupabase()
  const { data: myProfile, error: profileError } = await client
    .from('profiles')
    .select('id, household_id, display_name, avatar_key, phone, energy')
    .eq('id', userId)
    .maybeSingle()

  if (profileError) throw new Error(profileError.message)
  if (!myProfile) return { household: null, members: [] }

  const [householdRes, membersRes] = await Promise.all([
    client
      .from('households')
      .select('id, name, timezone, invite_code')
      .eq('id', myProfile.household_id)
      .single(),
    client
      .from('profiles')
      .select('id, household_id, display_name, avatar_key, phone, energy')
      .eq('household_id', myProfile.household_id)
      .order('created_at', { ascending: true }),
  ])

  if (householdRes.error) throw new Error(householdRes.error.message)
  if (membersRes.error) throw new Error(membersRes.error.message)

  return {
    household: mapHousehold(householdRes.data as HouseholdRow),
    members: ((membersRes.data ?? []) as ProfileRow[]).map(mapMember),
  }
}

export async function createHousehold(input: {
  familyName: string
  displayName: string
  avatarKey: AvatarKey
}): Promise<string> {
  const client = requireSupabase()
  const userId = await ensureAnonymousSession()

  const { data, error } = await client.rpc('create_household', {
    p_name: input.familyName.trim(),
    p_display_name: input.displayName.trim(),
  })
  if (error) throw new Error(error.message)

  if (input.avatarKey !== 'cercle') {
    const { error: updateError } = await client
      .from('profiles')
      .update({ avatar_key: input.avatarKey })
      .eq('id', userId)
    if (updateError) throw new Error(updateError.message)
  }

  return data as string
}

export async function joinHousehold(input: {
  code: string
  displayName: string
  avatarKey: AvatarKey
}): Promise<string> {
  const client = requireSupabase()
  const userId = await ensureAnonymousSession()

  const { data, error } = await client.rpc('join_household', {
    p_code: input.code.trim(),
    p_display_name: input.displayName.trim(),
  })
  if (error) throw new Error(error.message)

  if (input.avatarKey !== 'cercle') {
    const { error: updateError } = await client
      .from('profiles')
      .update({ avatar_key: input.avatarKey })
      .eq('id', userId)
    if (updateError) throw new Error(updateError.message)
  }

  return data as string
}

export async function updateSelfProfile(userId: string, patch: ProfileUpdate): Promise<void> {
  const client = requireSupabase()
  const payload: Record<string, string | null> = {}
  if (patch.displayName !== undefined) payload.display_name = patch.displayName.trim()
  if (patch.avatarKey !== undefined) payload.avatar_key = patch.avatarKey
  if (patch.phone !== undefined) {
    const clean = patch.phone?.trim() ?? ''
    payload.phone = clean.length > 0 ? clean : null
  }

  const { error } = await client.from('profiles').update(payload).eq('id', userId)
  if (error) throw new Error(error.message)
}

export async function updateSelfEnergy(
  userId: string,
  householdId: string,
  energy: Energy,
): Promise<void> {
  const client = requireSupabase()
  const { error } = await client
    .from('profiles')
    .update({ energy, energy_set_at: new Date().toISOString() })
    .eq('id', userId)
  if (error) throw new Error(error.message)

  await client.from('energy_checkins').insert({
    household_id: householdId,
    profile_id: userId,
    energy,
  })
}

export async function signOutDevice(): Promise<void> {
  const client = requireSupabase()
  const { error } = await client.auth.signOut()
  if (error) throw new Error(error.message)
}
