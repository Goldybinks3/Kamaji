import type { Absence, CalendarPeriod, HouseholdRhythm, MealSlot } from '../types/domain.ts'

export const slotLabel: Record<MealSlot, string> = {
  lunch: 'Midi',
  dinner: 'Soir',
}

export const defaultRhythm: HouseholdRhythm = {
  weekdaySlots: ['dinner'],
  weekendSlots: ['lunch', 'dinner'],
}

export function isWeekend(isoDate: string): boolean {
  const date = new Date(`${isoDate}T12:00:00Z`)
  const day = date.getUTCDay()
  return day === 0 || day === 6
}

export function openSlotsFor(
  isoDate: string,
  rhythm: HouseholdRhythm | null,
  periods: CalendarPeriod[],
): MealSlot[] {
  const period = periods
    .filter((item) => isoDate >= item.startsOn && isoDate <= item.endsOn)
    .sort((a, b) => b.startsOn.localeCompare(a.startsOn))[0]
  if (period) return period.slots
  const source = rhythm ?? defaultRhythm
  return isWeekend(isoDate) ? source.weekendSlots : source.weekdaySlots
}

export function isAbsent(profileId: string, isoDate: string, absences: Absence[]): boolean {
  return absences.some(
    (item) => item.profileId === profileId && isoDate >= item.startsOn && isoDate <= item.endsOn,
  )
}

export function toggleSlot(slots: MealSlot[], slot: MealSlot): MealSlot[] | null {
  const has = slots.includes(slot)
  if (has && slots.length === 1) return null
  const next = has ? slots.filter((item) => item !== slot) : [...slots, slot]
  return next.sort((a, b) => (a === 'lunch' ? -1 : 1) - (b === 'lunch' ? -1 : 1))
}
