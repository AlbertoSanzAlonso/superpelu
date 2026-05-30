/** Tramos de 30 min con 30 min de pausa (tiempo de exposición del color). */
export const COLOR_SPLIT_SEGMENT_MINUTES = 30
export const COLOR_SPLIT_GAP_MINUTES = 30
export const COLOR_SPLIT_TOTAL_SPAN_MINUTES =
  COLOR_SPLIT_SEGMENT_MINUTES * 2 + COLOR_SPLIT_GAP_MINUTES

/** Servicios de coloración que reservan dos franjas de 30 min separadas por una pausa. */
export const COLOR_SPLIT_SERVICE_IDS = new Set([
  'svc-root-color',
  'svc-complete-color',
  'svc-all-over-color',
  'svc-color-block',
])

export type OccupiedSegment = {
  startMinutes: number
  durationMinutes: number
}

export function usesColorSplitBooking(serviceId: string): boolean {
  return COLOR_SPLIT_SERVICE_IDS.has(serviceId)
}

export function getBookingSpanMinutes(serviceId: string, durationMinutes: number): number {
  if (usesColorSplitBooking(serviceId)) return COLOR_SPLIT_TOTAL_SPAN_MINUTES
  return durationMinutes
}

export function getOccupiedSegmentsForBooking(
  serviceId: string,
  startMinutes: number,
  durationMinutes: number,
): OccupiedSegment[] {
  if (!usesColorSplitBooking(serviceId)) {
    return [{ startMinutes, durationMinutes }]
  }
  return [
    { startMinutes, durationMinutes: COLOR_SPLIT_SEGMENT_MINUTES },
    {
      startMinutes: startMinutes + COLOR_SPLIT_SEGMENT_MINUTES + COLOR_SPLIT_GAP_MINUTES,
      durationMinutes: COLOR_SPLIT_SEGMENT_MINUTES,
    },
  ]
}

export function getOccupiedSegmentsForAppointment(
  serviceId: string,
  startMinutes: number,
  durationMinutes: number,
): OccupiedSegment[] {
  if (usesColorSplitBooking(serviceId)) {
    return getOccupiedSegmentsForBooking(serviceId, startMinutes, durationMinutes)
  }
  return [{ startMinutes, durationMinutes }]
}

function segmentsOverlap(a: OccupiedSegment, b: OccupiedSegment): boolean {
  const endA = a.startMinutes + a.durationMinutes
  const endB = b.startMinutes + b.durationMinutes
  return a.startMinutes < endB && b.startMinutes < endA
}

export function occupiedSegmentsOverlap(
  a: OccupiedSegment[],
  b: OccupiedSegment[],
): boolean {
  return a.some((segA) => b.some((segB) => segmentsOverlap(segA, segB)))
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

export function formatAppointmentTimeRange(
  serviceId: string,
  startTime: string,
  durationMinutes: number,
  locale: 'es' | 'en' = 'es',
): string {
  if (!usesColorSplitBooking(serviceId)) {
    const start = timeToMinutes(startTime)
    return `${startTime} – ${minutesToTime(start + durationMinutes)}`
  }
  const start = timeToMinutes(startTime)
  const seg1End = start + COLOR_SPLIT_SEGMENT_MINUTES
  const seg2Start = start + COLOR_SPLIT_SEGMENT_MINUTES + COLOR_SPLIT_GAP_MINUTES
  const seg2End = start + COLOR_SPLIT_TOTAL_SPAN_MINUTES
  const connector = locale === 'en' ? 'and' : 'y'
  return `${startTime}–${minutesToTime(seg1End)} ${connector} ${minutesToTime(seg2Start)}–${minutesToTime(seg2End)}`
}

export type AppointmentOccupiedSlot = {
  startTime: string
  endTime: string
}

export function appointmentOccupiedSlots(
  serviceId: string,
  startTime: string,
  durationMinutes: number,
): AppointmentOccupiedSlot[] {
  const startMinutes = timeToMinutes(startTime)
  return getOccupiedSegmentsForAppointment(serviceId, startMinutes, durationMinutes).map(
    (seg) => ({
      startTime: minutesToTime(seg.startMinutes),
      endTime: minutesToTime(seg.startMinutes + seg.durationMinutes),
    }),
  )
}
