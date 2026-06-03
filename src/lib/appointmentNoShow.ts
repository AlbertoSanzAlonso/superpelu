import { nowSalonMinutes, todaySalon } from '@/lib/dates'

export const APPOINTMENT_STATUS_NO_SHOW = 'no_show'

/** Citas que no ocupan huecos en la agenda (canceladas o inasistencia). */
export function appointmentBlocksScheduleSlot(status: string): boolean {
  return status !== 'cancelled' && status !== APPOINTMENT_STATUS_NO_SHOW
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

/** La hora de inicio de la cita ya pasó en la zona del salón. */
export function isAppointmentStartPast(date: string, startTime: string): boolean {
  const today = todaySalon()
  if (date < today) return true
  if (date > today) return false
  return timeToMinutes(startTime) <= nowSalonMinutes()
}

export function canMarkAppointmentNoShow(
  date: string,
  startTime: string,
  status: string,
): boolean {
  if (status === 'cancelled' || status === APPOINTMENT_STATUS_NO_SHOW) return false
  return isAppointmentStartPast(date, startTime)
}
