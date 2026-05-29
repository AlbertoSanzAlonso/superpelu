import { splitCustomerName } from '@/lib/customerName'
import type { DayScheduleAppointment } from '@/types/booking'

export type AppointmentDraft = {
  serviceId: string
  startTime: string
  customerFirstName: string
  customerLastName: string
  customerPhone: string
  customerEmail: string
  /** Notas en la ficha del cliente (`customers.notes`). */
  customerNotes: string
  /** Notas de esta cita (`appointments.notes`). */
  notes: string
}

export const EMPTY_APPOINTMENT_DRAFT: AppointmentDraft = {
  serviceId: '',
  startTime: '',
  customerFirstName: '',
  customerLastName: '',
  customerPhone: '',
  customerEmail: '',
  customerNotes: '',
  notes: '',
}

export function appointmentToDraft(
  apt: DayScheduleAppointment,
  customerProfile?: { email: string | null; notes: string | null },
): AppointmentDraft {
  const { firstName, lastName } = splitCustomerName(apt.customerName)
  return {
    serviceId: apt.serviceId,
    startTime: apt.startTime,
    customerFirstName: firstName,
    customerLastName: lastName,
    customerPhone: apt.customerPhone,
    customerEmail: apt.customerEmail ?? customerProfile?.email ?? '',
    customerNotes: customerProfile?.notes ?? '',
    notes: apt.notes ?? '',
  }
}
