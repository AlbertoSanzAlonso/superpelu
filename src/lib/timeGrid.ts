import { salonSchedule } from '@/data/schedule'
import { nowSalonMinutes, todaySalon } from '@/lib/dates'
import {
  getOccupiedSegmentsForAppointment,
  isColorGroupWashRow,
  occupiedSegmentsOverlap,
} from '@/lib/bookingOccupancy'
import { truncateNotesPreview } from '@/lib/notes'
import type { StaffDaySchedule } from '@/types/booking'

export type TimeGridCellStatus = 'free' | 'appointment' | 'block' | 'past'

export type TimeGridCell = {
  time: string
  status: TimeGridCellStatus
  title?: string
  subtitle?: string
  /** Texto completo de observaciones de la cita (tooltip). */
  appointmentNotes?: string
  appointmentId?: string
  categoryId?: string | null
  serviceId?: string
  blockId?: string
  colorGroupRole?: string | null
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function rangeOverlaps(
  startA: number,
  endA: number,
  startB: number,
  endB: number,
): boolean {
  return startA < endB && startB < endA
}

/** Celdas de la grilla del día (cada celda = inicio de franja de slotMinutes). */
export function buildStaffDayGrid(
  schedule: StaffDaySchedule,
  date: string,
  slotMinutes = salonSchedule.slotMinutes,
): TimeGridCell[] {
  if (!schedule.working || !schedule.window) return []

  const startMin = timeToMinutes(schedule.window.startTime)
  const endMin = timeToMinutes(schedule.window.endTime)
  const isToday = date === todaySalon()
  const nowMin = isToday ? nowSalonMinutes() : null

  const cells: TimeGridCell[] = []

  for (let slotStart = startMin; slotStart < endMin; slotStart += slotMinutes) {
    const slotEnd = slotStart + slotMinutes
    const time = minutesToTime(slotStart)

    if (isToday && nowMin !== null && slotStart < nowMin) {
      cells.push({ time, status: 'past' })
      continue
    }

    const slotSegment = { startMinutes: slotStart, durationMinutes: slotMinutes }
    const apt = schedule.appointments.find((a) => {
      const aptSegments = getOccupiedSegmentsForAppointment(
        a.serviceId,
        timeToMinutes(a.startTime),
        a.durationMinutes,
        { colorGroupRole: a.colorGroupRole },
      )
      return occupiedSegmentsOverlap([slotSegment], aptSegments)
    })

    if (apt) {
      const aptSegments = getOccupiedSegmentsForAppointment(
        apt.serviceId,
        timeToMinutes(apt.startTime),
        apt.durationMinutes,
        { colorGroupRole: apt.colorGroupRole },
      )
      const isSegmentStart = aptSegments.some((seg) => seg.startMinutes === slotStart)
      const serviceLabel = isColorGroupWashRow(apt.colorGroupRole)
        ? 'Lavar color'
        : apt.serviceName
      const notesPreview = isSegmentStart ? truncateNotesPreview(apt.notes, 36) : undefined
      const subtitleParts = [serviceLabel, notesPreview].filter(Boolean)
      cells.push({
        time,
        status: 'appointment',
        appointmentId: apt.id,
        categoryId: apt.categoryId,
        serviceId: apt.serviceId,
        colorGroupRole: apt.colorGroupRole,
        title: isSegmentStart ? apt.customerName : undefined,
        subtitle: isSegmentStart && subtitleParts.length > 0 ? subtitleParts.join(' · ') : undefined,
        appointmentNotes: isSegmentStart ? apt.notes?.trim() || undefined : undefined,
      })
      continue
    }

    const block = schedule.blocks.find((b) => {
      const bStart = timeToMinutes(b.startTime)
      const bEnd = timeToMinutes(b.endTime)
      return rangeOverlaps(slotStart, slotEnd, bStart, bEnd)
    })

    if (block) {
      const isStart = timeToMinutes(block.startTime) === slotStart
      cells.push({
        time,
        status: 'block',
        blockId: block.id,
        title: isStart ? 'Bloqueado' : undefined,
        subtitle: isStart && block.note ? block.note : undefined,
      })
      continue
    }

    cells.push({ time, status: 'free' })
  }

  return cells
}

export function groupContiguousSlotTimes(
  times: string[],
  slotMinutes = salonSchedule.slotMinutes,
): { startTime: string; endTime: string }[] {
  if (times.length === 0) return []

  const sorted = [...times].sort((a, b) => timeToMinutes(a) - timeToMinutes(b))
  const groups: { startTime: string; endTime: string }[] = []

  let rangeStart = sorted[0]
  let rangeEndMin = timeToMinutes(sorted[0]) + slotMinutes

  for (let i = 1; i < sorted.length; i++) {
    const current = timeToMinutes(sorted[i])
    if (current === rangeEndMin) {
      rangeEndMin = current + slotMinutes
    } else {
      groups.push({ startTime: rangeStart, endTime: minutesToTime(rangeEndMin) })
      rangeStart = sorted[i]
      rangeEndMin = current + slotMinutes
    }
  }

  groups.push({ startTime: rangeStart, endTime: minutesToTime(rangeEndMin) })
  return groups
}

export type GridSelectionSummary = {
  freeTimes: string[]
  blockIds: string[]
  hasAppointment: boolean
}

export function summarizeGridSelection(
  selectedTimes: Iterable<string>,
  cells: TimeGridCell[],
): GridSelectionSummary {
  const selected = new Set(selectedTimes)
  const freeTimes: string[] = []
  const blockIds = new Set<string>()
  let hasAppointment = false

  for (const cell of cells) {
    if (!selected.has(cell.time)) continue
    if (cell.status === 'free') freeTimes.push(cell.time)
    if (cell.status === 'block' && cell.blockId) blockIds.add(cell.blockId)
    if (cell.status === 'appointment') hasAppointment = true
  }

  return {
    freeTimes: freeTimes.sort((a, b) => timeToMinutes(a) - timeToMinutes(b)),
    blockIds: [...blockIds],
    hasAppointment,
  }
}
