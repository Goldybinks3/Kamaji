import { addDays } from '../lib/dates.ts'
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
  slot?: 'lunch' | 'dinner' | null
  assumed?: boolean
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
    slot: row.slot ?? null,
    assumed: row.assumed ?? false,
  }
}

const assignmentColumns =
  'id, title, details, kind, status, assignee_id, requested_by, due_on, due_time, price_cents, slot, assumed'

async function selectAssignments(
  householdId: string,
  today: string,
  columns: string,
): Promise<Assignment[]> {
  const client = requireSupabase()
  const since = addDays(today, -14)
  const [openRes, assumedRes] = await Promise.all([
    client
      .from('assignments')
      .select(columns)
      .eq('household_id', householdId)
      .in('status', ['open', 'accepted'])
      .order('due_on', { ascending: true }),
    columns.includes('assumed')
      ? client
          .from('assignments')
          .select(columns)
          .eq('household_id', householdId)
          .eq('status', 'done')
          .eq('assumed', true)
          .gte('due_on', since)
          .order('due_on', { ascending: false })
      : Promise.resolve({ data: [], error: null }),
  ])

  if (openRes.error) throw new Error(openRes.error.message)
  if (assumedRes.error) throw new Error(assumedRes.error.message)
  const rows = [...(openRes.data ?? []), ...(assumedRes.data ?? [])] as unknown as AssignmentRow[]
  return rows.map((row) =>
    mapAssignment({
      ...row,
      slot: row.slot ?? null,
      assumed: row.assumed ?? false,
    }),
  )
}

export async function fetchAssignments(householdId: string, today: string): Promise<Assignment[]> {
  try {
    return await selectAssignments(householdId, today, assignmentColumns)
  } catch (err) {
    const message = err instanceof Error ? err.message : ''
    if (!/column|schema cache|assumed|slot/i.test(message)) throw err
    return selectAssignments(
      householdId,
      today,
      'id, title, details, kind, status, assignee_id, requested_by, due_on, due_time, price_cents',
    )
  }
}

export async function createRequestRpc(input: NewRequest): Promise<Assignment> {
  const client = requireSupabase()
  const payload = {
    p_title: input.title.trim(),
    p_assignee: input.assigneeId,
    p_due_on: input.dueOn,
    p_due_time: input.dueTime ?? null,
    p_price_cents: input.priceCents,
  }
  const withSlot = await client.rpc('create_request', { ...payload, p_slot: input.slot })
  if (!withSlot.error) return mapAssignment(withSlot.data as AssignmentRow)

  const message = withSlot.error.message
  if (!/p_slot|schema cache|Could not find/i.test(message)) throw new Error(message)

  const legacy = await client.rpc('create_request', payload)
  if (legacy.error) throw new Error(legacy.error.message)
  return mapAssignment(legacy.data as AssignmentRow)
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
