import type { Locale } from '@/i18n/types'
import type { SeriesScope } from '@server/seriesDates.js'

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
  /** Repetición periódica (solo agenda, un tratamiento). */
  scope?: SeriesScope
  endDate?: string
}

export type UpdateAppointmentInput = {
  serviceId?: string
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
