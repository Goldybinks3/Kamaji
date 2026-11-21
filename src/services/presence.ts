import { requireSupabase } from '../lib/supabase.ts'
import type { Ping, ThanksNote } from '../types/domain.ts'

type PingRow = {
  id: string
  from_profile_id: string
  to_profile_id: string
  body: string
  created_at: string
}

type ThanksRow = {
  id: string
  from_profile_id: string
  to_profile_id: string
  note: string | null
  created_at: string
}

function mapPing(row: PingRow): Ping {
  return {
    id: row.id,
    fromProfileId: row.from_profile_id,
    toProfileId: row.to_profile_id,
    body: row.body,
    createdAt: row.created_at,
  }
}

function mapThanks(row: ThanksRow): ThanksNote {
  return {
    id: row.id,
    fromProfileId: row.from_profile_id,
    toProfileId: row.to_profile_id,
    note: row.note,
    createdAt: row.created_at,
  }
}

export async function settlePastDays(): Promise<void> {
  const client = requireSupabase()
  const { error } = await client.rpc('settle_past_days')
  if (error) throw new Error(error.message)
}

export async function markNotDoneRpc(id: string): Promise<void> {
  const client = requireSupabase()
  const { error } = await client.rpc('mark_not_done', { p_id: id })
  if (error) throw new Error(error.message)
}

export async function fetchInbox(userId: string): Promise<{ pings: Ping[]; thanks: ThanksNote[] }> {
  const client = requireSupabase()
  const [pingsRes, thanksRes] = await Promise.all([
    client
      .from('pings')
      .select('id, from_profile_id, to_profile_id, body, created_at')
      .eq('to_profile_id', userId)
      .is('read_at', null)
      .order('created_at', { ascending: false }),
    client
      .from('thanks')
      .select('id, from_profile_id, to_profile_id, note, created_at')
      .eq('to_profile_id', userId)
      .order('created_at', { ascending: false })
      .limit(5),
  ])
  if (pingsRes.error) throw new Error(pingsRes.error.message)
  if (thanksRes.error) throw new Error(thanksRes.error.message)
  return {
    pings: ((pingsRes.data ?? []) as PingRow[]).map(mapPing),
    thanks: ((thanksRes.data ?? []) as ThanksRow[]).map(mapThanks),
  }
}

export async function sendPing(input: {
  householdId: string
  fromId: string
  toId: string
  body: string
}): Promise<void> {
  const client = requireSupabase()
  const { error } = await client.from('pings').insert({
    household_id: input.householdId,
    from_profile_id: input.fromId,
    to_profile_id: input.toId,
    body: input.body.trim(),
  })
  if (error) throw new Error(error.message)
}

export async function markPingRead(id: string): Promise<void> {
  const client = requireSupabase()
  const { error } = await client
    .from('pings')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

export async function sendThanks(input: {
  householdId: string
  fromId: string
  toId: string
  assignmentId?: string
  note?: string
}): Promise<void> {
  const client = requireSupabase()
  const { error } = await client.from('thanks').insert({
    household_id: input.householdId,
    from_profile_id: input.fromId,
    to_profile_id: input.toId,
    assignment_id: input.assignmentId ?? null,
    note: input.note?.trim() || null,
  })
  if (error) throw new Error(error.message)
}
