import type { DayScheduleAppointment } from '@/types/booking'

export type AppointmentDraft = {
  serviceId: string
  startTime: string
  customerName: string
  customerPhone: string
  customerEmail: string
  notes: string
}

export const EMPTY_APPOINTMENT_DRAFT: AppointmentDraft = {
  serviceId: '',
  startTime: '',
  customerName: '',
  customerPhone: '',
  customerEmail: '',
  notes: '',
}

export function appointmentToDraft(apt: DayScheduleAppointment): AppointmentDraft {
  return {
    serviceId: apt.serviceId,
    startTime: apt.startTime,
    customerName: apt.customerName,
    customerPhone: apt.customerPhone,
    customerEmail: '',
    notes: '',
  }
}
