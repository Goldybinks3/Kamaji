import { requireSupabase } from '../lib/supabase.ts'
import type {
  Assignment,
  AssignmentKind,
  AssignmentStatus,
  NewRequest,
} from '../types/domain.ts'

type AssignmentRow = {
  id: string
  title: string
  details: string | null
  kind: AssignmentKind
  status: AssignmentStatus
  assignee_id: string | null
  requested_by: string | null
  due_on: string
  due_time: string | null
  price_cents: number | null
}

export function mapAssignment(row: AssignmentRow): Assignment {
  return {
    id: row.id,
    title: row.title,
    details: row.details ?? undefined,
    kind: row.kind,
    status: row.status,
    assigneeId: row.assignee_id,
    requestedBy: row.requested_by,
    dueOn: row.due_on,
    dueTime: row.due_time ? row.due_time.slice(0, 5) : undefined,
    priceCents: row.price_cents,
  }
}

export async function fetchAssignments(householdId: string): Promise<Assignment[]> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('assignments')
    .select(
      'id, title, details, kind, status, assignee_id, requested_by, due_on, due_time, price_cents',
    )
    .eq('household_id', householdId)
    .in('status', ['open', 'accepted'])
    .order('due_on', { ascending: true })

  if (error) throw new Error(error.message)
  return ((data ?? []) as AssignmentRow[]).map(mapAssignment)
}

export async function createRequestRpc(input: NewRequest): Promise<Assignment> {
  const client = requireSupabase()
  const { data, error } = await client.rpc('create_request', {
    p_title: input.title.trim(),
    p_assignee: input.assigneeId,
    p_due_on: input.dueOn,
    p_due_time: input.dueTime ?? null,
    p_price_cents: input.priceCents,
  })
  if (error) throw new Error(error.message)
  return mapAssignment(data as AssignmentRow)
}

export async function acceptAssignmentRpc(id: string): Promise<Assignment> {
  const client = requireSupabase()
  const { data, error } = await client.rpc('accept_assignment', { p_id: id })
  if (error) throw new Error(error.message)
  return mapAssignment(data as AssignmentRow)
}

export async function completeAssignmentRpc(id: string): Promise<Assignment> {
  const client = requireSupabase()
  const { data, error } = await client.rpc('complete_assignment', { p_id: id })
  if (error) throw new Error(error.message)
  return mapAssignment(data as AssignmentRow)
}

export async function releaseAssignmentRpc(id: string): Promise<Assignment> {
  const client = requireSupabase()
  const { data, error } = await client.rpc('release_assignment', { p_id: id })
  if (error) throw new Error(error.message)
  return mapAssignment(data as AssignmentRow)
}
