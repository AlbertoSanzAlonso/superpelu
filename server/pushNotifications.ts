import webpush from 'web-push'
import { formatDisplayDate } from '@/lib/dates'
import { sql } from '@server/db.js'
import type { AppointmentRow } from '@server/pg/types.js'

export type AdminAgendaPushKind = 'created' | 'cancelled' | 'modified'

type PushSubscriptionRow = {
  endpoint: string
  keys_p256dh: string
  keys_auth: string
}

type PushPayload = {
  title: string
  body: string
  url: string
  appointmentId: string
  date: string
}

function envFlag(name: string): boolean {
  return (process.env[name] ?? '').toLowerCase() === 'true'
}

function getVapidConfig(): { publicKey: string; privateKey: string; subject: string } | null {
  if (!envFlag('PUSH_ENABLED')) return null
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim() ?? ''
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim() ?? ''
  const subject = process.env.VAPID_SUBJECT?.trim() || 'mailto:admin@superpelu.es'
  if (!publicKey || !privateKey) return null
  return { publicKey, privateKey, subject }
}

let vapidConfigured = false

function ensureVapid(): boolean {
  const config = getVapidConfig()
  if (!config) return false
  if (!vapidConfigured) {
    webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey)
    vapidConfigured = true
  }
  return true
}

export function getPushPublicKey(): string | null {
  return getVapidConfig()?.publicKey ?? null
}

export function logPushStartup(): void {
  const config = getVapidConfig()
  if (!envFlag('PUSH_ENABLED')) return
  if (!config) {
    console.warn(
      'Superpelu push: PUSH_ENABLED=true pero faltan VAPID_PUBLIC_KEY o VAPID_PRIVATE_KEY — avisos desactivados',
    )
    return
  }
  console.log('Superpelu push: activo (agenda admin)')
}

export async function saveAdminPushSubscription(subscription: {
  endpoint: string
  keys: { p256dh: string; auth: string }
}): Promise<void> {
  const now = new Date().toISOString()
  await sql`
    INSERT INTO admin_push_subscriptions (endpoint, keys_p256dh, keys_auth, created_at)
    VALUES (${subscription.endpoint}, ${subscription.keys.p256dh}, ${subscription.keys.auth}, ${now})
    ON CONFLICT (endpoint) DO UPDATE SET
      keys_p256dh = EXCLUDED.keys_p256dh,
      keys_auth = EXCLUDED.keys_auth
  `
}

export async function deleteAdminPushSubscription(endpoint: string): Promise<void> {
  await sql`DELETE FROM admin_push_subscriptions WHERE endpoint = ${endpoint}`
}

async function listAdminPushSubscriptions(): Promise<PushSubscriptionRow[]> {
  return sql<PushSubscriptionRow[]>`
    SELECT endpoint, keys_p256dh, keys_auth FROM admin_push_subscriptions
  `
}

function kindLabel(kind: AdminAgendaPushKind): string {
  switch (kind) {
    case 'created':
      return 'Nueva cita'
    case 'cancelled':
      return 'Cita cancelada'
    case 'modified':
      return 'Cita modificada'
  }
}

function formatPushTime(startTime: string): string {
  return startTime.slice(0, 5)
}

function buildPushPayload(row: AppointmentRow, kind: AdminAgendaPushKind): PushPayload {
  const dateLabel = formatDisplayDate(row.appointment_date, 'es')
  const timeLabel = formatPushTime(row.start_time)
  const staff = row.staff_name ?? 'Superpelu'
  return {
    title: kindLabel(kind),
    body: `${row.customer_name} · ${row.service_name} · ${staff} — ${dateLabel} ${timeLabel}`,
    url: '/agenda',
    appointmentId: row.id,
    date: row.appointment_date,
  }
}

async function sendPushToSubscription(
  row: PushSubscriptionRow,
  payload: PushPayload,
): Promise<'sent' | 'gone'> {
  try {
    await webpush.sendNotification(
      {
        endpoint: row.endpoint,
        keys: { p256dh: row.keys_p256dh, auth: row.keys_auth },
      },
      JSON.stringify(payload),
    )
    return 'sent'
  } catch (err) {
    const status = err && typeof err === 'object' && 'statusCode' in err ? Number(err.statusCode) : 0
    if (status === 404 || status === 410) return 'gone'
    console.error('Superpelu push:', err)
    return 'sent'
  }
}

export async function notifyAdminAgendaPush(
  row: AppointmentRow,
  kind: AdminAgendaPushKind,
): Promise<void> {
  if (!ensureVapid()) return
  const subscriptions = await listAdminPushSubscriptions()
  if (subscriptions.length === 0) return

  const payload = buildPushPayload(row, kind)
  const stale: string[] = []

  await Promise.all(
    subscriptions.map(async (subscription) => {
      const result = await sendPushToSubscription(subscription, payload)
      if (result === 'gone') stale.push(subscription.endpoint)
    }),
  )

  if (stale.length > 0) {
    await Promise.all(stale.map((endpoint) => deleteAdminPushSubscription(endpoint)))
  }
}
