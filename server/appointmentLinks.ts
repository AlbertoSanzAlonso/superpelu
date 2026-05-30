import { createHmac, timingSafeEqual } from 'node:crypto'
import type { AppointmentRow } from '@server/db.js'
import { appointmentLocale } from '@/i18n/localeHelpers'
import type { Locale } from '@/i18n/types'

const SALON_ADDRESS = 'Av. las Palmeras, 8, Local 18, 29630 Benalmádena'

function cancelSecret(): string {
  return (process.env.CANCEL_TOKEN_SECRET ?? process.env.ADMIN_SECRET ?? 'superpelu-dev-admin').trim()
}

/** Token de cancelación (HMAC del id), para enlaces enviados al cliente. */
export function appointmentCancelToken(id: string): string {
  return createHmac('sha256', cancelSecret()).update(`cancel:${id}`).digest('hex').slice(0, 12)
}

/** UUID → código compacto (base64url, ~22 chars) para URLs cortas. */
export function encodeId(id: string): string {
  const hex = id.replace(/-/g, '')
  if (hex.length !== 32) return id
  return Buffer.from(hex, 'hex').toString('base64url')
}

/** Código compacto → UUID. Devuelve null si no es válido. */
export function decodeId(code: string): string | null {
  try {
    const hex = Buffer.from(code, 'base64url').toString('hex')
    if (hex.length !== 32) return null
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
  } catch {
    return null
  }
}

