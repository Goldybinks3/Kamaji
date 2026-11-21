import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push'

type SubscriptionRow = {
  endpoint: string
  p256dh: string
  auth: string
}

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-kamaji-cron',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

function parisToday(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function configureVapid(): boolean {
  const publicKey = Deno.env.get('VAPID_PUBLIC_KEY') ?? ''
  const privateKey = Deno.env.get('VAPID_PRIVATE_KEY') ?? ''
  if (!publicKey || !privateKey) return false
  webpush.setVapidDetails(
    Deno.env.get('VAPID_SUBJECT') ?? 'mailto:kamaji@localhost',
    publicKey,
    privateKey,
  )
  return true
}

async function sendTo(
  admin: ReturnType<typeof createClient>,
  profileId: string,
  title: string,
  body: string,
): Promise<number> {
  const { data, error } = await admin
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('profile_id', profileId)
  if (error || !data) return 0

  let sent = 0
  for (const row of data as SubscriptionRow[]) {
    try {
      await webpush.sendNotification(
        {
          endpoint: row.endpoint,
          keys: { p256dh: row.p256dh, auth: row.auth },
        },
        JSON.stringify({ title, body }),
      )
      sent += 1
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode
      if (status === 404 || status === 410) {
        await admin.from('push_subscriptions').delete().eq('endpoint', row.endpoint)
      }
    }
  }
  return sent
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (request.method !== 'POST') return json({ error: 'Méthode refusée' }, 405)

  const url = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  if (!url || !serviceKey) return json({ error: 'Fonction non configurée' }, 500)

  const admin = createClient(url, serviceKey)
  const payload = (await request.json().catch(() => ({}))) as {
    kind?: string
    profileId?: string
    title?: string
    body?: string
  }

  if (!configureVapid()) return json({ sent: 0, skipped: 'vapid' })

  const cronSecret = Deno.env.get('KAMAJI_CRON_SECRET') ?? ''
  if (
    payload.kind === 'evening' &&
    cronSecret &&
    request.headers.get('x-kamaji-cron') === cronSecret
  ) {
    const today = parisToday()
    const { data: tasks } = await admin
      .from('assignments')
      .select('assignee_id')
      .eq('status', 'accepted')
      .eq('due_on', today)
    const people = new Set(
      ((tasks ?? []) as { assignee_id: string | null }[])
        .map((task) => task.assignee_id)
        .filter((id): id is string => Boolean(id)),
    )
    let sent = 0
    for (const profileId of people) {
      sent += await sendTo(admin, profileId, 'Kamaji', 'Il reste des tâches pour ce soir.')
    }
    return json({ sent })
  }

  const authorization = request.headers.get('Authorization') ?? ''
  if (!authorization || !anonKey) return json({ error: 'Connexion requise' }, 401)

  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
  })
  const { data: userData, error: userError } = await userClient.auth.getUser()
  if (userError || !userData.user || !payload.profileId) return json({ error: 'Connexion requise' }, 401)

  const { data: profiles } = await admin
    .from('profiles')
    .select('id, household_id')
    .in('id', [userData.user.id, payload.profileId])
  const rows = (profiles ?? []) as { id: string; household_id: string }[]
  const mine = rows.find((row) => row.id === userData.user.id)
  const theirs = rows.find((row) => row.id === payload.profileId)
  if (!mine || !theirs || mine.household_id !== theirs.household_id) {
    return json({ error: 'Hors du foyer' }, 403)
  }

  const sent = await sendTo(
    admin,
    payload.profileId,
    payload.title?.trim() || 'Kamaji',
    payload.body?.trim() || '',
  )
  return json({ sent })
})
