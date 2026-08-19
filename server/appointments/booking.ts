import { sql, type AppointmentRow } from "@server/db.js"
import { getService } from "@server/catalog/services.js"
import { parseBookingPattern } from "@/lib/booking/servicePattern"
import { getStaffDayWindows, type StaffDayWindow } from "@server/staff/availability.js"
import { segmentFitsInWorkWindows, type WorkTimeWindow } from "@/lib/core/scheduleHours"
import { isRangeBlockedByStaff } from "@server/staff/blocks.js"
import {
  getStaff,
  listStaffForService,
  listStaffForServices,
  staffCanPerformService,
  type PublicStaff,
} from "@server/staff/index.js"
import {
  buildFlexibleServiceStartTimes,
  getChainedBookingSegments,
  countLeadingParallelInstances,
  type BookingServiceLine,
} from "@/lib/booking/combo"
import { getFirstServiceBookingSpan, getOccupiedSegmentsForChainService } from "@/lib/booking/colorCombo"
import { schedule } from "@server/config.js"
import { isBookingDateAllowed } from "@server/schedule/salonDay.js"
import {
  getOccupiedSegmentsForAppointment,
  getOccupiedSegmentsForBooking,
  occupiedSegmentsOverlap,
  type OccupiedSegment,
} from "@/lib/booking/occupancy"
import type { DbClient } from "@server/appointments/lock.js"
import { filterPastSlotsForToday, minutesToTime, timeToMinutes } from "@server/appointments/time.js"

async function resolveVisitExclusionSets(
  query: DbClient,
  appointmentId?: string,
): Promise<{
  appointmentIds: Set<string>
  colorGroupIds: Set<string>
  bookingGroupIds: Set<string>
}> {
  const appointmentIds = new Set<string>()
  const colorGroupIds = new Set<string>()
  const bookingGroupIds = new Set<string>()
  if (!appointmentId) return { appointmentIds, colorGroupIds, bookingGroupIds }

  appointmentIds.add(appointmentId)
  const seed = await query<Pick<AppointmentRow, 'color_group_id' | 'booking_group_id'>[]>`
    SELECT color_group_id, booking_group_id FROM appointments WHERE id = ${appointmentId}
  `
  if (seed[0]?.color_group_id) colorGroupIds.add(seed[0].color_group_id)
  if (seed[0]?.booking_group_id) bookingGroupIds.add(seed[0].booking_group_id)

  for (let hop = 0; hop < 4; hop++) {
    const related: Pick<AppointmentRow, 'id' | 'color_group_id' | 'booking_group_id'>[] = []
    const idList = [...appointmentIds]
    const colorList = [...colorGroupIds]
    const bookingList = [...bookingGroupIds]

    const byId = await query<Pick<AppointmentRow, 'id' | 'color_group_id' | 'booking_group_id'>[]>`
      SELECT id, color_group_id, booking_group_id FROM appointments
      WHERE id = ANY(${idList}) AND status NOT IN ('cancelled', 'no_show')
    `
    related.push(...byId)

    if (colorList.length > 0) {
      const byColor = await query<Pick<AppointmentRow, 'id' | 'color_group_id' | 'booking_group_id'>[]>`
        SELECT id, color_group_id, booking_group_id FROM appointments
        WHERE color_group_id = ANY(${colorList}) AND status NOT IN ('cancelled', 'no_show')
      `
      related.push(...byColor)
    }
    if (bookingList.length > 0) {
      const byBooking = await query<Pick<AppointmentRow, 'id' | 'color_group_id' | 'booking_group_id'>[]>`
        SELECT id, color_group_id, booking_group_id FROM appointments
        WHERE booking_group_id = ANY(${bookingList}) AND status NOT IN ('cancelled', 'no_show')
      `
      related.push(...byBooking)
    }

    let grew = false
    for (const row of related) {
      if (!appointmentIds.has(row.id)) {
        appointmentIds.add(row.id)
        grew = true
      }
      if (row.color_group_id && !colorGroupIds.has(row.color_group_id)) {
        colorGroupIds.add(row.color_group_id)
        grew = true
      }
      if (row.booking_group_id && !bookingGroupIds.has(row.booking_group_id)) {
        bookingGroupIds.add(row.booking_group_id)
        grew = true
      }
    }
    if (!grew) break
  }

  return { appointmentIds, colorGroupIds, bookingGroupIds }
}

