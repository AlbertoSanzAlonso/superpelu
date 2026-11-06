import { formatCustomerDisplayName, splitCustomerName } from '@/lib/customer/name'
import { isGuestCustomerPhone } from '@/lib/customer/guestPhone'
import { normalizeLocale, type Locale } from '@/i18n/types'
import type { DayScheduleAppointment } from '@/types/booking'
import type { AppointmentRecurrenceScope } from '@/types/appointmentSeries'

export type HouseholdMemberDraft = {
  id: string
  firstName: string
  lastName: string
  /** Esta cita es para esta persona, no para el titular. */
  attendee: boolean
}

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
  /** Personas del mismo teléfono. `attendee` es quien viene a esta cita. */
  householdMembers: HouseholdMemberDraft[]
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
  householdMembers: [],
  recurrenceScope: 'single',
  recurrenceEndDate: '',
}

export function householdMembersForAppointment(
  members: { id: string; firstName: string; lastName: string }[],
  attendeeId: string | null | undefined,
  attendeeNameFallback = '',
): HouseholdMemberDraft[] {
  const list = members.map((member) => ({
    id: member.id,
    firstName: member.firstName,
    lastName: member.lastName,
    attendee: Boolean(attendeeId) && member.id === attendeeId,
  }))
  if (attendeeId && !list.some((member) => member.attendee)) {
    const split = splitCustomerName(attendeeNameFallback)
    if (split.firstName) {
      list.push({
        id: attendeeId,
        firstName: split.firstName,
        lastName: split.lastName,
        attendee: true,
      })
    }
  }
  return list
}

export const NEW_MEMBER_ID_PREFIX = 'new:'

/** Datos de miembro para la cita. Vacío si es del titular, salvo `explicitSelf`. */
export function appointmentMemberBooking(
  members: HouseholdMemberDraft[],
  options?: { explicitSelf?: boolean },
): {
  appointmentFor?: 'self' | 'other'
  memberId?: string
  memberName?: string
} {
  const attendee = members.find((member) => member.attendee)
  if (!attendee) return options?.explicitSelf ? { appointmentFor: 'self' } : {}
  const name = formatCustomerDisplayName(attendee.firstName, attendee.lastName)
  if (!name) return options?.explicitSelf ? { appointmentFor: 'self' } : {}
  if (attendee.id.startsWith(NEW_MEMBER_ID_PREFIX)) {
    return { appointmentFor: 'other', memberName: name }
  }
  return { appointmentFor: 'other', memberId: attendee.id }
}

export function formatHouseholdMembersField(members: HouseholdMemberDraft[]): string {
  return members
    .map((member) => {
      const name = formatCustomerDisplayName(member.firstName, member.lastName)
      if (!name) return ''
      return member.attendee ? `${name} (esta cita)` : name
    })
    .filter(Boolean)
    .join(', ')
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
  const profileFirstName = apt.profileFirstName?.trim() ?? ''
  const profileLastName = apt.profileLastName?.trim() ?? ''
  const hasProfile = profileFirstName.length > 0
  const snapshot = hasProfile
    ? { firstName: profileFirstName, lastName: profileLastName }
    : splitCustomerName(apt.customerName)
  const base = {
    customerFirstName: snapshot.firstName,
    customerLastName: snapshot.lastName,
    customerPhone: isGuestCustomerPhone(apt.customerPhone) ? '' : apt.customerPhone,
    customerEmail: apt.customerEmail ?? customerProfile?.email ?? '',
    customerNotes: customerProfile?.notes ?? apt.customerNotes ?? '',
    notes: apt.notes ?? '',
    customerLocale: normalizeLocale(customerProfile?.locale ?? apt.customerLocale),
    householdMembers: householdMembersForAppointment(
      apt.householdMembers ?? [],
      apt.customerMemberId,
      apt.customerName,
    ),
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
