import { createHmac, timingSafeEqual } from 'node:crypto'
import type { AppointmentRow } from './db.js'

const SALON_ADDRESS = 'Av. las Palmeras, 8, Local 18, 29630 Benalmádena'

function cancelSecret(): string {
  return (process.env.CANCEL_TOKEN_SECRET ?? process.env.ADMIN_SECRET ?? 'superpelu-dev-admin').trim()
}

/** Token de cancelación (HMAC del id), para enlaces enviados al cliente. */
export function appointmentCancelToken(id: string): string {
  return createHmac('sha256', cancelSecret()).update(`cancel:${id}`).digest('hex').slice(0, 32)
}

export function verifyCancelToken(id: string, token: string | undefined): boolean {
  if (!token) return false
  const expected = appointmentCancelToken(id)
  const a = Buffer.from(expected)
  const b = Buffer.from(token)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

/** URL pública base de Superpelu (sin barra final). Vacío si no se puede determinar. */
export function publicBaseUrl(): string {
  const explicit = (process.env.PUBLIC_BASE_URL ?? '').trim()
  if (explicit) return explicit.replace(/\/$/, '')
  const cors = (process.env.CORS_ORIGIN ?? '').split(',')[0]?.trim()
  if (cors) return cors.replace(/\/$/, '')
  return ''
}

export function buildCancelUrl(row: AppointmentRow): string | null {
  const base = publicBaseUrl()
  if (!base) return null
  const token = appointmentCancelToken(row.id)
  return `${base}/cancelar/${encodeURIComponent(row.id)}?t=${token}`
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** Enlace "Añadir al calendario" (Google Calendar, zona Europe/Madrid). */
export function buildCalendarUrl(row: AppointmentRow): string {
  const [y, m, d] = row.appointment_date.split('-').map(Number)
  const [hh, mm] = row.start_time.split(':').map(Number)
  const startTotal = hh * 60 + mm
  const endTotal = startTotal + row.duration_minutes

  const startStr = `${y}${pad(m)}${pad(d)}T${pad(Math.floor(startTotal / 60))}${pad(startTotal % 60)}00`
  const endStr = `${y}${pad(m)}${pad(d)}T${pad(Math.floor(endTotal / 60))}${pad(endTotal % 60)}00`

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `Cita Superpelu — ${row.service_name}`,
    dates: `${startStr}/${endStr}`,
    details: `Cita con ${row.staff_name ?? 'Superpelu'} en Superpelu.`,
    location: SALON_ADDRESS,
    ctz: 'Europe/Madrid',
  })
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}
