import { isColorGroupWashRow } from '@/lib/booking/occupancy'
import {
  customerAppointmentStatusLabel,
  matchesCustomerAppointmentStatusFilter,
  type CustomerAppointmentStatusFilter,
} from '@/lib/customer/appointmentStatus'
import type { Appointment } from '@/types/booking'

export type AppointmentOriginFilter = 'backoffice' | 'booking_page'

export type AppointmentHistoryFilters = {
  dateFrom: string
  dateTo: string
  serviceFilter: string
  staffFilter: string
  statusFilter: CustomerAppointmentStatusFilter | ''
  originFilter: AppointmentOriginFilter | ''
  textQuery: string
}

export const EMPTY_APPOINTMENT_HISTORY_FILTERS: AppointmentHistoryFilters = {
  dateFrom: '',
  dateTo: '',
  serviceFilter: '',
  staffFilter: '',
  statusFilter: '',
  originFilter: '',
  textQuery: '',
}

export const APPOINTMENT_ORIGIN_FILTER_OPTIONS: {
  value: AppointmentOriginFilter
  label: string
}[] = [
  { value: 'backoffice', label: 'Backoffice' },
  { value: 'booking_page', label: 'Web (cliente)' },
]

export function appointmentOriginLabel(origin: string | null | undefined): string | null {
  if (origin === 'booking_page') return 'Reserva cliente'
  if (origin === 'backoffice') return 'Backoffice'
  return null
}

function matchesTextQuery(apt: Appointment, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const haystack = [
    apt.customerName,
    apt.customerPhone,
    apt.serviceName,
    apt.staffName ?? '',
    apt.notes ?? '',
    apt.date,
    apt.status,
    customerAppointmentStatusLabel(apt) ?? '',
    appointmentOriginLabel(apt.origin) ?? '',
  ]
    .join(' ')
    .toLowerCase()
  return haystack.includes(q)
}

export function filterAppointmentHistory(
  appointments: Appointment[],
  filters: AppointmentHistoryFilters,
): Appointment[] {
  const { dateFrom, dateTo, serviceFilter, staffFilter, statusFilter, originFilter, textQuery } =
    filters
  return appointments.filter((apt) => {
    if (isColorGroupWashRow(apt.colorGroupRole)) return false
    if (dateFrom && apt.date < dateFrom) return false
    if (dateTo && apt.date > dateTo) return false
    if (serviceFilter && apt.serviceId !== serviceFilter) return false
    if (staffFilter && apt.staffId !== staffFilter) return false
    if (statusFilter && !matchesCustomerAppointmentStatusFilter(apt, statusFilter)) {
      return false
    }
    if (originFilter && (apt.origin ?? '') !== originFilter) return false
    if (!matchesTextQuery(apt, textQuery)) return false
    return true
  })
}

export function buildServiceFilterOptions(appointments: Appointment[]) {
  const map = new Map<string, string>()
  for (const apt of appointments) {
    map.set(apt.serviceId, apt.serviceName)
  }
  return [...map.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
}

export function buildStaffFilterOptions(appointments: Appointment[]) {
  const map = new Map<string, string>()
  for (const apt of appointments) {
    if (apt.staffId && apt.staffName) {
      map.set(apt.staffId, apt.staffName)
    }
  }
  return [...map.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
}

export function hasActiveAppointmentHistoryFilters(filters: AppointmentHistoryFilters): boolean {
  return Boolean(
    filters.dateFrom ||
      filters.dateTo ||
      filters.serviceFilter ||
      filters.staffFilter ||
      filters.statusFilter ||
      filters.originFilter ||
      filters.textQuery.trim(),
  )
}
