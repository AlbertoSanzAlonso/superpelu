export type BookableService = {
  id: string
  name: string
  durationMinutes: number
}

export type Appointment = {
  id: string
  serviceId: string
  serviceName: string
  durationMinutes: number
  date: string
  startTime: string
  customerName: string
  customerPhone: string
  customerEmail: string | null
  notes: string | null
  status: string
  createdAt: string
}

export type CreateAppointmentPayload = {
  serviceId: string
  date: string
  startTime: string
  customerName: string
  customerPhone: string
  customerEmail?: string
  notes?: string
}