type OccupiedAppointmentRow = AppointmentRow & {
  booking_pattern: unknown | null
}

async function getOccupiedAppointmentsForStaffOnDate(
  query: DbClient,
  date: string,
  staffId: string,
  excludeAppointmentId?: string,
): Promise<OccupiedAppointmentRow[]> {
  const rows = await query<OccupiedAppointmentRow[]>`
    SELECT a.*, s.booking_pattern
    FROM appointments a
    LEFT JOIN services s ON s.id = a.service_id
    WHERE a.appointment_date = ${date} AND a.staff_id = ${staffId}
      AND a.status NOT IN ('cancelled', 'no_show')
    ORDER BY a.start_time ASC
  `

  // Excluye la cita editada y toda su visita (booking_group + color_group enlazados).
  const exclusion = await resolveVisitExclusionSets(query, excludeAppointmentId)
  return rows.filter((row) => {
    if (exclusion.appointmentIds.has(row.id)) return false
    if (row.color_group_id && exclusion.colorGroupIds.has(row.color_group_id)) return false
    if (row.booking_group_id && exclusion.bookingGroupIds.has(row.booking_group_id)) return false
    return true
  })
}

function staffDayWindowsAsWorkWindows(windows: StaffDayWindow[]): WorkTimeWindow[] {
  return windows.map((window) => ({
    startTime: window.startTime,
    endTime: window.endTime,
  }))
}

async function segmentsFitInStaffWorkWindows(
  staffId: string,
  date: string,
  segments: OccupiedSegment[],
): Promise<boolean> {
  const windows = staffDayWindowsAsWorkWindows(await getStaffDayWindows(staffId, date))
  if (windows.length === 0) return false
  return segments.every((segment) =>
    segmentFitsInWorkWindows(segment.startMinutes, segment.durationMinutes, windows),
  )
}

async function isSegmentBlocked(
  staffId: string,
  date: string,
  segment: OccupiedSegment,
): Promise<boolean> {
  const endMinutes = segment.startMinutes + segment.durationMinutes
  return isRangeBlockedByStaff(staffId, date, segment.startMinutes, endMinutes)
}

export async function isBookingUnavailable(
  query: DbClient,
  staffId: string,
  date: string,
  segments: OccupiedSegment[],
  excludeAppointmentId?: string,
  allowOverHours = false,
  /** Agenda admin: permite solapar citas del mismo profesional (bloqueos/horario siguen). */
  allowAppointmentOverlap = false,
): Promise<boolean> {
  if (!allowOverHours && !(await segmentsFitInStaffWorkWindows(staffId, date, segments))) {
    return true
  }

  for (const segment of segments) {
    if (await isSegmentBlocked(staffId, date, segment)) {
      return true
    }
  }

  if (allowAppointmentOverlap) {
    return false
  }

  const occupied = await getOccupiedAppointmentsForStaffOnDate(
    query,
    date,
    staffId,
    excludeAppointmentId,
  )
  for (const apt of occupied) {
    const aptSegments = getOccupiedSegmentsForAppointment(
      apt.service_id,
      timeToMinutes(apt.start_time),
      apt.duration_minutes,
      {
        colorGroupRole: apt.color_group_role,
        bookingPattern: parseBookingPattern(apt.booking_pattern),
      },
    )
    if (occupiedSegmentsOverlap(segments, aptSegments)) {
      return true
    }
  }
  return false
}

