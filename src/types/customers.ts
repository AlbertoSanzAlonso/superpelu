import type { Appointment } from '@/types/booking'

export type Customer = {
  phone: string
  firstName: string
  lastName: string
  email: string | null
  notes: string | null
  appointmentCount: number
  lastAppointmentDate: string | null
  createdAt: string
  updatedAt: string
}

export type CustomerDetail = {
  customer: Omit<Customer, 'appointmentCount' | 'lastAppointmentDate'>
  appointments: Appointment[]
}
