import { buildFlexibleServiceStartTimes } from '@/lib/booking/combo'
import type { AppointmentDraft } from '@/components/agenda/staff/types'
import {
  fetchAdminChainContinuation,
  fetchAdminDaySlots,
  fetchAdminMultiSlots,
} from '@/lib/api/admin'
import type { BookableService } from '@/types/booking'

export type AvailabilityCheckInput = {
  date: string
  adminToken: string
  activeStaffId: string
  draft: AppointmentDraft
  services: BookableService[]
  editingId?: string | null
  forceSchedule?: boolean
}

function resolveServiceLines(
  serviceIds: string[],
  draft: AppointmentDraft,
  services: BookableService[],
) {
  return serviceIds.map((id, index) => {
    const customDuration = draft.serviceDurations[index]
    const catalog = services.find((service) => service.id === id)
    return {
      id,
      category: catalog?.categoryId ?? '',
      durationMinutes:
        customDuration != null && customDuration > 0
          ? customDuration
          : (catalog?.durationMinutes ?? 0),
    }
  })
}

/** Comprueba si el borrador de cita chocaría con la disponibilidad real (misma lógica que el servidor al guardar). */
export async function resolveAdminAppointmentConflict(
  input: AvailabilityCheckInput,
): Promise<string | null> {
  const { date, adminToken, activeStaffId, draft, services, editingId, forceSchedule } = input
  if (forceSchedule || !draft.startTime) return null

  const serviceIds = draft.serviceIds.filter((id) => id !== '')
  if (serviceIds.length === 0) return null

  const excludeAppointmentId = editingId ?? undefined
  const serviceDurations = draft.serviceDurations

  if (serviceIds.length === 1) {
    const { slots, slotsOverHours } = await fetchAdminMultiSlots(
      date,
      serviceIds,
      activeStaffId,
      adminToken,
      excludeAppointmentId,
      serviceDurations,
    )
    const allSlots = [...slots, ...slotsOverHours]
    if (allSlots.length > 0 && !allSlots.includes(draft.startTime)) {
      return 'La hora seleccionada no está disponible'
    }
    return null
  }

  const daySlots = await fetchAdminDaySlots(
    date,
    serviceIds,
    adminToken,
    excludeAppointmentId,
    serviceDurations,
  )
  if (daySlots.length > 0 && !daySlots.includes(draft.startTime)) {
    return 'La hora seleccionada no está disponible para todos los tratamientos'
  }

  const effectiveServices = resolveServiceLines(serviceIds, draft, services)
  const staffAssignments =
    draft.staffAssignments.length === serviceIds.length
      ? draft.staffAssignments.map((id) => id || activeStaffId)
      : serviceIds.map(() => activeStaffId)

  const rawOverrides =
    draft.serviceStartTimes.length === serviceIds.length ? draft.serviceStartTimes : []
  const serviceStartTimes = buildFlexibleServiceStartTimes(
    effectiveServices,
    draft.startTime,
    rawOverrides,
  )
  const chainedDefault = buildFlexibleServiceStartTimes(effectiveServices, draft.startTime, [])
  const serviceStartOverrides = serviceStartTimes.map((time, index) =>
    time === chainedDefault[index] || !time ? undefined : time,
  )

  const chain = await fetchAdminChainContinuation(
    date,
    serviceIds,
    draft.startTime,
    staffAssignments,
    adminToken,
    {
      excludeAppointmentId,
      serviceDurations,
      serviceStartOverrides,
    },
  )

  if (!chain.complete) {
    return 'La hora seleccionada no está disponible para todos los tratamientos'
  }

  return null
}
