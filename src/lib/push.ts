import { requireSupabase } from './supabase.ts'

function keyBytes(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const buffer = new ArrayBuffer(raw.length)
  const output = new Uint8Array(buffer)
  for (let index = 0; index < raw.length; index += 1) output[index] = raw.charCodeAt(index)
  return output
}

export async function enablePush(
  profileId: string,
): Promise<'granted' | 'denied' | 'unsupported' | 'missing-key'> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || typeof Notification === 'undefined') {
    return 'unsupported'
  }
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return 'denied'

  const publicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY?.trim()
  if (!publicKey) return 'missing-key'

  const registration = await navigator.serviceWorker.ready
  const existing = await registration.pushManager.getSubscription()
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: keyBytes(publicKey),
    }))
  const json = subscription.toJSON()
  const client = requireSupabase()
  const { error } = await client.from('push_subscriptions').upsert(
    {
      profile_id: profileId,
      endpoint: subscription.endpoint,
      p256dh: json.keys?.p256dh ?? '',
      auth: json.keys?.auth ?? '',
    },
    { onConflict: 'endpoint' },
  )
  if (error) throw new Error(error.message)
  return 'granted'
}

export async function notifyProfile(profileId: string, title: string, body: string): Promise<void> {
  try {
    const client = requireSupabase()
    await client.functions.invoke('notify', {
      body: { kind: 'direct', profileId, title, body },
    })
  } catch {
    // La fonction n’est pas encore déployée : le message reste dans Kamaji.
  }
}
