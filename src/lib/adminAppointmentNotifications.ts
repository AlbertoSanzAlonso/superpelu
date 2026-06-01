import { isColorGroupWashRow } from '@/lib/bookingOccupancy'
import { addDaysToDateString, todaySalon } from '@/lib/dates'
import type { Appointment } from '@/types/booking'

export type AdminAppointmentNotificationItem = {
  id: string
  date: string
  staffId: string
  staffName: string
  customerName: string
  serviceName: string
  startTime: string
}

export const ADMIN_APPOINTMENT_NOTIFY_RANGE_DAYS = 90
export const ADMIN_APPOINTMENT_TOAST_MS = 6_000

export function adminAppointmentNotifyDateRange(): { from: string; to: string } {
  const from = todaySalon()
  return { from, to: addDaysToDateString(from, ADMIN_APPOINTMENT_NOTIFY_RANGE_DAYS) }
}

export function isNotifyableAdminAppointment(apt: Appointment): boolean {
  if (apt.status === 'cancelled') return false
  if (!apt.staffId) return false
  return !isColorGroupWashRow(apt.colorGroupRole)
}

export function appointmentToNotificationItem(apt: Appointment): AdminAppointmentNotificationItem | null {
  if (!isNotifyableAdminAppointment(apt)) return null
  return {
    id: apt.id,
    date: apt.date,
    staffId: apt.staffId!,
    staffName: apt.staffName ?? '',
    customerName: apt.customerName,
    serviceName: apt.serviceName,
    startTime: apt.startTime,
  }
}

export function formatAdminAppointmentNotificationTime(startTime: string): string {
  return startTime.slice(0, 5)
}
