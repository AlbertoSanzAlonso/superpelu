export type ServiceCategory = {
  id: string
  nameEs: string
  nameEn: string
  sortOrder: number
  /** Precio «desde» en céntimos (null si no aplica o consultar). */
  priceFromCents: number | null
  priceNote: string | null
}

export type BookableService = {
  id: string
  nameEs: string
  nameEn: string
  durationMinutes: number
  categoryId: string | null
  showDurationInBooking?: boolean
}

export type StaffMember = {
  id: string
  name: string
  role: string | null
}

export type AppointmentOccupiedSlot = {
  startTime: string
  endTime: string
}

export type Appointment = {
  id: string
  staffId: string | null
  staffName: string | null
  serviceId: string
  serviceName: string
  durationMinutes: number
  occupiedSlots?: AppointmentOccupiedSlot[]
  colorGroupRole?: string | null
  date: string
  startTime: string
  customerName: string
  customerPhone: string
  customerEmail: string | null
  notes: string | null
  status: string
  locale?: 'es' | 'en'
  createdAt: string
  seriesId?: string | null
  scope?: string | null
}

export type ColorGroupLinkedPhase = {
  id: string
  startTime: string
  endTime: string
  serviceId: string
  serviceName: string
  staffId: string
  staffName: string
  categoryId: string | null
}

export type DayScheduleAppointment = {
  id: string
  startTime: string
  endTime: string
  durationMinutes: number
  serviceId: string
  serviceName: string
  categoryId: string | null
  customerName: string
  customerPhone: string
  customerEmail: string | null
  /** Notas en ficha del cliente (`customers.notes`), si existe el teléfono en el listado. */
  customerNotes?: string | null
  /** Idioma en ficha del cliente (`customers.locale`). */
  customerLocale?: 'es' | 'en'
  notes: string | null
  status: string
  createdAt: string
  occupiedSlots: AppointmentOccupiedSlot[]
  colorGroupId?: string | null
  colorGroupRole?: string | null
  /** Varias citas de la misma visita (reserva multi-tratamiento). */
  bookingGroupId?: string | null
  /** Fase enlazada (lavado si esta fila es color, o color si esta fila es lavado). */
  colorGroupLinked?: ColorGroupLinkedPhase | null
  /** Serie periódica (agenda). */
  seriesId?: string | null
  scope?: string | null
}

export type DayScheduleBlock = {
  id: string
  startTime: string
  endTime: string
  note: string | null
}

export type StaffDaySchedule = {
  staffId: string
  staffName: string
  working: boolean
  windows: { startTime: string; endTime: string }[]
  appointments: DayScheduleAppointment[]
  blocks: DayScheduleBlock[]
  freeSlots: string[]
}

export type BookingChainSegmentPlan = {
  serviceIndex: number
  serviceId: string
  startTime: string
  staffId: string
  staffName: string
}

export type BookingChainContinuation =
  | { complete: true; segments: BookingChainSegmentPlan[] }
  | {
      complete: false
      needsTimeChange: boolean
      segments: BookingChainSegmentPlan[]
      next?: {
        serviceIndex: number
        startTime: string
        staff: StaffMember[]
        availableStaffIds: string[]
      }
      conflict?: {
        serviceIndex: number
        staffId: string
      }
      postpone?: {
        serviceIndex: number
        idealStartTime: string
        slots: string[]
      }
    }

export type CreateAppointmentPayload = {
  serviceId?: string
  serviceIds?: string[]
  staffId: string
  staffAssignments?: string[]
  serviceStartTimes?: string[]
  date: string
  startTime: string
  customerName: string
  customerPhone: string
  customerEmail?: string
  notes?: string
  locale?: 'es' | 'en'
}
