import type { Appointment } from '@/types/booking'

const SALON_ADDRESS = 'Av. las Palmeras, 8, Local 18, 29630 Benalmádena'
const SALON_PHONE = '952 443 686'

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function icsEscape(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

/** Genera el contenido .ics de una cita (hora Europe/Madrid). */
export function buildAppointmentIcs(apt: Appointment): string {
  const [y, m, d] = apt.date.split('-').map(Number)
  const [hh, mm] = apt.startTime.split(':').map(Number)
  const startTotal = hh * 60 + mm
  const endTotal = startTotal + apt.durationMinutes

  const local = (totalMin: number) =>
    `${y}${pad(m)}${pad(d)}T${pad(Math.floor(totalMin / 60))}${pad(totalMin % 60)}00`

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
    `DTSTART;TZID=Europe/Madrid:${local(startTotal)}`,
    `DTEND;TZID=Europe/Madrid:${local(endTotal)}`,
    `SUMMARY:${icsEscape(`Cita Superpelu — ${apt.serviceName}`)}`,
    `DESCRIPTION:${icsEscape(`Cita con ${apt.staffName ?? 'Superpelu'}. Tel: ${SALON_PHONE}`)}`,
    `LOCATION:${icsEscape(SALON_ADDRESS)}`,
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')
}

/** Descarga el .ics de la cita; el SO abre el calendario nativo para guardarla. */
export function downloadAppointmentCalendar(apt: Appointment): void {
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