export async function assertBookingAvailable(
  query: DbClient,
  staffId: string,
  date: string,
  segments: OccupiedSegment[],
  excludeAppointmentId?: string,
  allowOverHours = false,
  allowAppointmentOverlap = false,
): Promise<void> {
  if (
    await isBookingUnavailable(
      query,
      staffId,
      date,
      segments,
      excludeAppointmentId,
      allowOverHours,
      allowAppointmentOverlap,
    )
  ) {
    throw new Error('HORARIO_NO_DISPONIBLE')
  }
}

export async function isStaffFreeForServiceAt(
  date: string,
  staffId: string,
  service: BookingServiceLine,
  startTime: string,
  options: SlotOptions & {
    chainServices?: ResolvedBookingService[]
    chainServiceIndex?: number
  } = {},
): Promise<boolean> {
  if (!(await staffCanPerformService(staffId, service.id))) return false
  const startMinutes = timeToMinutes(startTime)
  const segments =
    options.chainServices != null && options.chainServiceIndex != null
      ? getOccupiedSegmentsForChainService(
          options.chainServices,
          options.chainServiceIndex,
          startMinutes,
        )
      : getOccupiedSegmentsForBooking(service.id, startMinutes, service.durationMinutes, {
          bookingPattern: service.bookingPattern,
        })
  return !(await isBookingUnavailable(
    sql,
    staffId,
    date,
    segments,
    options.excludeAppointmentId,
    options.allowOverHours,
    options.allowAppointmentOverlap,
  ))
}

export type SlotOptions = {
  excludeAppointmentId?: string
  /** Panel del profesional: sin límite de días de antelación pública. */
  forStaffPortal?: boolean
  /** Duraciones personalizadas por tratamiento (minutos). */
  serviceDurations?: (number | null)[]
  /** Salta la comprobación de franja horaria (staff/admin confirman fuera de horario). */
  allowOverHours?: boolean
  /** Agenda admin: no excluir horas por solape con otras citas. */
  allowAppointmentOverlap?: boolean
  /** Un profesional por tratamiento en visitas multi (cadena). */
  staffAssignments?: string[]
}

function resolveStaffChainServiceIndices(
  staffId: string,
  serviceCount: number,
  staffAssignments?: readonly string[],
): number[] {
  if (staffAssignments?.length === serviceCount) {
    const indices = staffAssignments
      .map((id, index) => (id === staffId ? index : -1))
      .filter((index) => index >= 0)
    if (indices.length > 0) return indices
  }
  return [0]
}

function isSameStaffForAllChainServices(
  staffId: string,
  serviceCount: number,
  staffAssignments?: readonly string[],
): boolean {
  return (
    staffAssignments?.length === serviceCount &&
    staffAssignments.every((id) => id === staffId)
  )
}

async function staffCanPerformChainServicesForSlot(
  staffId: string,
  services: readonly { id: string }[],
  staffAssignments?: readonly string[],
): Promise<boolean> {
  const sameStaffAll = isSameStaffForAllChainServices(
    staffId,
    services.length,
    staffAssignments,
  )
  if (sameStaffAll) {
    for (const service of services) {
      if (!(await staffCanPerformService(staffId, service.id))) return false
    }
    return true
  }
  for (const index of resolveStaffChainServiceIndices(
    staffId,
    services.length,
    staffAssignments,
  )) {
    if (!(await staffCanPerformService(staffId, services[index]!.id))) return false
  }
  return true
}

