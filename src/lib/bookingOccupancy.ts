/** Tramos de 30 min con 30 min de pausa (tiempo de exposición del color). */
export const COLOR_SPLIT_SEGMENT_MINUTES = 30
export const COLOR_SPLIT_GAP_MINUTES = 30
export const COLOR_SPLIT_TOTAL_SPAN_MINUTES =
  COLOR_SPLIT_SEGMENT_MINUTES * 2 + COLOR_SPLIT_GAP_MINUTES

export const WASH_COLOR_SERVICE_ID = 'svc-wash-color'

export const COLOR_GROUP_ROLE = {
  color: 'color',
  wash: 'wash',
} as const

export type ColorGroupRole = (typeof COLOR_GROUP_ROLE)[keyof typeof COLOR_GROUP_ROLE]

/** Servicios de coloración que reservan dos franjas de 30 min separadas por una pausa. */
export const COLOR_SPLIT_SERVICE_IDS = new Set([
  'svc-root-color',
  'svc-complete-color',
  'svc-color-block',
])

export type OccupiedSegment = {
  startMinutes: number
  durationMinutes: number
}

export type OccupiedSegmentOptions = {
  colorGroupRole?: string | null
}

export function usesColorSplitBooking(serviceId: string): boolean {
  return COLOR_SPLIT_SERVICE_IDS.has(serviceId)
}

export function isColorGroupWashRow(colorGroupRole: string | null | undefined): boolean {
  return colorGroupRole === COLOR_GROUP_ROLE.wash
}

export function isColorGroupColorRow(colorGroupRole: string | null | undefined): boolean {
  return colorGroupRole === COLOR_GROUP_ROLE.color
}

/** Citas antiguas: una sola fila con duración de 90 min y sin `color_group_role`. */
export function isLegacyColorSplitAppointment(
  serviceId: string,
  durationMinutes: number,
  colorGroupRole?: string | null,
): boolean {
  return (
    usesColorSplitBooking(serviceId) &&
    !colorGroupRole &&
    durationMinutes >= COLOR_SPLIT_TOTAL_SPAN_MINUTES
  )
}

export function getWashPhaseStartMinutes(colorStartMinutes: number): number {
  return colorStartMinutes + COLOR_SPLIT_SEGMENT_MINUTES + COLOR_SPLIT_GAP_MINUTES
}

export function getBookingSpanMinutes(serviceId: string, durationMinutes: number): number {
  if (usesColorSplitBooking(serviceId)) return COLOR_SPLIT_TOTAL_SPAN_MINUTES
  return durationMinutes
}

/** Duración mostrada al cliente (reserva, WhatsApp, calendario). */
export function getCustomerFacingDurationMinutes(
  serviceId: string,
  durationMinutes: number,
  colorGroupRole?: string | null,
): number {
  if (isColorGroupColorRow(colorGroupRole) && usesColorSplitBooking(serviceId)) {
    return COLOR_SPLIT_TOTAL_SPAN_MINUTES
  }
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
      startMinutes: getWashPhaseStartMinutes(startMinutes),
      durationMinutes: COLOR_SPLIT_SEGMENT_MINUTES,
    },
  ]
}

export function getOccupiedSegmentsForAppointment(
  serviceId: string,
  startMinutes: number,
  durationMinutes: number,
  options?: OccupiedSegmentOptions,
): OccupiedSegment[] {
  const role = options?.colorGroupRole
  if (isColorGroupColorRow(role) || isColorGroupWashRow(role)) {
    return [{ startMinutes, durationMinutes }]
  }
  if (isLegacyColorSplitAppointment(serviceId, durationMinutes, role)) {
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

function rangeBetween(start: string, end: string, locale: 'es' | 'en', separator: 'dash' | 'word'): string {
  if (separator === 'word') {
    const connector = locale === 'en' ? ' to ' : ' a '
    return `${start}${connector}${end}`
  }
  return `${start} – ${end}`
}

export function formatAppointmentTimeRange(
  serviceId: string,
  startTime: string,
  durationMinutes: number,
  locale: 'es' | 'en' = 'es',
  options?: { rangeSeparator?: 'dash' | 'word'; colorGroupRole?: string | null },
): string {
  const separator = options?.rangeSeparator ?? 'dash'
  const role = options?.colorGroupRole
  const showSplitRange =
    usesColorSplitBooking(serviceId) &&
    (isColorGroupColorRow(role) || isLegacyColorSplitAppointment(serviceId, durationMinutes, role))

  if (!showSplitRange) {
    const start = timeToMinutes(startTime)
    const displayDuration = getCustomerFacingDurationMinutes(serviceId, durationMinutes, role)
    return rangeBetween(startTime, minutesToTime(start + displayDuration), locale, separator)
  }

  const start = timeToMinutes(startTime)
  const seg1End = start + COLOR_SPLIT_SEGMENT_MINUTES
  const seg2Start = getWashPhaseStartMinutes(start)
  const seg2End = start + COLOR_SPLIT_TOTAL_SPAN_MINUTES
  const connector = locale === 'en' ? 'and' : 'y'
  const seg1 = rangeBetween(startTime, minutesToTime(seg1End), locale, separator)
  const seg2 = rangeBetween(minutesToTime(seg2Start), minutesToTime(seg2End), locale, separator)
  return `${seg1} ${connector} ${seg2}`
}

export type AppointmentOccupiedSlot = {
  startTime: string
  endTime: string
}

export function appointmentOccupiedSlots(
  serviceId: string,
  startTime: string,
  durationMinutes: number,
  options?: OccupiedSegmentOptions,
): AppointmentOccupiedSlot[] {
  const startMinutes = timeToMinutes(startTime)
  return getOccupiedSegmentsForAppointment(
    serviceId,
    startMinutes,
    durationMinutes,
    options,
  ).map((seg) => ({
    startTime: minutesToTime(seg.startMinutes),
    endTime: minutesToTime(seg.startMinutes + seg.durationMinutes),
  }))
}
