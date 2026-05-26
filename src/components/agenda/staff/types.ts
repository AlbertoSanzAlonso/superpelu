import { splitCustomerName } from '@/lib/customerName'
import type { DayScheduleAppointment } from '@/types/booking'

export type AppointmentDraft = {
  serviceId: string
  startTime: string
  customerFirstName: string
  customerLastName: string
  customerPhone: string
  customerEmail: string
  notes: string
}

export const EMPTY_APPOINTMENT_DRAFT: AppointmentDraft = {
  serviceId: '',
  startTime: '',
  customerFirstName: '',
  customerLastName: '',
  customerPhone: '',
  customerEmail: '',
  notes: '',
}

export function appointmentToDraft(apt: DayScheduleAppointment): AppointmentDraft {
  const { firstName, lastName } = splitCustomerName(apt.customerName)
  return {
    serviceId: apt.serviceId,
    startTime: apt.startTime,
    customerFirstName: firstName,
    customerLastName: lastName,
    customerPhone: apt.customerPhone,
    customerEmail: '',
    notes: '',
  }
}
