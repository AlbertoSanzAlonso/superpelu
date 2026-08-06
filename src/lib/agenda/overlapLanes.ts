import {
  getOccupiedSegmentsForAppointment,
  occupiedSegmentsOverlap,
  type OccupiedSegmentOptions,
} from '@/lib/booking/occupancy'
import { timeToMinutes } from '@/lib/agenda/adminCalendar'

export type OverlapLaneAppointment = {
  id: string
  serviceId: string
  startTime: string
  durationMinutes: number
  colorGroupRole?: string | null
  bookingPattern?: OccupiedSegmentOptions['bookingPattern']
}

export type OverlapLaneLayout = {
  laneIndex: number
  laneCount: number
  /** Porcentaje 0–100 respecto al ancho de la columna. */
  leftPercent: number
  /** Porcentaje 0–100 del ancho de la columna. */
  widthPercent: number
}

/** Hueco solo entre lanes solapadas; las fichas llegan al borde de la columna. */
const INTER_LANE_GAP_PERCENT = 1

function appointmentSegments(apt: OverlapLaneAppointment) {
  return getOccupiedSegmentsForAppointment(
    apt.serviceId,
    timeToMinutes(apt.startTime),
    apt.durationMinutes,
    {
      colorGroupRole: apt.colorGroupRole,
      bookingPattern: apt.bookingPattern,
    },
  )
}

function appointmentsOverlap(a: OverlapLaneAppointment, b: OverlapLaneAppointment): boolean {
  return occupiedSegmentsOverlap(appointmentSegments(a), appointmentSegments(b))
}

function earliestStart(apt: OverlapLaneAppointment): number {
  const segs = appointmentSegments(apt)
  if (segs.length === 0) return timeToMinutes(apt.startTime)
  return Math.min(...segs.map((s) => s.startMinutes))
}

export const FULL_WIDTH_LANE: OverlapLaneLayout = {
  laneIndex: 0,
  laneCount: 1,
  leftPercent: 0,
  widthPercent: 100,
}

/**
 * Empaqueta citas solapadas en lanes lado a lado (estilo calendario BUK).
 * Sin solape → laneCount 1 y ancho completo de la columna.
 */
export function assignOverlapLanes(
  appointments: readonly OverlapLaneAppointment[],
): Map<string, OverlapLaneLayout> {
  const result = new Map<string, OverlapLaneLayout>()
  if (appointments.length === 0) return result

  const sorted = [...appointments].sort((a, b) => {
    const startDiff = earliestStart(a) - earliestStart(b)
    if (startDiff !== 0) return startDiff
    return a.id.localeCompare(b.id)
  })

  const n = sorted.length
  const parent = Array.from({ length: n }, (_, i) => i)

  function find(i: number): number {
    if (parent[i] !== i) parent[i] = find(parent[i]!)
    return parent[i]!
  }

  function union(i: number, j: number) {
    const ri = find(i)
    const rj = find(j)
    if (ri !== rj) parent[ri] = rj
  }

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (appointmentsOverlap(sorted[i]!, sorted[j]!)) union(i, j)
    }
  }

  const clusters = new Map<number, number[]>()
  for (let i = 0; i < n; i++) {
    const root = find(i)
    const list = clusters.get(root) ?? []
    list.push(i)
    clusters.set(root, list)
  }

  for (const indices of clusters.values()) {
    const clusterApts = indices.map((i) => sorted[i]!)
    const laneById = new Map<string, number>()
    const laneSegments: { start: number; end: number }[][] = []

    for (const apt of clusterApts) {
      const segs = appointmentSegments(apt)
      let assigned = -1
      for (let lane = 0; lane < laneSegments.length; lane++) {
        const occupied = laneSegments[lane]!
        const overlaps = segs.some((seg) => {
          const segEnd = seg.startMinutes + seg.durationMinutes
          return occupied.some((o) => seg.startMinutes < o.end && o.start < segEnd)
        })
        if (!overlaps) {
          assigned = lane
          break
        }
      }
      if (assigned < 0) {
        assigned = laneSegments.length
        laneSegments.push([])
      }
      for (const seg of segs) {
        laneSegments[assigned]!.push({
          start: seg.startMinutes,
          end: seg.startMinutes + seg.durationMinutes,
        })
      }
      laneById.set(apt.id, assigned)
    }

    const laneCount = Math.max(laneSegments.length, 1)
    const gap = laneCount > 1 ? INTER_LANE_GAP_PERCENT : 0
    const widthPercent = (100 - gap * (laneCount - 1)) / laneCount

    for (const apt of clusterApts) {
      const laneIndex = laneById.get(apt.id) ?? 0
      const leftPercent = laneIndex * (widthPercent + gap)
      result.set(apt.id, {
        laneIndex,
        laneCount,
        leftPercent,
        widthPercent,
      })
    }
  }

  return result
}