function getOccupiedSegmentsForStaffChainSlot(
  services: readonly BookingServiceLine[],
  visitStartMinutes: number,
  staffId: string,
  staffAssignments?: readonly string[],
): OccupiedSegment[] {
  const sameStaffAll = isSameStaffForAllChainServices(
    staffId,
    services.length,
    staffAssignments,
  )
  if (sameStaffAll) {
    return getChainedBookingSegments(services, visitStartMinutes, [], staffAssignments)
  }

  const startTimes = buildFlexibleServiceStartTimes(
    services,
    minutesToTime(visitStartMinutes),
    [],
    staffAssignments,
  ).map(timeToMinutes)

  const segments: OccupiedSegment[] = []
  for (const index of resolveStaffChainServiceIndices(
    staffId,
    services.length,
    staffAssignments,
  )) {
    segments.push(
      ...getOccupiedSegmentsForChainService(
        services,
        index,
        startTimes[index]!,
        staffAssignments,
      ),
    )
  }
  return segments
}

export type ResolvedBookingService = BookingServiceLine & {
  nameEs: string
  nameEn: string
  categoryId: string | null
  bookingPattern: import('@/lib/booking/servicePattern').ServiceBookingPattern | null
}

export async function resolveBookingServices(
  serviceIds: string[],
  onlineOnly: boolean,
): Promise<ResolvedBookingService[]> {
  const lines: ResolvedBookingService[] = []
  for (const serviceId of serviceIds) {
    const service = await getService(serviceId, { onlineOnly })
    if (!service) throw new Error('SERVICIO_INVALIDO')
    lines.push({
      id: service.id,
      durationMinutes: service.durationMinutes,
      categoryId: service.categoryId,
      nameEs: service.nameEs,
      nameEn: service.nameEn ?? '',
      bookingPattern: service.bookingPattern,
    })
  }
  return lines
}

export function normalizeServiceIds(input: { serviceId?: string; serviceIds?: string[] }): string[] {
  if (input.serviceIds?.length) return input.serviceIds
  if (input.serviceId) return [input.serviceId]
  return []
}

export async function getAvailableSlotsForServices(
  date: string,
  serviceIds: string[],
  staffId: string,
  options: SlotOptions = {},
): Promise<string[]> {
  if (serviceIds.length === 0) return []
  if (serviceIds.length === 1) {
    return getAvailableSlots(date, serviceIds[0], staffId, options)
  }

  const dateAllowed = await isBookingDateAllowed(date, { forStaffPortal: options.forStaffPortal })
  if (!dateAllowed) return []

  const rawServices = await resolveBookingServices(serviceIds, !options.forStaffPortal)
  const serviceDurations = options.serviceDurations ?? []
  const services = rawServices.map((s, i) => ({
    ...s,
    durationMinutes:
      serviceDurations[i] != null && serviceDurations[i] > 0
        ? serviceDurations[i]
        : s.durationMinutes,
  }))
  const staff = await getStaff(staffId)
  if (!staff || !staff.active) return []

  if (!(await staffCanPerformChainServicesForSlot(staffId, services, options.staffAssignments))) {
    return []
  }

  const windows = await getStaffDayWindows(staffId, date)
  if (windows.length === 0) return []

  const slots = new Set<string>()

  for (const window of windows) {
    for (
      let start = window.startMinutes;
      start < window.endMinutes;
      start += schedule.slotMinutes
    ) {
      const segments = getOccupiedSegmentsForStaffChainSlot(
        services,
        start,
        staffId,
        options.staffAssignments,
      )
      if (
        !(await isBookingUnavailable(
          sql,
          staffId,
          date,
          segments,
          options.excludeAppointmentId,
          false,
          options.allowAppointmentOverlap,
        ))
      ) {
        slots.add(minutesToTime(start))
      }
    }
  }

  return filterPastSlotsForToday(
    date,
    [...slots].sort((a, b) => timeToMinutes(a) - timeToMinutes(b)),
    { forStaffPortal: options.forStaffPortal },
  )
}

/**
 * Slots en el tramo final del día laboral que solo fallan porque la cadena de
 * tratamientos se extiende más allá del cierre, sin ningún conflicto real.
 * Solo para staff/admin portal (forStaffPortal requerido).
 */
