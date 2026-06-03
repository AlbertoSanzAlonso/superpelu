import type { Appointment } from '@/types/booking'

import type { Locale } from '@/i18n/types'

export type Customer = {
  phone: string
  firstName: string
  lastName: string
  email: string | null
  notes: string | null
  locale: Locale
  appointmentCount: number
  lastAppointmentDate: string | null
  createdAt: string
  updatedAt: string
}

export type CustomerDetail = {
  customer: Omit<Customer, 'appointmentCount' | 'lastAppointmentDate'>
  appointments: Appointment[]
}
