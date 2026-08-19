import { splitCustomerName } from '@/lib/customer/name'
import { isGuestCustomerPhone } from '@/lib/customer/guestPhone'
import { normalizeLocale, type Locale } from '@/i18n/types'
import type { DayScheduleAppointment } from '@/types/booking'
import type { AppointmentRecurrenceScope } from '@/types/appointmentSeries'

export type AppointmentDraft = {
  serviceIds: string[]
  /** Hora de inicio individual por tratamiento (misma longitud que serviceIds); si vacío, se encadenan desde startTime. */
  serviceStartTimes: string[]
  /** Duración personalizada por tratamiento (minutos). Si es null/undefined, se usa la del catálogo. */
  serviceDurations: (number | null)[]
  /** Profesional asignado por tratamiento (misma longitud que serviceIds). Si vacío en posición i, usa el profesional activo. */
  staffAssignments: string[]
  startTime: string
  /** Fecha de la cita (YYYY-MM-DD). Al editar, permite cambiarla a un día distinto al de la agenda. */
  date: string
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
  serviceDurations: [],
  staffAssignments: [],
  startTime: '',
  date: '',
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
  /** Hermanos del mismo booking_group_id ordenados por startTime (incluye apt). */
  siblings?: DayScheduleAppointment[],
  /** Fecha de la cita (YYYY-MM-DD). Se usa para permitir cambiarla al editar. */
  appointmentDate?: string,
): AppointmentDraft {
  const { firstName, lastName } = splitCustomerName(apt.customerName)
  const base = {
    customerFirstName: firstName,
    customerLastName: lastName,
    customerPhone: isGuestCustomerPhone(apt.customerPhone) ? '' : apt.customerPhone,
    customerEmail: apt.customerEmail ?? customerProfile?.email ?? '',
    customerNotes: customerProfile?.notes ?? apt.customerNotes ?? '',
    notes: apt.notes ?? '',
    customerLocale: normalizeLocale(customerProfile?.locale ?? apt.customerLocale),
    recurrenceScope: 'single' as AppointmentRecurrenceScope,
    recurrenceEndDate: '',
    date: appointmentDate ?? '',
  }

  if (siblings && siblings.length > 1) {
    // Ordenar por hora de inicio y poblar el grupo completo
    const sorted = [...siblings].sort((a, b) => (a.startTime < b.startTime ? -1 : 1))
    return {
      ...base,
      serviceIds: sorted.map((s) => s.serviceId),
      serviceStartTimes: sorted.map((s) => s.startTime),
      serviceDurations: sorted.map((s) => s.durationMinutes),
      staffAssignments: sorted.map((s) => s.staffId ?? ''),
      startTime: sorted[0]!.startTime,
    }
  }

  return {
    ...base,
    serviceIds: [apt.serviceId],
    serviceStartTimes: [],
    serviceDurations: [apt.durationMinutes],
    staffAssignments: [apt.staffId ?? ''],
    startTime: apt.startTime,
  }
}