export function verifyCancelToken(id: string, token: string | undefined): boolean {
  if (!token) return false
  const expected = appointmentCancelToken(id)
  const a = Buffer.from(expected)
  const b = Buffer.from(token)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

/** Imagen del logo para vistas previa (WhatsApp, redes). Debe estar en `public/`. */
export const LINK_PREVIEW_IMAGE_PATH = '/images/superpelu-hair-studio-hero-logo.webp'

const LINK_PREVIEW_DESCRIPTION =
  'Superpelu Hair Studio — peluquería en Benalmádena especialista en color y estética.'

function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Meta Open Graph / Twitter para enlaces compartidos (p. ej. gestionar cita por WhatsApp). */
export function buildLinkPreviewMetaTags(options: {
  title: string
  description?: string
  pageUrl?: string
}): string {
  const base = publicBaseUrl()
  const pageTitle = `${options.title} · Superpelu`
  const description = options.description ?? LINK_PREVIEW_DESCRIPTION

  const tags = [
    `<title>${escapeHtmlAttr(pageTitle)}</title>`,
    `<meta name="description" content="${escapeHtmlAttr(description)}">`,
    '<meta property="og:type" content="website">',
    '<meta property="og:site_name" content="Superpelu Hair Studio">',
    `<meta property="og:title" content="${escapeHtmlAttr(pageTitle)}">`,
    `<meta property="og:description" content="${escapeHtmlAttr(description)}">`,
    '<meta name="twitter:card" content="summary_large_image">',
    `<meta name="twitter:title" content="${escapeHtmlAttr(pageTitle)}">`,
    `<meta name="twitter:description" content="${escapeHtmlAttr(description)}">`,
  ]

  if (base) {
    const imageUrl = `${base}${LINK_PREVIEW_IMAGE_PATH}`
    tags.push(
      `<meta property="og:image" content="${escapeHtmlAttr(imageUrl)}">`,
      `<meta property="og:image:secure_url" content="${escapeHtmlAttr(imageUrl)}">`,
      '<meta property="og:image:type" content="image/webp">',
      '<meta property="og:image:alt" content="Superpelu Hair Studio">',
      `<meta name="twitter:image" content="${escapeHtmlAttr(imageUrl)}">`,
    )
    const url = options.pageUrl ?? base
    tags.push(`<meta property="og:url" content="${escapeHtmlAttr(url)}">`)
  }

  return tags.join('')
}

const SPA_LINK_PREVIEW_TITLES: Record<string, string> = {
  '/reservar': 'Reservar cita',
}

/** Título Open Graph para rutas de la SPA (WhatsApp al compartir /reservar, etc.). */
export function spaLinkPreviewTitle(pagePath: string): string {
  const path = pagePath.split('?')[0] || '/'
  return SPA_LINK_PREVIEW_TITLES[path] ?? 'Superpelu Hair Studio | Peluquería en Benalmádena'
}

/**
 * Sustituye meta description / Open Graph del index.html de la SPA por URLs absolutas.
 * WhatsApp exige og:image con URL absoluta; en el HTML estático va relativa.
 */
export function injectSpaLinkPreviewMeta(html: string, pagePath: string): string {
  const base = publicBaseUrl()
  if (!base) return html

  const pathOnly = pagePath.split('?')[0] || '/'
  const pageUrl = pathOnly === '/' ? `${base}/` : `${base}${pathOnly}`
  const meta = buildLinkPreviewMetaTags({
    title: spaLinkPreviewTitle(pathOnly),
    pageUrl,
  })

  // Solo <meta> de preview (description, OG, Twitter). No incluir <link> de fuentes ni <title>.
  const withMeta = html.replace(
    /<meta\s+name="description"[\s\S]*?(?=<link\s|<title>)/,
    `${meta}\n    `,
  )
  return withMeta.replace(/\s*<title>[^<]*<\/title>/, '')
}

/** URL pública base de Superpelu (sin barra final). Vacío si no se puede determinar. */
export function publicBaseUrl(): string {
  const explicit = (process.env.PUBLIC_BASE_URL ?? '').trim()
  if (explicit) return explicit.replace(/\/$/, '')
  const cors = (process.env.CORS_ORIGIN ?? '').split(',')[0]?.trim()
  if (cors) return cors.replace(/\/$/, '')
  return ''
}

/** URL del botón «Ir a agenda» en el email al admin (`ADMIN_AGENDA_URL` o base + `/agenda`). */
export function adminAgendaUrl(): string {
  const explicit = (process.env.ADMIN_AGENDA_URL ?? '').trim()
  if (explicit) return explicit.replace(/\/$/, '')
  const base = publicBaseUrl()
  if (base) return `${base}/agenda`
  return ''
}

/** Enlace a la reserva online (WhatsApp cancelación, etc.). */
export function buildBookingUrl(): string | null {
  const base = publicBaseUrl()
  if (!base) return null
  return `${base}/reservar`
}

/** Añade ?lang=en / &lang=en a URLs de gestión/cancelación para visitas sin fila en BD. */
export function appendLocaleToCustomerUrl(url: string, locale: Locale): string {
  if (locale === 'es') return url
  return `${url}&lang=en`
}

export function buildCancelUrl(row: AppointmentRow): string | null {
  const base = publicBaseUrl()
  if (!base) return null
  const token = appointmentCancelToken(row.id)
  const url = `${base}/c/${encodeId(row.id)}?t=${token}`
  return appendLocaleToCustomerUrl(url, appointmentLocale(row))
}

/** Enlace para que el cliente cambie fecha/hora o cancele la cita (WhatsApp, etc.). */
export function buildManageUrl(row: AppointmentRow): string | null {
  const base = publicBaseUrl()
  if (!base) return null
  const token = appointmentCancelToken(row.id)
  const url = `${base}/m/${encodeId(row.id)}?t=${token}`
  return appendLocaleToCustomerUrl(url, appointmentLocale(row))
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

/**
 * URL del archivo .ics: al abrirlo en el móvil se añade al calendario nativo
 * (Apple Calendar, Google, Samsung…). Requiere URL pública; si no, null.
 */
export function buildIcsUrl(row: AppointmentRow): string | null {
  const base = publicBaseUrl()
  if (!base) return null
  // El código (uuid v4 aleatorio) ya es secreto; no necesita token extra.
  return `${base}/a/${encodeId(row.id)}`
}

function icsEscape(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

/** Genera el contenido del archivo .ics para una cita (hora Europe/Madrid). */
export function buildIcs(row: AppointmentRow): string {
  const [y, m, d] = row.appointment_date.split('-').map(Number)
  const [hh, mm] = row.start_time.split(':').map(Number)
  const startTotal = hh * 60 + mm
  const endTotal = startTotal + row.duration_minutes

  const local = (totalMin: number) =>
    `${y}${pad(m)}${pad(d)}T${pad(Math.floor(totalMin / 60))}${pad(totalMin % 60)}00`

  const dtStamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Superpelu//Reservas//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VTIMEZONE',
    'TZID:Europe/Madrid',
    'BEGIN:DAYLIGHT',
    'TZOFFSETFROM:+0100',
    'TZOFFSETTO:+0200',
    'TZNAME:CEST',
    'DTSTART:19700329T020000',
    'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU',
    'END:DAYLIGHT',
    'BEGIN:STANDARD',
    'TZOFFSETFROM:+0200',
    'TZOFFSETTO:+0100',
    'TZNAME:CET',
    'DTSTART:19701025T030000',
    'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU',
    'END:STANDARD',
    'END:VTIMEZONE',
    'BEGIN:VEVENT',
    `UID:${row.id}@superpelu`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART;TZID=Europe/Madrid:${local(startTotal)}`,
    `DTEND;TZID=Europe/Madrid:${local(endTotal)}`,
    `SUMMARY:${icsEscape(`Cita Superpelu — ${row.service_name}`)}`,
    `DESCRIPTION:${icsEscape(`Cita con ${row.staff_name ?? 'Superpelu'}. Tel: 952 443 686`)}`,
    `LOCATION:${icsEscape(SALON_ADDRESS)}`,
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  return lines.join('\r\n')
}