export async function getOverHoursSlotsForServices(
  date: string,
  serviceIds: string[],
  staffId: string,
  options: SlotOptions = {},
): Promise<string[]> {
  if (!options.forStaffPortal || serviceIds.length === 0) return []

  const dateAllowed = await isBookingDateAllowed(date, { forStaffPortal: true })
  if (!dateAllowed) return []

  const rawServices = await resolveBookingServices(serviceIds, false)
  const serviceDurations = options.serviceDurations ?? []
  const services = rawServices.map((s, i) => ({
    ...s,
    durationMinutes:
      serviceDurations[i] != null && (serviceDurations[i] as number) > 0
        ? (serviceDurations[i] as number)
        : s.durationMinutes,
  }))

  const staff = await getStaff(staffId)
  if (!staff || !staff.active) return []
  if (!(await staffCanPerformChainServicesForSlot(staffId, services, options.staffAssignments))) {
    return []
  }

  const windows = await getStaffDayWindows(staffId, date)
  if (windows.length === 0) return []

  const workWindows = staffDayWindowsAsWorkWindows(windows)
  const slots = new Set<string>()

  for (const window of windows) {
    for (
      let start = window.startMinutes;
      start < window.endMinutes;
      start += schedule.slotMinutes
    ) {
      const segments = getOccupiedSegmentsForStaffChainSlot(
        services,
        start,
        staffId,
        options.staffAssignments,
      )
      const fitsWindow = segments.every((seg) =>
        segmentFitsInWorkWindows(seg.startMinutes, seg.durationMinutes, workWindows),
      )
      if (!fitsWindow) {
        // Solo falla por horario: comprobar si hay conflictos reales
        const hasConflict = await isBookingUnavailable(
          sql,
          staffId,
          date,
          segments,
          options.excludeAppointmentId,
          true,
          options.allowAppointmentOverlap,
        )
        if (!hasConflict) slots.add(minutesToTime(start))
      }
    }
  }

  return filterPastSlotsForToday(
    date,
    [...slots].sort((a, b) => timeToMinutes(a) - timeToMinutes(b)),
    { forStaffPortal: true },
  )
}

export async function getAvailableSlots(
  date: string,
  serviceId: string,
  staffId: string,
  options: SlotOptions = {},
): Promise<string[]> {
  const dateAllowed = await isBookingDateAllowed(date, { forStaffPortal: options.forStaffPortal })
  if (!dateAllowed) return []

  const service = await getService(serviceId, { onlineOnly: !options.forStaffPortal })
  if (!service) return []

  const staff = await getStaff(staffId)
  if (!staff || !staff.active || !(await staffCanPerformService(staffId, serviceId))) {
    return []
  }

  const windows = await getStaffDayWindows(staffId, date)
  if (windows.length === 0) return []

  const customDuration = options.serviceDurations?.[0]
  const durationMinutes =
    customDuration != null && customDuration > 0
      ? customDuration
      : service.durationMinutes

  const slots = new Set<string>()

  for (const window of windows) {
    for (
      let start = window.startMinutes;
      start < window.endMinutes;
      start += schedule.slotMinutes
    ) {
      const segments = getOccupiedSegmentsForBooking(service.id, start, durationMinutes, {
        bookingPattern: service.bookingPattern,
      })
      if (
        !(await isBookingUnavailable(
          sql,
          staffId,
          date,
          segments,
          options.excludeAppointmentId,
          false,
          options.allowAppointmentOverlap,
        ))
      ) {
        slots.add(minutesToTime(start))
      }
    }
  }

  return filterPastSlotsForToday(
    date,
    [...slots].sort((a, b) => timeToMinutes(a) - timeToMinutes(b)),
    { forStaffPortal: options.forStaffPortal },
  )
}

/** Huecos del día con al menos un profesional libre (reserva pública). */
export async function getServiceDaySlots(
  date: string,
  serviceId: string,
  options: SlotOptions = {},
): Promise<string[]> {
  return getServiceDaySlotsForServices(date, [serviceId], options)
}

