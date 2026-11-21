import { requireSupabase } from '../lib/supabase.ts'
import type { ChoreTemplate, Effort, MealSlot } from '../types/domain.ts'

type TemplateRow = {
  id: string
  title: string
  effort: Effort
  weekdays: number[]
  slot: MealSlot | null
}

function mapTemplate(row: TemplateRow): ChoreTemplate {
  return {
    id: row.id,
    title: row.title,
    effort: row.effort,
    weekdays: row.weekdays,
    slot: row.slot,
  }
}

export async function fetchTemplates(householdId: string): Promise<ChoreTemplate[]> {
  const client = requireSupabase()
  const withSlot = await client
    .from('chore_templates')
    .select('id, title, effort, weekdays, slot')
    .eq('household_id', householdId)
    .eq('active', true)
    .order('created_at', { ascending: true })
  if (!withSlot.error) return ((withSlot.data ?? []) as TemplateRow[]).map(mapTemplate)
  if (!/column|schema cache|slot/i.test(withSlot.error.message)) throw new Error(withSlot.error.message)

  const legacy = await client
    .from('chore_templates')
    .select('id, title, effort, weekdays')
    .eq('household_id', householdId)
    .eq('active', true)
    .order('created_at', { ascending: true })
  if (legacy.error) throw new Error(legacy.error.message)
  return ((legacy.data ?? []) as TemplateRow[]).map((row) => mapTemplate({ ...row, slot: null }))
}

export async function addTemplate(
  householdId: string,
  input: { title: string; effort: Effort; weekdays: number[]; slot: MealSlot | null },
): Promise<void> {
  const client = requireSupabase()
  const { error } = await client.from('chore_templates').insert({
    household_id: householdId,
    title: input.title.trim(),
    effort: input.effort,
    weekdays: input.weekdays,
    slot: input.slot,
    active: true,
  })
  if (error) throw new Error(error.message)
}

export async function removeTemplate(id: string): Promise<void> {
  const client = requireSupabase()
  const { error } = await client.from('chore_templates').update({ active: false }).eq('id', id)
  if (error) throw new Error(error.message)
}

export async function prepareWeek(monday: string): Promise<number> {
  const client = requireSupabase()
  const { data, error } = await client.rpc('generate_week', { p_week_start: monday })
  if (error) throw new Error(error.message)
  return Number(data ?? 0)
}
