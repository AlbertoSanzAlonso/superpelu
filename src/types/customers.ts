import type { Appointment } from '@/types/booking'

import type { Locale } from '@/i18n/types'
import type { CustomerUpdateSource } from '@/lib/customer/updateSource'

/** Persona que comparte el teléfono del titular. El titular sigue en la ficha. */
export type CustomerMember = {
  id: string
  firstName: string
  lastName: string
}

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
  /** Otras personas del mismo teléfono. Vacío si solo está el titular. */
  members: CustomerMember[]
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