export async function getServiceDaySlotsForServices(
  date: string,
  serviceIds: string[],
  options: SlotOptions = {},
): Promise<string[]> {
  if (serviceIds.length === 0) return []
  if (serviceIds.length === 1) {
    const staffList = await listStaffForServices(serviceIds)
    const merged = new Set<string>()
    await Promise.all(
      staffList.map(async (member) => {
        const memberSlots = await getAvailableSlotsForServices(
          date,
          serviceIds,
          member.id,
          options,
        )
        for (const slot of memberSlots) merged.add(slot)
      }),
    )
    return [...merged].sort((a, b) => timeToMinutes(a) - timeToMinutes(b))
  }

  const dateAllowed = await isBookingDateAllowed(date, { forStaffPortal: options.forStaffPortal })
  if (!dateAllowed) return []

  const rawServices = await resolveBookingServices(serviceIds, !options.forStaffPortal)
  const serviceDurations = options.serviceDurations ?? []
  const services = rawServices.map((s, i) => ({
    ...s,
    durationMinutes:
      serviceDurations[i] != null && serviceDurations[i] > 0
        ? serviceDurations[i]
        : s.durationMinutes,
  }))
  const firstSpan = getFirstServiceBookingSpan(services)
  const candidateStarts = new Set<string>()
  const staffForFirst = await listStaffForService(serviceIds[0])

  for (const member of staffForFirst) {
    const windows = await getStaffDayWindows(member.id, date)
    for (const window of windows) {
      for (
        let start = window.startMinutes;
        start + firstSpan <= window.endMinutes;
        start += schedule.slotMinutes
      ) {
        candidateStarts.add(minutesToTime(start))
      }
    }
  }

  const slots: string[] = []
  const parallelCount = countLeadingParallelInstances(services)
  for (const start of [...candidateStarts].sort((a, b) => timeToMinutes(a) - timeToMinutes(b))) {
    let freeStaff = 0
    for (const member of staffForFirst) {
      if (await isStaffFreeForServiceAt(date, member.id, services[0], start, {
        ...options,
        chainServices: services,
        chainServiceIndex: 0,
      })) {
        freeStaff += 1
        if (freeStaff >= parallelCount) break
      }
    }
    if (freeStaff >= parallelCount) slots.push(start)
  }

  return filterPastSlotsForToday(date, slots, { forStaffPortal: options.forStaffPortal })
}

export async function getStaffAvailableAtSlot(
  date: string,
  serviceId: string,
  startTime: string,
  options: SlotOptions = {},
): Promise<PublicStaff[]> {
  return getStaffAvailableAtSlotForServices(date, [serviceId], startTime, options)
}

export async function getStaffAvailableAtSlotForServices(
  date: string,
  serviceIds: string[],
  startTime: string,
  options: SlotOptions = {},
): Promise<PublicStaff[]> {
  if (serviceIds.length === 0) return []
  if (serviceIds.length === 1) {
    const staffList = await listStaffForServices(serviceIds)
    const available: PublicStaff[] = []
    for (const member of staffList) {
      const slots = await getAvailableSlotsForServices(date, serviceIds, member.id, options)
      if (slots.includes(startTime)) available.push(member)
    }
    return available
  }

  const rawServices = await resolveBookingServices(serviceIds, !options.forStaffPortal)
  const serviceDurations = options.serviceDurations ?? []
  const services = rawServices.map((s, i) => ({
    ...s,
    durationMinutes:
      serviceDurations[i] != null && serviceDurations[i] > 0
        ? serviceDurations[i]
        : s.durationMinutes,
  }))
  const staffList = await listStaffForService(serviceIds[0])
  const available: PublicStaff[] = []
  for (const member of staffList) {
    if (await isStaffFreeForServiceAt(date, member.id, services[0], startTime, {
      ...options,
      chainServices: services,
      chainServiceIndex: 0,
    })) {
      available.push(member)
    }
  }
  return available
}
