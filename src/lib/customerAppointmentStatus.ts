import { nowSalonMinutes, todaySalon } from '@/lib/dates'
import type { Appointment } from '@/types/booking'

export type CustomerAppointmentStatusFilter =
  | 'upcoming'
  | 'awaiting_arrival'
  | 'cancelled'
  | 'completed'

export const CUSTOMER_APPOINTMENT_STATUS_FILTER_OPTIONS: {
  value: CustomerAppointmentStatusFilter
  label: string
}[] = [
  { value: 'upcoming', label: 'Pendientes' },
  { value: 'awaiting_arrival', label: 'Aún no ha llegado (hoy)' },
  { value: 'cancelled', label: 'Canceladas' },
  { value: 'completed', label: 'Realizadas' },
]

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

function appointmentEndMinutes(apt: Appointment): number {
  return timeToMinutes(apt.startTime) + apt.durationMinutes
}

/** Etiquetas de estado aplicables a una cita (puede haber varias solo en teoría; en práctica son excluyentes). */
export function getCustomerAppointmentStatusTags(
  apt: Appointment,
): Set<CustomerAppointmentStatusFilter> {
  const tags = new Set<CustomerAppointmentStatusFilter>()

  if (apt.status === 'cancelled') {
    tags.add('cancelled')
    return tags
  }

  const today = todaySalon()
  const nowMin = nowSalonMinutes()
  const startMin = timeToMinutes(apt.startTime)
  const endMin = appointmentEndMinutes(apt)

  if (apt.date < today || (apt.date === today && endMin <= nowMin)) {
    tags.add('completed')
  }

  if (apt.date > today || (apt.date === today && startMin > nowMin)) {
    tags.add('upcoming')
  }

  if (apt.date === today && startMin > nowMin) {
    tags.add('awaiting_arrival')
  }

  return tags
}

export function matchesCustomerAppointmentStatusFilter(
  apt: Appointment,
  filter: CustomerAppointmentStatusFilter,
): boolean {
  return getCustomerAppointmentStatusTags(apt).has(filter)
}

export function customerAppointmentStatusLabel(
  apt: Appointment,
): string | null {
  const tags = getCustomerAppointmentStatusTags(apt)
  if (tags.has('cancelled')) return 'Cancelada'
  if (tags.has('awaiting_arrival')) return 'Aún no ha llegado'
  if (tags.has('upcoming')) return 'Pendiente'
  if (tags.has('completed')) return 'Realizada'
  return null
}
