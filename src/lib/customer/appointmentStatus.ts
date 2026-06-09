import { nowSalonMinutes, todaySalon } from '@/lib/core/dates'
import { APPOINTMENT_STATUS_NO_SHOW } from '@/lib/agenda/noShow'
import type { Appointment } from '@/types/booking'

export type CustomerAppointmentStatusFilter =
  | 'upcoming'
  | 'awaiting_arrival'
  | 'cancelled'
  | 'no_show'
  | 'completed'

export const CUSTOMER_APPOINTMENT_STATUS_FILTER_OPTIONS: {
  value: CustomerAppointmentStatusFilter
  label: string
}[] = [
  { value: 'upcoming', label: 'Pendientes' },
  { value: 'awaiting_arrival', label: 'Aún no ha llegado (hoy)' },
  { value: 'cancelled', label: 'Canceladas' },
  { value: 'no_show', label: 'Inasistencias' },
  { value: 'completed', label: 'Realizadas' },
]

/** Alias para listados de citas del salón (misma lógica que el historial por cliente). */
export type AppointmentStatusFilter = CustomerAppointmentStatusFilter
export const APPOINTMENT_STATUS_FILTER_OPTIONS = CUSTOMER_APPOINTMENT_STATUS_FILTER_OPTIONS

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

  if (apt.status === APPOINTMENT_STATUS_NO_SHOW) {
    tags.add('no_show')
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
  if (tags.has('no_show')) return 'Inasistencia'
  if (tags.has('cancelled')) return 'Cancelada'
  if (tags.has('awaiting_arrival')) return 'Aún no ha llegado'
  if (tags.has('upcoming')) return 'Pendiente'
  if (tags.has('completed')) return 'Realizada'
  return null
}
