import { splitCustomerName } from '@/lib/customer/name'
import { normalizeLocale, type Locale } from '@/i18n/types'
import type { DayScheduleAppointment } from '@/types/booking'
import type { AppointmentRecurrenceScope } from '@/types/appointmentSeries'

export type AppointmentDraft = {
  serviceIds: string[]
  /** Hora de inicio individual por tratamiento (misma longitud que serviceIds); si vacío, se encadenan desde startTime. */
  serviceStartTimes: string[]
  startTime: string
  customerFirstName: string
  customerLastName: string
  customerPhone: string
  customerEmail: string
  /** Notas en la ficha del cliente (`customers.notes`). */
  customerNotes: string
  /** Notas de esta cita (`appointments.notes`). */
  notes: string
  /** Idioma en ficha del cliente (`customers.locale`). */
  customerLocale: Locale
  recurrenceScope: AppointmentRecurrenceScope
  recurrenceEndDate: string
}

export const EMPTY_APPOINTMENT_DRAFT: AppointmentDraft = {
  serviceIds: [],
  serviceStartTimes: [],
  startTime: '',
  customerFirstName: '',
  customerLastName: '',
  customerPhone: '',
  customerEmail: '',
  customerNotes: '',
  notes: '',
  customerLocale: 'es',
  recurrenceScope: 'single',
  recurrenceEndDate: '',
}

export function appointmentToDraft(
  apt: DayScheduleAppointment,
  customerProfile?: {
    email: string | null
    notes: string | null
    locale?: string | null
  },
): AppointmentDraft {
  const { firstName, lastName } = splitCustomerName(apt.customerName)
  return {
    serviceIds: [apt.serviceId],
    serviceStartTimes: [],
    startTime: apt.startTime,
    customerFirstName: firstName,
    customerLastName: lastName,
    customerPhone: apt.customerPhone,
    customerEmail: apt.customerEmail ?? customerProfile?.email ?? '',
    customerNotes: customerProfile?.notes ?? apt.customerNotes ?? '',
    notes: apt.notes ?? '',
    customerLocale: normalizeLocale(customerProfile?.locale ?? apt.customerLocale),
    recurrenceScope: 'single',
    recurrenceEndDate: '',
  }
}
