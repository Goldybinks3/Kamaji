const REMINDER_HOUR = 17

export function parisHour(now = new Date()): number {
  const hour = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Paris',
    hour: '2-digit',
    hourCycle: 'h23',
  }).format(now)
  return Number(hour)
}

export function canNotify(): boolean {
  return typeof Notification !== 'undefined'
}

export async function requestNotifyPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!canNotify()) return 'unsupported'
  return Notification.requestPermission()
}

export function showNotice(title: string, body: string): void {
  if (!canNotify() || Notification.permission !== 'granted') return
  new Notification(title, { body })
}

export function remindEveningTasks(today: string, remaining: number): void {
  if (remaining < 1 || parisHour() < REMINDER_HOUR) return
  const key = `kamaji-reminder-${today}`
  if (localStorage.getItem(key)) return
  localStorage.setItem(key, '1')
  showNotice('Kamaji', 'Il reste des tâches pour ce soir.')
}
