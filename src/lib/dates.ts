const PARIS = 'Europe/Paris'

export function parisToday(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: PARIS,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

export function addDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export function mondayOf(isoDate: string): string {
  const date = new Date(`${isoDate}T12:00:00Z`)
  const weekday = date.getUTCDay()
  const delta = weekday === 0 ? -6 : 1 - weekday
  return addDays(isoDate, delta)
}

export function weekDates(isoDate: string): string[] {
  const monday = mondayOf(isoDate)
  return Array.from({ length: 7 }, (_, index) => addDays(monday, index))
}

export function formatDay(isoDate: string): string {
  const date = new Date(`${isoDate}T12:00:00Z`)
  const label = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(date)
  return label.charAt(0).toLocaleUpperCase('fr-FR') + label.slice(1)
}

export function formatDue(isoDate: string, today: string): string {
  if (isoDate === today) return "Aujourd'hui"
  if (isoDate === addDays(today, 1)) return 'Demain'
  return formatDay(isoDate)
}

export function formatTime(time: string | undefined): string | null {
  if (!time) return null
  const [hour, minute] = time.split(':')
  return `${hour} h ${minute}`
}

export function formatPrice(cents: number | null | undefined): string | null {
  if (cents == null) return null
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(cents / 100)
}
