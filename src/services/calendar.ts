import { requireSupabase } from '../lib/supabase.ts'
import type { Absence, CalendarPeriod, HouseholdRhythm, MealSlot } from '../types/domain.ts'

type RhythmRow = {
  weekday_slots: MealSlot[]
  weekend_slots: MealSlot[]
}

type PeriodRow = {
  id: string
  label: string
  starts_on: string
  ends_on: string
  slots: MealSlot[]
}

type AbsenceRow = {
  id: string
  profile_id: string
  starts_on: string
  ends_on: string
}

function mapPeriod(row: PeriodRow): CalendarPeriod {
  return {
    id: row.id,
    label: row.label,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    slots: row.slots,
  }
}

function mapAbsence(row: AbsenceRow): Absence {
  return {
    id: row.id,
    profileId: row.profile_id,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
  }
}

export async function fetchRhythm(householdId: string): Promise<HouseholdRhythm | null> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('household_rhythms')
    .select('weekday_slots, weekend_slots')
    .eq('household_id', householdId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  const row = data as RhythmRow
  return { weekdaySlots: row.weekday_slots, weekendSlots: row.weekend_slots }
}

export async function saveRhythm(householdId: string, rhythm: HouseholdRhythm): Promise<void> {
  const client = requireSupabase()
  const { error } = await client
    .from('household_rhythms')
    .update({
      weekday_slots: rhythm.weekdaySlots,
      weekend_slots: rhythm.weekendSlots,
    })
    .eq('household_id', householdId)
  if (error) throw new Error(error.message)
}

export async function fetchPeriods(householdId: string): Promise<CalendarPeriod[]> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('calendar_periods')
    .select('id, label, starts_on, ends_on, slots')
    .eq('household_id', householdId)
    .order('starts_on', { ascending: true })
  if (error) throw new Error(error.message)
  return ((data ?? []) as PeriodRow[]).map(mapPeriod)
}

export async function addPeriod(
  householdId: string,
  input: { label: string; startsOn: string; endsOn: string; slots: MealSlot[] },
): Promise<void> {
  const client = requireSupabase()
  const { error } = await client.from('calendar_periods').insert({
    household_id: householdId,
    label: input.label.trim(),
    starts_on: input.startsOn,
    ends_on: input.endsOn,
    slots: input.slots,
  })
  if (error) throw new Error(error.message)
}

export async function removePeriod(id: string): Promise<void> {
  const client = requireSupabase()
  const { error } = await client.from('calendar_periods').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export async function fetchAbsences(householdId: string): Promise<Absence[]> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('absences')
    .select('id, profile_id, starts_on, ends_on')
    .eq('household_id', householdId)
    .order('starts_on', { ascending: true })
  if (error) throw new Error(error.message)
  return ((data ?? []) as AbsenceRow[]).map(mapAbsence)
}

export async function addAbsence(
  householdId: string,
  input: { profileId: string; startsOn: string; endsOn: string },
): Promise<void> {
  const client = requireSupabase()
  const { error } = await client.from('absences').insert({
    household_id: householdId,
    profile_id: input.profileId,
    starts_on: input.startsOn,
    ends_on: input.endsOn,
  })
  if (error) throw new Error(error.message)
}

export async function removeAbsence(id: string): Promise<void> {
  const client = requireSupabase()
  const { error } = await client.from('absences').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
