import type { Appointment } from '@/types/booking'

const SALON_ADDRESS = 'Av. las Palmeras, 8, Local 18, 29630 Benalmádena'
const SALON_PHONE = '952 443 686'

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function icsEscape(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

/** Marcas de tiempo locales (sin zona) inicio/fin de la cita en formato YYYYMMDDTHHMMSS. */
function localStamps(apt: Appointment): { start: string; end: string } {
  const [y, m, d] = apt.date.split('-').map(Number)
  const [hh, mm] = apt.startTime.split(':').map(Number)
  const startTotal = hh * 60 + mm
  const endTotal = startTotal + apt.durationMinutes
  const local = (totalMin: number) =>
    `${y}${pad(m)}${pad(d)}T${pad(Math.floor(totalMin / 60))}${pad(totalMin % 60)}00`
  return { start: local(startTotal), end: local(endTotal) }
}

function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes('Macintosh') && 'ontouchend' in document)
}

function isAndroid(): boolean {
  if (typeof navigator === 'undefined') return false
  return /Android/i.test(navigator.userAgent || '')
}

/** Genera el contenido .ics de una cita (hora Europe/Madrid). */
export function buildAppointmentIcs(apt: Appointment): string {
  const { start, end } = localStamps(apt)
  const dtStamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')

  return [
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
    `UID:${apt.id}@superpelu`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART;TZID=Europe/Madrid:${start}`,
    `DTEND;TZID=Europe/Madrid:${end}`,
    `SUMMARY:${icsEscape(`Cita Superpelu — ${apt.serviceName}`)}`,
    `DESCRIPTION:${icsEscape(`Cita con ${apt.staffName ?? 'Superpelu'}. Tel: ${SALON_PHONE}`)}`,
    `LOCATION:${icsEscape(SALON_ADDRESS)}`,
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')
}

/**
 * URL de Google Calendar con el evento prerellenado. En Android abre la app de
 * Google Calendar (o la web), que es el flujo más fiable para guardar la cita.
 */
export function buildGoogleCalendarUrl(apt: Appointment): string {
  const { start, end } = localStamps(apt)
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `Cita Superpelu — ${apt.serviceName}`,
    dates: `${start}/${end}`,
    details: `Cita con ${apt.staffName ?? 'Superpelu'}. Tel: ${SALON_PHONE}`,
    location: SALON_ADDRESS,
    ctz: 'Europe/Madrid',
  })
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

/** Descarga el .ics de la cita; el SO abre el calendario nativo para guardarla. */
export function downloadAppointmentIcs(apt: Appointment): void {
  const ics = buildAppointmentIcs(apt)
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'cita-superpelu.ics'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/**
 * Añade la cita al calendario del usuario eligiendo el mejor flujo por dispositivo:
 * - Android → Google Calendar con el evento prerellenado (más fiable que descargar .ics).
 * - iPhone/iPad y escritorio → descarga .ics, que abre el calendario nativo (Apple/Outlook…).
 */
export function addAppointmentToCalendar(apt: Appointment): void {
  if (isAndroid() && !isIOS()) {
    window.open(buildGoogleCalendarUrl(apt), '_blank', 'noopener,noreferrer')
    return
  }
  downloadAppointmentIcs(apt)
}
