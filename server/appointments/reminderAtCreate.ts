import { hoursUntilAppointment } from '@/lib/core/dates'

function reminderHoursBefore(): number {
  const n = Number((process.env.REMINDER_HOURS_BEFORE ?? '').trim())
  return Number.isFinite(n) && n > 0 ? n : 24
}

/**
 * Al crear la cita: si faltan ≤ REMINDER_HOURS_BEFORE (def. 24h), no enviar recordatorio
 * (solo confirmación). El scheduler ignora filas con reminder_sent_at ya rellenado.
 */
export function reminderSentAtForCreate(
  appointmentDate: string,
  startTime: string,
): string | null {
  return hoursUntilAppointment(appointmentDate, startTime) <= reminderHoursBefore()
    ? new Date().toISOString()
    : null
}
