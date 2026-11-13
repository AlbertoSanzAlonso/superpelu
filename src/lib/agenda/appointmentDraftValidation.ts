import type { AppointmentDraft } from '@/components/agenda/staff/types'

export type StaffAppointmentValidationInput = {
  draft: AppointmentDraft
  /** Profesional de la columna/agenda (admin) o el de la sesión (profesional). */
  staffId?: string | null
  /** Día de la agenda si el borrador aún no tiene fecha propia. */
  agendaDate?: string
  /** En alta sin móvil, el flujo de «cliente sin ficha» cubre el teléfono. */
  requirePhone?: boolean
}

/** Campos obligatorios que faltan para guardar una cita desde agenda. */
export function missingStaffAppointmentFields({
  draft,
  staffId,
  agendaDate,
  requirePhone = false,
}: StaffAppointmentValidationInput): string[] {
  const missing: string[] = []
  const serviceIds = draft.serviceIds.filter((id) => id !== '')
  if (!staffId?.trim()) missing.push('profesional')
  if (serviceIds.length === 0) missing.push('tratamiento')
  if (!(draft.date || agendaDate || '').trim()) missing.push('fecha')
  if (!draft.startTime.trim()) missing.push('hora')
  if (!draft.customerFirstName.trim()) missing.push('nombre del cliente')
  if (requirePhone && !draft.customerPhone.trim()) missing.push('teléfono')
  return missing
}

export function incompleteAppointmentMessage(missing: string[]): string {
  if (missing.length === 0) return 'Faltan datos para guardar la cita.'
  if (missing.length === 1) return `Falta: ${missing[0]}.`
  return `Falta: ${missing.join(', ')}.`
}
