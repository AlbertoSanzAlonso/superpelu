import type { Locale } from '@/i18n/types'
import type { SeriesScope } from '@server/appointments/seriesDates.js'
import type { SeriesConflictResolution } from '@server/appointments/recurringChain.js'

export type CreateAppointmentInput = {
  serviceId?: string
  serviceIds?: string[]
  staffId: string
  /** Un profesional por tratamiento (reserva multi); si falta, se repite staffId. */
  staffAssignments?: string[]
  /** Horas de inicio por tratamiento (misma longitud que serviceIds); si falta, se encadenan. */
  serviceStartTimes?: string[]
  date: string
  startTime: string
  customerName?: string
  customerFirstName?: string
  customerLastName?: string
  customerPhone: string
  customerEmail?: string
  customerNotes?: string
  notes?: string
  forStaffPortal?: boolean
  locale?: Locale
  /** Idioma en ficha del cliente (agenda); si no se envía, se usa el guardado o español. */
  customerLocale?: Locale
  /** Repetición periódica (agenda, uno o varios tratamientos). */
  scope?: SeriesScope
  endDate?: string
  /** Resoluciones de conflictos para series con múltiples tratamientos. */
  conflictResolutions?: SeriesConflictResolution[]
}

export type UpdateAppointmentInput = {
  serviceId?: string
  /** Varios tratamientos; si tiene más de uno, se reemplaza la cita entera. */
  serviceIds?: string[]
  /** Hora de inicio por tratamiento (misma longitud que serviceIds). */
  serviceStartTimes?: string[]
  staffId?: string
  date?: string
  startTime?: string
  customerName?: string
  customerFirstName?: string
  customerLastName?: string
  customerPhone?: string
  customerEmail?: string | null
  customerNotes?: string | null
  notes?: string | null
  customerLocale?: Locale
  /** Si es `false`, no se envía WhatsApp de reprogramación (p. ej. elección del admin). */
  notifyCustomerWhatsApp?: boolean
}
