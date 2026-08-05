import type { AppointmentDraft } from '@/components/agenda/staff/types'
import type { BookableService } from '@/types/booking'

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

export type ServiceOverlap = {
  indexA: number
  indexB: number
  nameA: string
  nameB: string
}

export function checkServiceOverlaps(
  draft: AppointmentDraft,
  services: BookableService[],
  /** Profesional por defecto si `staffAssignments[i]` está vacío. */
  defaultStaffId?: string,
): ServiceOverlap[] {
  const overlaps: ServiceOverlap[] = []
  const filteredIds = draft.serviceIds.filter((id) => id !== '')
  const startTimes = draft.serviceStartTimes
  const durations = draft.serviceDurations
  const staffAssignments = draft.staffAssignments

  if (filteredIds.length < 2) return overlaps

  const entries: Array<{
    index: number
    serviceId: string
    staffId: string
    startMinutes: number
    endMinutes: number
    name: string
  }> = []

  for (let i = 0; i < draft.serviceIds.length; i++) {
    const serviceId = draft.serviceIds[i]
    if (!serviceId) continue
    const startTime = startTimes[i]
    const duration = durations[i]

    if (!startTime) continue

    const service = services.find((s) => s.id === serviceId)
    if (!service) continue

    const startMinutes = timeToMinutes(startTime)
    const durationMinutes = duration && duration > 0 ? duration : service.durationMinutes
    const endMinutes = startMinutes + durationMinutes
    const staffId = staffAssignments[i] || defaultStaffId || ''

    entries.push({
      index: i,
      serviceId,
      staffId,
      startMinutes,
      endMinutes,
      name: service.nameEs,
    })
  }

  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const a = entries[i]
      const b = entries[j]
      // Solo solape real si es el mismo especialista (pueden ir en paralelo con otro).
      if (a.staffId && b.staffId && a.staffId !== b.staffId) continue

      if (a.startMinutes < b.endMinutes && b.startMinutes < a.endMinutes) {
        overlaps.push({
          indexA: a.index,
          indexB: b.index,
          nameA: a.name,
          nameB: b.name,
        })
      }
    }
  }

  return overlaps
}
