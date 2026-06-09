import { todaySalon } from '@/lib/core/dates'
import type { Appointment } from '@/types/booking'

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

/** Cita pasada y no cancelada / inasistencia — candidata a pedir valoración. */
export function canRequestGoogleReview(apt: Appointment): boolean {
  if (apt.status === 'cancelled' || apt.status === 'no_show') return false
  const today = todaySalon()
  if (apt.date < today) return true
  if (apt.date > today) return false
  const now = new Date()
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  return timeToMinutes(apt.startTime) < nowMinutes
}
