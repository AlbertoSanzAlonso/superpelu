import { sql, type AppointmentRow } from "@server/db.js"
import { getService } from "@server/services.js"
import { getStaffDayWindows, type StaffDayWindow } from "@server/availability.js"
import { segmentFitsInWorkWindows, type WorkTimeWindow } from "@/lib/scheduleHours"
import { isRangeBlockedByStaff } from "@server/staffBlocks.js"
import {
  getStaff,
  listStaffForService,
  listStaffForServices,
  staffCanPerformService,
  type PublicStaff,
} from "@server/staff.js"
import { getChainedBookingSegments, type BookingServiceLine } from "@/lib/bookingCombo"
import { getFirstServiceBookingSpan, getOccupiedSegmentsForChainService } from "@/lib/colorComboBooking"
import { schedule } from "@server/config.js"
import { isSalonOpenDay, isWithinSalonBookingWindow } from "@/lib/dates"
import {
  getOccupiedSegmentsForAppointment,
  getOccupiedSegmentsForBooking,
  occupiedSegmentsOverlap,
  type OccupiedSegment,
} from "@/lib/bookingOccupancy"
import type { DbClient } from "@server/bookingLock.js"
import { filterPastSlotsForToday, isValidDateString, minutesToTime, timeToMinutes } from "@server/appointmentTime.js"

async function getExcludedColorGroupId(
  query: DbClient,
  appointmentId?: string,
): Promise<string | null> {
  if (!appointmentId) return null
  const rows = await query<AppointmentRow[]>`
    SELECT color_group_id FROM appointments WHERE id = ${appointmentId}
  `
  return rows[0]?.color_group_id ?? null
}

async function getExcludedBookingGroupId(
  query: DbClient,
  appointmentId?: string,
): Promise<string | null> {
  if (!appointmentId) return null
  const rows = await query<AppointmentRow[]>`
    SELECT booking_group_id FROM appointments WHERE id = ${appointmentId}
  `
  return rows[0]?.booking_group_id ?? null
}

async function getOccupiedAppointmentsForStaffOnDate(
  query: DbClient,
  date: string,
  staffId: string,
  excludeAppointmentId?: string,
): Promise<AppointmentRow[]> {
  const rows = await query<AppointmentRow[]>`
    SELECT * FROM appointments
    WHERE appointment_date = ${date} AND staff_id = ${staffId}
      AND status NOT IN ('cancelled', 'no_show')
    ORDER BY start_time ASC
  `

  const excludeColorGroupId = await getExcludedColorGroupId(query, excludeAppointmentId)
  const excludeBookingGroupId = await getExcludedBookingGroupId(query, excludeAppointmentId)
  return rows.filter((row) => {
    if (excludeAppointmentId && row.id === excludeAppointmentId) return false
    if (excludeColorGroupId && row.color_group_id === excludeColorGroupId) return false
    if (excludeBookingGroupId && row.booking_group_id === excludeBookingGroupId) return false
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
): Promise<boolean> {
  if (!(await segmentsFitInStaffWorkWindows(staffId, date, segments))) {
    return true
  }

  for (const segment of segments) {
    if (await isSegmentBlocked(staffId, date, segment)) {
      return true
    }
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
      { colorGroupRole: apt.color_group_role },
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
): Promise<void> {
  if (await isBookingUnavailable(query, staffId, date, segments, excludeAppointmentId)) {
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
      : getOccupiedSegmentsForBooking(service.id, startMinutes, service.durationMinutes)
  return !(await isBookingUnavailable(
    sql,
    staffId,
    date,
    segments,
    options.excludeAppointmentId,
  ))
}

export type SlotOptions = {
  excludeAppointmentId?: string
  /** Panel del profesional: sin límite de días de antelación pública. */
  forStaffPortal?: boolean
}

export type ResolvedBookingService = BookingServiceLine & {
  nameEs: string
  nameEn: string
  categoryId: string | null
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

  const dateAllowed = options.forStaffPortal
    ? isValidDateString(date) && isSalonOpenDay(date)
    : isValidDateString(date) && isSalonOpenDay(date) && isWithinSalonBookingWindow(date)

  if (!dateAllowed) return []

  const services = await resolveBookingServices(serviceIds, !options.forStaffPortal)
  const staff = await getStaff(staffId)
  if (!staff || !staff.active) return []

  for (const service of services) {
    if (!(await staffCanPerformService(staffId, service.id))) return []
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
      const segments = getChainedBookingSegments(services, start)
      if (
        !(await isBookingUnavailable(sql, staffId, date, segments, options.excludeAppointmentId))
      ) {
        slots.add(minutesToTime(start))
      }
    }
  }

  return filterPastSlotsForToday(date, [...slots].sort((a, b) => timeToMinutes(a) - timeToMinutes(b)))
}

export async function getAvailableSlots(
  date: string,
  serviceId: string,
  staffId: string,
  options: SlotOptions = {},
): Promise<string[]> {
  const dateAllowed = options.forStaffPortal
    ? isValidDateString(date) && isSalonOpenDay(date)
    : isValidDateString(date) && isSalonOpenDay(date) && isWithinSalonBookingWindow(date)

  if (!dateAllowed) return []

  const service = await getService(serviceId, { onlineOnly: !options.forStaffPortal })
  if (!service) return []

  const staff = await getStaff(staffId)
  if (!staff || !staff.active || !(await staffCanPerformService(staffId, serviceId))) {
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
      const segments = getOccupiedSegmentsForBooking(service.id, start, service.durationMinutes)
      if (
        !(await isBookingUnavailable(sql, staffId, date, segments, options.excludeAppointmentId))
      ) {
        slots.add(minutesToTime(start))
      }
    }
  }

  return filterPastSlotsForToday(date, [...slots].sort((a, b) => timeToMinutes(a) - timeToMinutes(b)))
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

  const dateAllowed = options.forStaffPortal
    ? isValidDateString(date) && isSalonOpenDay(date)
    : isValidDateString(date) && isSalonOpenDay(date) && isWithinSalonBookingWindow(date)
  if (!dateAllowed) return []

  const services = await resolveBookingServices(serviceIds, !options.forStaffPortal)
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
  for (const start of [...candidateStarts].sort((a, b) => timeToMinutes(a) - timeToMinutes(b))) {
    let firstServiceFits = false
    for (const member of staffForFirst) {
      if (await isStaffFreeForServiceAt(date, member.id, services[0], start, {
        ...options,
        chainServices: services,
        chainServiceIndex: 0,
      })) {
        firstServiceFits = true
        break
      }
    }
    if (firstServiceFits) slots.push(start)
  }

  return filterPastSlotsForToday(date, slots)
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

  const services = await resolveBookingServices(serviceIds, !options.forStaffPortal)
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
