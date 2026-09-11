import type { Appointment } from '@/types/booking'

import type { Locale } from '@/i18n/types'
import type { CustomerUpdateSource } from '@/lib/customer/updateSource'

export type Customer = {
  phone: string
  firstName: string
  lastName: string
  email: string | null
  notes: string | null
  locale: Locale
  /** YYYY-MM-DD */
  birthdate: string | null
  reviewRequestSentAt: string | null
  /** Origen del último cambio de ficha. */
  lastUpdateSource: CustomerUpdateSource | null
  appointmentCount: number
  lastAppointmentDate: string | null
  createdAt: string
  updatedAt: string
}

export type CustomerDetail = {
  customer: Omit<Customer, 'appointmentCount' | 'lastAppointmentDate'> & {
    reviewRequestSentAt?: string | null
  }
  appointments: Appointment[]
}
