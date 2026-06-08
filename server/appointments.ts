import { randomUUID } from 'node:crypto'
import { sql, type AppointmentRow } from '@server/db.js'
import { getService } from '@server/services.js'
import { serviceDisplayName } from '@/i18n/localeHelpers'
import { normalizeLocale, type Locale } from '@/i18n/types'
import { getStaffDayWindows, isStaffWorkingOnDate } from '@server/availability.js'
import { getBlocksForStaffOnDate, isRangeBlockedByStaff } from '@server/staffBlocks.js'
import {
  getStaff,
  listStaffForService,
  listStaffForServices,
  staffCanPerformService,
  type PublicStaff,
} from '@server/staff.js'
import {
  getChainedBookingSegments,
  getChainedBookingSpanMinutes,
  getChainedServiceStartTimes,
  type BookingServiceLine,
} from '@/lib/bookingCombo'
import { schedule } from '@server/config.js'
import {
  customerNameSnapshot,
  getCustomer,
  resolveCustomerFromInput,
  upsertCustomer,
} from '@server/customers.js'
import {
  notifyAppointmentCreated,
  notifyAppointmentCancelled,
  notifyAppointmentRescheduled,
  notifyAppointmentNoShow,
} from '@server/appointmentWhatsApp.js'
import {
  notifyAdminAppointmentCancelled,
  notifyAdminAppointmentCreated,
  notifyAdminAppointmentUpdated,
} from '@server/appointmentEmail.js'
import {
  addDaysToDateString,
  hoursUntilAppointment,
  isSalonOpenDay,
  isWithinSalonBookingWindow,
  todaySalon,
} from '@/lib/dates'
import {
  appointmentOccupiedSlots,
  COLOR_GROUP_ROLE,
  getBookingSpanMinutes,
  getCustomerFacingDurationMinutes,
  getOccupiedSegmentsForAppointment,
  getOccupiedSegmentsForBooking,
  getWashPhaseStartMinutes,
  isColorGroupColorRow,
  isColorGroupWashRow,
  occupiedSegmentsOverlap,
  usesColorSplitBooking,
  COLOR_SPLIT_SEGMENT_MINUTES,
  type OccupiedSegment,
} from '@/lib/bookingOccupancy'
import {
  lockStaffDayForBooking,
  lockStaffDaysForBooking,
  type DbClient,
} from '@server/bookingLock.js'
import {
  insertColorBookingGroup,
  prepareColorBookingGroupIds,
  resolveWashServiceName,
} from '@server/colorBooking.js'

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function isValidDateString(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false
  const [y, m, d] = date.split('-').map(Number)
  return !Number.isNaN(new Date(y, m - 1, d).getTime())
}

function filterPastSlotsForToday(date: string, slots: string[]): string[] {
  if (date !== todaySalon()) return slots
  const now = nowSalonMinutesFromSchedule()
  const minStart = now + schedule.slotMinutes
  return slots.filter((slot) => timeToMinutes(slot) >= minStart)
}

function nowSalonMinutesFromSchedule(): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: schedule.timezone,
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(new Date())

  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0)
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0)
  return hour * 60 + minute
}

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

  const excludeGroupId = await getExcludedColorGroupId(query, excludeAppointmentId)
  return rows.filter((row) => {
    if (excludeAppointmentId && row.id === excludeAppointmentId) return false
    if (excludeGroupId && row.color_group_id === excludeGroupId) return false
    return true
  })
}

async function isSegmentBlocked(
  staffId: string,
  date: string,
  segment: OccupiedSegment,
): Promise<boolean> {
  const endMinutes = segment.startMinutes + segment.durationMinutes
  return isRangeBlockedByStaff(staffId, date, segment.startMinutes, endMinutes)
}

async function isBookingUnavailable(
  query: DbClient,
  staffId: string,
  date: string,
  segments: OccupiedSegment[],
  excludeAppointmentId?: string,
): Promise<boolean> {
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

async function assertBookingAvailable(
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

async function isStaffFreeForServiceAt(
  date: string,
  staffId: string,
  service: BookingServiceLine,
  startTime: string,
  options: SlotOptions = {},
): Promise<boolean> {
  if (!(await staffCanPerformService(staffId, service.id))) return false
  const segments = getOccupiedSegmentsForBooking(
    service.id,
    timeToMinutes(startTime),
    service.durationMinutes,
  )
  return !(await isBookingUnavailable(
    sql,
    staffId,
    date,
    segments,
    options.excludeAppointmentId,
  ))
}

export type BookingChainSegmentPlan = {
  serviceIndex: number
  serviceId: string
  startTime: string
  staffId: string
  staffName: string
}

export type ChainContinuationResult =
  | { complete: true; segments: BookingChainSegmentPlan[] }
  | {
      complete: false
      needsTimeChange: boolean
      segments: BookingChainSegmentPlan[]
      next?: {
        serviceIndex: number
        startTime: string
        staff: PublicStaff[]
      }
    }

async function existsFlexibleChainPlan(
  date: string,
  services: ResolvedBookingService[],
  visitStartTime: string,
  options: SlotOptions,
  fixedPrefix: readonly string[],
): Promise<boolean> {
  const serviceStartTimes = getChainedServiceStartTimes(services, visitStartTime)

  async function dfs(index: number): Promise<boolean> {
    if (index >= services.length) return true
    const service = services[index]
    const svcStart = serviceStartTimes[index]
    const fixedStaffId = fixedPrefix[index]

    if (fixedStaffId) {
      if (!(await isStaffFreeForServiceAt(date, fixedStaffId, service, svcStart, options))) {
        return false
      }
      return dfs(index + 1)
    }

    const staffList = await listStaffForService(service.id)
    for (const member of staffList) {
      if (!(await isStaffFreeForServiceAt(date, member.id, service, svcStart, options))) {
        continue
      }
      if (await dfs(index + 1)) return true
    }
    return false
  }

  return dfs(0)
}

function buildPartialChainSegments(
  services: ResolvedBookingService[],
  visitStartTime: string,
  assignments: readonly string[],
): BookingChainSegmentPlan[] {
  const serviceStartTimes = getChainedServiceStartTimes(services, visitStartTime)
  return assignments.map((staffId, serviceIndex) => ({
    serviceIndex,
    serviceId: services[serviceIndex].id,
    startTime: serviceStartTimes[serviceIndex],
    staffId,
    staffName: '',
  }))
}

export async function resolveChainContinuation(
  date: string,
  serviceIds: string[],
  visitStartTime: string,
  staffAssignments: string[],
  options: SlotOptions = {},
): Promise<ChainContinuationResult> {
  const services = await resolveBookingServices(serviceIds, !options.forStaffPortal)
  if (services.length < 2) {
    throw new Error('SERVICIO_INVALIDO')
  }

  const serviceStartTimes = getChainedServiceStartTimes(services, visitStartTime)
  const segments: BookingChainSegmentPlan[] = []

  for (let i = 0; i < staffAssignments.length; i++) {
    const staff = await getStaff(staffAssignments[i])
    if (!staff?.active) {
      return {
        complete: false,
        needsTimeChange: true,
        segments: buildPartialChainSegments(services, visitStartTime, staffAssignments),
      }
    }
    const service = services[i]
    const svcStart = serviceStartTimes[i]
    if (!(await isStaffFreeForServiceAt(date, staff.id, service, svcStart, options))) {
      return {
        complete: false,
        needsTimeChange: true,
        segments: buildPartialChainSegments(services, visitStartTime, staffAssignments),
      }
    }
    segments.push({
      serviceIndex: i,
      serviceId: service.id,
      startTime: svcStart,
      staffId: staff.id,
      staffName: staff.name,
    })
  }

  if (staffAssignments.length >= services.length) {
    return { complete: true, segments }
  }

  const nextIndex = staffAssignments.length
  const nextService = services[nextIndex]
  const nextStart = serviceStartTimes[nextIndex]
  const viable: PublicStaff[] = []
  const staffList = await listStaffForService(nextService.id)

  for (const member of staffList) {
    if (!(await isStaffFreeForServiceAt(date, member.id, nextService, nextStart, options))) {
      continue
    }
    const prefix = [...staffAssignments, member.id]
    if (await existsFlexibleChainPlan(date, services, visitStartTime, options, prefix)) {
      viable.push(member)
    }
  }

  if (viable.length === 0) {
    return { complete: false, needsTimeChange: true, segments }
  }

  return {
    complete: false,
    needsTimeChange: false,
    segments,
    next: {
      serviceIndex: nextIndex,
      startTime: nextStart,
      staff: viable,
    },
  }
}

export type SlotOptions = {
  excludeAppointmentId?: string
  /** Panel del profesional: sin límite de días de antelación pública. */
  forStaffPortal?: boolean
}

type ResolvedBookingService = BookingServiceLine & {
  nameEs: string
  nameEn: string
}

async function resolveBookingServices(
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
      nameEs: service.nameEs,
      nameEn: service.nameEn ?? '',
    })
  }
  return lines
}

function normalizeServiceIds(input: { serviceId?: string; serviceIds?: string[] }): string[] {
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

  const spanMinutes = getChainedBookingSpanMinutes(services)
  const slots: string[] = []

  for (const window of windows) {
    for (
      let start = window.startMinutes;
      start + spanMinutes <= window.endMinutes;
      start += schedule.slotMinutes
    ) {
      const segments = getChainedBookingSegments(services, start)
      if (
        !(await isBookingUnavailable(sql, staffId, date, segments, options.excludeAppointmentId))
      ) {
        slots.push(minutesToTime(start))
      }
    }
  }

  return filterPastSlotsForToday(date, slots)
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

  const slots: string[] = []
  const spanMinutes = getBookingSpanMinutes(service.id, service.durationMinutes)

  for (const window of windows) {
    for (
      let start = window.startMinutes;
      start + spanMinutes <= window.endMinutes;
      start += schedule.slotMinutes
    ) {
      const segments = getOccupiedSegmentsForBooking(service.id, start, service.durationMinutes)
      if (
        !(await isBookingUnavailable(sql, staffId, date, segments, options.excludeAppointmentId))
      ) {
        slots.push(minutesToTime(start))
      }
    }
  }

  return filterPastSlotsForToday(date, slots)
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
  const firstSpan = getBookingSpanMinutes(services[0].id, services[0].durationMinutes)
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
    if (await existsFlexibleChainPlan(date, services, start, options, [])) {
      slots.push(start)
    }
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
    if (await isStaffFreeForServiceAt(date, member.id, services[0], startTime, options)) {
      available.push(member)
    }
  }
  return available
}

export type CreateAppointmentInput = {
  serviceId?: string
  serviceIds?: string[]
  staffId: string
  /** Un profesional por tratamiento (reserva multi); si falta, se repite staffId. */
  staffAssignments?: string[]
  date: string
  startTime: string
  customerName?: string
  customerFirstName?: string
  customerLastName?: string
  customerPhone: string
  customerEmail?: string
  customerNotes?: string
  notes?: string
  forStaffPortal?: boolean
  locale?: Locale
  /** Idioma en ficha del cliente (agenda); si no se envía, se usa el guardado o español. */
  customerLocale?: Locale
}

export async function getAppointmentsByBookingGroup(
  bookingGroupId: string,
): Promise<AppointmentRow[]> {
  return sql<AppointmentRow[]>`
    SELECT * FROM appointments
    WHERE booking_group_id = ${bookingGroupId}
    ORDER BY start_time ASC, id ASC
  `
}

async function createChainedBookingAppointment(
  input: CreateAppointmentInput,
  serviceIds: string[],
  staffAssignments: string[],
): Promise<AppointmentRow> {
  const services = await resolveBookingServices(serviceIds, !input.forStaffPortal)

  const customer = resolveCustomerFromInput({
    firstName: input.customerFirstName,
    lastName: input.customerLastName,
    customerName: input.customerName,
    phone: input.customerPhone,
  })
  const customerLocaleForUpsert = input.forStaffPortal
    ? input.customerLocale !== undefined
      ? normalizeLocale(input.customerLocale)
      : undefined
    : normalizeLocale(input.locale)

  await upsertCustomer({
    firstName: customer.firstName,
    lastName: customer.lastName,
    phone: customer.phone,
    email: input.customerEmail,
    ...(input.customerNotes !== undefined
      ? { notes: input.customerNotes.trim() || null }
      : {}),
    ...(customerLocaleForUpsert !== undefined ? { locale: customerLocaleForUpsert } : {}),
  })
  const nameSnapshot = customerNameSnapshot(customer.firstName, customer.lastName)

  const profile = await getCustomer(customer.phone)
  const createdAt = new Date().toISOString()
  const locale = input.forStaffPortal
    ? normalizeLocale(profile?.locale ?? input.customerLocale)
    : normalizeLocale(input.locale)
  const reminderSentAt =
    hoursUntilAppointment(input.date, input.startTime) <= 24 ? createdAt : null
  const bookingGroupId = randomUUID()
  const serviceStartTimes = getChainedServiceStartTimes(services, input.startTime)

  const primaryId = await sql.begin(async (tx) => {
    await lockStaffDaysForBooking(
      tx,
      staffAssignments.map((staffId) => ({ staffId, date: input.date })),
    )

    for (let i = 0; i < services.length; i++) {
      const service = services[i]
      const staffId = staffAssignments[i]
      const serviceStartTime = serviceStartTimes[i]
      const segments = getOccupiedSegmentsForBooking(
        service.id,
        timeToMinutes(serviceStartTime),
        service.durationMinutes,
      )
      if (await isBookingUnavailable(tx, staffId, input.date, segments)) {
        throw new Error('HORARIO_ENCADENADO_NO_DISPONIBLE')
      }
    }

    let firstId: string | null = null

    for (let i = 0; i < services.length; i++) {
      const service = services[i]
      const staffId = staffAssignments[i]
      const staff = await getStaff(staffId)
      if (!staff?.active) throw new Error('STAFF_INVALIDO')
      const serviceStartTime = serviceStartTimes[i]
      const serviceName = serviceDisplayName(service, locale)

      if (usesColorSplitBooking(service.id)) {
        const colorGroup = await prepareColorBookingGroupIds(service.id)
        if (!colorGroup) throw new Error('SERVICIO_INVALIDO')
        const washServiceName = await resolveWashServiceName(locale)
        await insertColorBookingGroup(
          {
            groupId: colorGroup.groupId,
            colorId: colorGroup.colorId,
            washId: colorGroup.washId,
            staffId: staff.id,
            staffName: staff.name,
            colorServiceId: service.id,
            colorServiceName: serviceName,
            washServiceName,
            date: input.date,
            colorStartTime: serviceStartTime,
            durationMinutes: service.durationMinutes,
            customerName: nameSnapshot,
            customerPhone: customer.phone,
            customerEmail: input.customerEmail?.trim() || null,
            notes: input.notes?.trim() || null,
            createdAt,
            reminderSentAt,
            locale,
            bookingGroupId,
          },
          tx,
        )
        if (!firstId) firstId = colorGroup.colorId
        continue
      }

      const id = randomUUID()
      const storedDuration = getBookingSpanMinutes(service.id, service.durationMinutes)
      await tx`
        INSERT INTO appointments (
          id, staff_id, staff_name, service_id, service_name, duration_minutes,
          appointment_date, start_time,
          customer_name, customer_phone, customer_email, notes,
          status, created_at, reminder_sent_at, locale, booking_group_id
        ) VALUES (
          ${id}, ${staff.id}, ${staff.name}, ${service.id}, ${serviceName}, ${storedDuration},
          ${input.date}, ${serviceStartTime},
          ${nameSnapshot}, ${customer.phone}, ${input.customerEmail?.trim() || null},
          ${input.notes?.trim() || null}, 'confirmed', ${createdAt}, ${reminderSentAt}, ${locale},
          ${bookingGroupId}
        )
      `
      if (!firstId) firstId = id
    }

    if (!firstId) throw new Error('SERVICIO_INVALIDO')
    return firstId
  })

  const row = (await getAppointmentById(primaryId))!
  void notifyAppointmentCreated(row, { forStaffPortal: Boolean(input.forStaffPortal) }).catch(
    (err) => {
      console.error('Superpelu WhatsApp (cita nueva):', err)
    },
  )
  void notifyAdminAppointmentCreated(row)
  return row
}

export async function createAppointment(
  input: CreateAppointmentInput,
): Promise<AppointmentRow> {
  const serviceIds = normalizeServiceIds(input)
  if (serviceIds.length === 0) throw new Error('SERVICIO_INVALIDO')

  if (serviceIds.length > 1) {
    const staffAssignments =
      input.staffAssignments?.length === serviceIds.length
        ? input.staffAssignments
        : serviceIds.map(() => input.staffId)

    for (let i = 0; i < serviceIds.length; i++) {
      const staffId = staffAssignments[i]
      const staff = await getStaff(staffId)
      if (!staff?.active) throw new Error('STAFF_INVALIDO')
      if (!(await staffCanPerformService(staffId, serviceIds[i]))) {
        throw new Error('STAFF_NO_REALIZA_SERVICIO')
      }
    }

    const dateOk = input.forStaffPortal
      ? isValidDateString(input.date) && isSalonOpenDay(input.date)
      : isValidDateString(input.date) &&
        isSalonOpenDay(input.date) &&
        isWithinSalonBookingWindow(input.date)
    if (!dateOk) throw new Error('FECHA_INVALIDA')

    for (const staffId of new Set(staffAssignments)) {
      if (!(await isStaffWorkingOnDate(staffId, input.date))) {
        throw new Error('FECHA_INVALIDA')
      }
    }

    const daySlots = await getServiceDaySlotsForServices(input.date, serviceIds, {
      forStaffPortal: input.forStaffPortal,
    })
    if (!daySlots.includes(input.startTime)) throw new Error('HORARIO_NO_DISPONIBLE')

    const chain = await resolveChainContinuation(
      input.date,
      serviceIds,
      input.startTime,
      staffAssignments,
      { forStaffPortal: input.forStaffPortal },
    )
    if (!chain.complete) throw new Error('HORARIO_ENCADENADO_NO_DISPONIBLE')

    return createChainedBookingAppointment(input, serviceIds, staffAssignments)
  }

  const staff = await getStaff(input.staffId)
  if (!staff || !staff.active) throw new Error('STAFF_INVALIDO')

  for (const serviceId of serviceIds) {
    if (!(await staffCanPerformService(input.staffId, serviceId))) {
      throw new Error('STAFF_NO_REALIZA_SERVICIO')
    }
  }

  const dateOk = input.forStaffPortal
    ? isValidDateString(input.date) &&
      isSalonOpenDay(input.date) &&
      (await isStaffWorkingOnDate(input.staffId, input.date))
    : isValidDateString(input.date) &&
      isSalonOpenDay(input.date) &&
      isWithinSalonBookingWindow(input.date) &&
      (await isStaffWorkingOnDate(input.staffId, input.date))

  if (!dateOk) throw new Error('FECHA_INVALIDA')

  const slots = await getAvailableSlotsForServices(
    input.date,
    serviceIds,
    input.staffId,
    { forStaffPortal: input.forStaffPortal },
  )
  if (!slots.includes(input.startTime)) throw new Error('HORARIO_NO_DISPONIBLE')

  const service = await getService(serviceIds[0], { onlineOnly: !input.forStaffPortal })
  if (!service) throw new Error('SERVICIO_INVALIDO')

  const customer = resolveCustomerFromInput({
    firstName: input.customerFirstName,
    lastName: input.customerLastName,
    customerName: input.customerName,
    phone: input.customerPhone,
  })
  const customerLocaleForUpsert = input.forStaffPortal
    ? input.customerLocale !== undefined
      ? normalizeLocale(input.customerLocale)
      : undefined
    : normalizeLocale(input.locale)

  await upsertCustomer({
    firstName: customer.firstName,
    lastName: customer.lastName,
    phone: customer.phone,
    email: input.customerEmail,
    ...(input.customerNotes !== undefined
      ? { notes: input.customerNotes.trim() || null }
      : {}),
    ...(customerLocaleForUpsert !== undefined ? { locale: customerLocaleForUpsert } : {}),
  })
  const nameSnapshot = customerNameSnapshot(customer.firstName, customer.lastName)

  const profile = await getCustomer(customer.phone)
  const createdAt = new Date().toISOString()
  const locale = input.forStaffPortal
    ? normalizeLocale(profile?.locale ?? input.customerLocale)
    : normalizeLocale(input.locale)
  const serviceName = serviceDisplayName(service, locale)

  // Si la cita es en menos de 24h, no hay recordatorio: se marca como ya gestionado.
  const reminderSentAt =
    hoursUntilAppointment(input.date, input.startTime) <= 24 ? createdAt : null

  const colorGroup = await prepareColorBookingGroupIds(service.id)
  const bookingSegments = getOccupiedSegmentsForBooking(
    service.id,
    timeToMinutes(input.startTime),
    service.durationMinutes,
  )

  const primaryId = await sql.begin(async (tx) => {
    await lockStaffDayForBooking(tx, staff.id, input.date)
    await assertBookingAvailable(tx, staff.id, input.date, bookingSegments)

    if (colorGroup) {
      const washServiceName = await resolveWashServiceName(locale)
      await insertColorBookingGroup(
        {
          groupId: colorGroup.groupId,
          colorId: colorGroup.colorId,
          washId: colorGroup.washId,
          staffId: staff.id,
          staffName: staff.name,
          colorServiceId: service.id,
          colorServiceName: serviceName,
          washServiceName,
          date: input.date,
          colorStartTime: input.startTime,
          durationMinutes: service.durationMinutes,
          customerName: nameSnapshot,
          customerPhone: customer.phone,
          customerEmail: input.customerEmail?.trim() || null,
          notes: input.notes?.trim() || null,
          createdAt,
          reminderSentAt,
          locale,
        },
        tx,
      )
      return colorGroup.colorId
    }

    const id = randomUUID()
    const storedDuration = getBookingSpanMinutes(service.id, service.durationMinutes)
    await tx`
      INSERT INTO appointments (
        id, staff_id, staff_name, service_id, service_name, duration_minutes,
        appointment_date, start_time,
        customer_name, customer_phone, customer_email, notes,
        status, created_at, reminder_sent_at, locale
      ) VALUES (
        ${id}, ${staff.id}, ${staff.name}, ${service.id}, ${serviceName}, ${storedDuration},
        ${input.date}, ${input.startTime},
        ${nameSnapshot}, ${customer.phone}, ${input.customerEmail?.trim() || null},
        ${input.notes?.trim() || null}, 'confirmed', ${createdAt}, ${reminderSentAt}, ${locale}
      )
    `
    return id
  })

  const row = (await getAppointmentById(primaryId))!
  void notifyAppointmentCreated(row, { forStaffPortal: Boolean(input.forStaffPortal) }).catch(
    (err) => {
      console.error('Superpelu WhatsApp (cita nueva):', err)
    },
  )
  void notifyAdminAppointmentCreated(row)
  return row
}

export type UpdateAppointmentInput = {
  serviceId?: string
  staffId?: string
  date?: string
  startTime?: string
  customerName?: string
  customerFirstName?: string
  customerLastName?: string
  customerPhone?: string
  customerEmail?: string | null
  customerNotes?: string | null
  notes?: string | null
  customerLocale?: Locale
  /** Si es `false`, no se envía WhatsApp de reprogramación (p. ej. elección del admin). */
  notifyCustomerWhatsApp?: boolean
}

export async function getAppointmentById(
  id: string,
): Promise<AppointmentRow | undefined> {
  const rows = await sql<AppointmentRow[]>`
    SELECT * FROM appointments WHERE id = ${id}
  `
  return rows[0]
}

export async function listAppointmentsForStaff(
  staffId: string,
  from: string,
  to: string,
): Promise<AppointmentRow[]> {
  return sql<AppointmentRow[]>`
    SELECT * FROM appointments
    WHERE staff_id = ${staffId}
      AND appointment_date >= ${from}
      AND appointment_date <= ${to}
      AND status != 'cancelled'
    ORDER BY appointment_date ASC, start_time ASC
  `
}

export async function updateAppointmentForStaff(
  appointmentId: string,
  staffId: string,
  input: UpdateAppointmentInput,
): Promise<AppointmentRow> {
  const existing = await getAppointmentById(appointmentId)
  if (!existing || existing.status === 'cancelled' || existing.status === 'no_show') {
    throw new Error('CITA_NO_ENCONTRADA')
  }
  if (existing.staff_id !== staffId && input.staffId === undefined) {
    throw new Error('CITA_NO_ENCONTRADA')
  }

  const targetStaffId = input.staffId ?? existing.staff_id ?? staffId
  if (!targetStaffId) throw new Error('CITA_NO_ENCONTRADA')

  const serviceId = input.serviceId ?? existing.service_id
  const date = input.date ?? existing.appointment_date
  const startTime = input.startTime ?? existing.start_time
  const service = await getService(serviceId, { onlineOnly: false })
  if (!service) throw new Error('SERVICIO_INVALIDO')

  if (!(await staffCanPerformService(targetStaffId, serviceId))) {
    throw new Error('STAFF_NO_REALIZA_SERVICIO')
  }

  if (
    !isValidDateString(date) ||
    !isSalonOpenDay(date) ||
    !(await isStaffWorkingOnDate(targetStaffId, date))
  ) {
    throw new Error('FECHA_INVALIDA')
  }

  const startMinutes = timeToMinutes(startTime)
  let segments: OccupiedSegment[]
  if (isColorGroupWashRow(existing.color_group_role)) {
    segments = [{ startMinutes, durationMinutes: COLOR_SPLIT_SEGMENT_MINUTES }]
  } else if (isColorGroupColorRow(existing.color_group_role)) {
    segments = [{ startMinutes, durationMinutes: COLOR_SPLIT_SEGMENT_MINUTES }]
  } else {
    segments = getOccupiedSegmentsForBooking(service.id, startMinutes, service.durationMinutes)
  }
  const scheduleChanging =
    date !== existing.appointment_date ||
    startTime !== existing.start_time ||
    targetStaffId !== existing.staff_id ||
    serviceId !== existing.service_id

  const storedDuration = isColorGroupWashRow(existing.color_group_role)
    ? COLOR_SPLIT_SEGMENT_MINUTES
    : isColorGroupColorRow(existing.color_group_role)
      ? COLOR_SPLIT_SEGMENT_MINUTES
      : getBookingSpanMinutes(service.id, service.durationMinutes)

  const hasCustomerPatch =
    input.customerName !== undefined ||
    input.customerFirstName !== undefined ||
    input.customerLastName !== undefined ||
    input.customerPhone !== undefined ||
    input.customerEmail !== undefined ||
    input.customerNotes !== undefined

  let nameSnapshot = existing.customer_name
  let customerPhone = existing.customer_phone

  if (hasCustomerPatch) {
    const split = resolveCustomerFromInput({
      firstName: input.customerFirstName,
      lastName: input.customerLastName,
      customerName: input.customerName ?? existing.customer_name,
      phone: input.customerPhone ?? existing.customer_phone,
    })
    const profile = await getCustomer(split.phone)
    await upsertCustomer({
      firstName: split.firstName,
      lastName: split.lastName,
      phone: split.phone,
      email:
        input.customerEmail !== undefined ? input.customerEmail : existing.customer_email,
      notes:
        input.customerNotes !== undefined
          ? input.customerNotes
          : (profile?.notes ?? null),
      ...(input.customerLocale !== undefined
        ? { locale: normalizeLocale(input.customerLocale) }
        : {}),
    })
    nameSnapshot = customerNameSnapshot(split.firstName, split.lastName)
    customerPhone = split.phone
  }

  // Reprogramación: si la nueva fecha/hora queda a más de 24h, reactivar el
  // recordatorio (NULL); si queda a 24h o menos, marcar como gestionado.
  const dateOrTimeChanged =
    date !== existing.appointment_date || startTime !== existing.start_time
  const staffChanged = targetStaffId !== existing.staff_id
  const reminderSentAt =
    dateOrTimeChanged || staffChanged
      ? hoursUntilAppointment(date, startTime) <= 24
        ? new Date().toISOString()
        : null
      : existing.reminder_sent_at

  const staff = (await getStaff(targetStaffId))!
  if (!staff?.active) throw new Error('STAFF_INVALIDO')

  const locale =
    input.customerLocale !== undefined
      ? normalizeLocale(input.customerLocale)
      : normalizeLocale(existing.locale)
  const serviceName = serviceDisplayName(service, locale)

  const customerEmail =
    input.customerEmail !== undefined
      ? input.customerEmail?.trim() || null
      : existing.customer_email
  const appointmentNotes =
    input.notes !== undefined ? input.notes?.trim() || null : existing.notes

  const persistUpdates = async (query: DbClient) => {
    if (existing.color_group_id && isColorGroupColorRow(existing.color_group_role)) {
      const washStart = minutesToTime(getWashPhaseStartMinutes(timeToMinutes(startTime)))
      await query`
        UPDATE appointments SET
          staff_id = ${targetStaffId},
          service_id = ${service.id},
          service_name = ${serviceName},
          duration_minutes = ${storedDuration},
          appointment_date = ${date},
          start_time = ${startTime},
          customer_name = ${nameSnapshot},
          customer_phone = ${customerPhone},
          customer_email = ${customerEmail},
          notes = ${appointmentNotes},
          staff_name = ${staff.name},
          reminder_sent_at = ${reminderSentAt},
          locale = ${locale}
        WHERE id = ${appointmentId}
      `
      if (dateOrTimeChanged) {
        await query`
          UPDATE appointments SET
            appointment_date = ${date},
            start_time = ${washStart},
            customer_name = ${nameSnapshot},
            customer_phone = ${customerPhone},
            customer_email = ${customerEmail},
            reminder_sent_at = ${reminderSentAt}
          WHERE color_group_id = ${existing.color_group_id}
            AND color_group_role = ${COLOR_GROUP_ROLE.wash}
        `
      } else if (hasCustomerPatch) {
        await query`
          UPDATE appointments SET
            customer_name = ${nameSnapshot},
            customer_phone = ${customerPhone},
            customer_email = ${customerEmail}
          WHERE color_group_id = ${existing.color_group_id}
            AND color_group_role = ${COLOR_GROUP_ROLE.wash}
        `
      }
    } else {
      await query`
        UPDATE appointments SET
          staff_id = ${targetStaffId},
          service_id = ${service.id},
          service_name = ${serviceName},
          duration_minutes = ${storedDuration},
          appointment_date = ${date},
          start_time = ${startTime},
          customer_name = ${nameSnapshot},
          customer_phone = ${customerPhone},
          customer_email = ${customerEmail},
          notes = ${appointmentNotes},
          staff_name = ${staff.name},
          reminder_sent_at = ${reminderSentAt},
          locale = ${locale}
        WHERE id = ${appointmentId}
      `
    }
  }

  if (scheduleChanging) {
    const lockKeys: Array<{ staffId: string; date: string }> = [
      { staffId: targetStaffId, date },
    ]
    if (existing.staff_id) {
      lockKeys.push({ staffId: existing.staff_id, date: existing.appointment_date })
    }
    await sql.begin(async (tx) => {
      await lockStaffDaysForBooking(tx, lockKeys)
      await assertBookingAvailable(tx, targetStaffId, date, segments, appointmentId)
      await persistUpdates(tx)
    })
  } else {
    await persistUpdates(sql)
  }

  const updated = (await getAppointmentById(appointmentId))!
  const scheduleChanged =
    dateOrTimeChanged || serviceId !== existing.service_id || staffChanged
  const notifyCustomerReschedule =
    scheduleChanged &&
    !isColorGroupWashRow(existing.color_group_role) &&
    input.notifyCustomerWhatsApp === true
  if (scheduleChanged) {
    if (notifyCustomerReschedule) {
      void notifyAppointmentRescheduled(updated).catch((err) => {
        console.error('Superpelu WhatsApp (cita reprogramada):', err)
      })
    }
    void notifyAdminAppointmentUpdated(existing, updated)
  }
  return updated
}

export async function updateAppointmentForAdmin(
  appointmentId: string,
  input: UpdateAppointmentInput,
): Promise<AppointmentRow> {
  const existing = await getAppointmentById(appointmentId)
  if (!existing || existing.status === 'cancelled' || !existing.staff_id) {
    throw new Error('CITA_NO_ENCONTRADA')
  }
  return updateAppointmentForStaff(appointmentId, existing.staff_id, input)
}

async function deleteAppointmentsInColorGroup(
  existing: AppointmentRow,
): Promise<{ deleted: boolean }> {
  if (!existing.color_group_id) return { deleted: false }
  const result = await sql`
    DELETE FROM appointments WHERE color_group_id = ${existing.color_group_id}
  `
  return { deleted: result.count > 0 }
}

export async function deleteAppointmentForStaff(
  appointmentId: string,
  staffId: string,
): Promise<boolean> {
  const existing = await getAppointmentById(appointmentId)
  if (!existing || existing.staff_id !== staffId) return false

  if (existing.color_group_id) {
    const { deleted } = await deleteAppointmentsInColorGroup(existing)
    if (deleted && existing.status !== 'cancelled') {
      void notifyAdminAppointmentCancelled(existing)
      void notifyAppointmentCancelled(existing).catch((err) => {
        console.error('Superpelu WhatsApp (cita cancelada):', err)
      })
    }
    return deleted
  }

  const result = await sql`
    DELETE FROM appointments WHERE id = ${appointmentId} AND staff_id = ${staffId}
  `
  if (result.count > 0 && existing.status !== 'cancelled') {
    void notifyAdminAppointmentCancelled(existing)
    void notifyAppointmentCancelled(existing).catch((err) => {
      console.error('Superpelu WhatsApp (cita cancelada):', err)
    })
  }
  return result.count > 0
}

export async function listAppointments(from: string, to: string): Promise<AppointmentRow[]> {
  return sql<AppointmentRow[]>`
    SELECT * FROM appointments
    WHERE appointment_date >= ${from} AND appointment_date <= ${to}
    ORDER BY appointment_date ASC, start_time ASC
  `
}

/**
 * Citas candidatas a recordatorio: confirmadas, sin recordatorio enviado y con
 * fecha entre hoy y mañana (la ventana de 24h solo cae en ese rango).
 */
export async function listAppointmentsDueForReminder(): Promise<AppointmentRow[]> {
  const today = todaySalon()
  const until = addDaysToDateString(today, 1)
  return sql<AppointmentRow[]>`
    SELECT * FROM appointments
    WHERE status = 'confirmed'
      AND reminder_sent_at IS NULL
      AND appointment_date >= ${today}
      AND appointment_date <= ${until}
      AND (color_group_role IS NULL OR color_group_role = ${COLOR_GROUP_ROLE.color})
    ORDER BY appointment_date ASC, start_time ASC
  `
}

export async function markReminderSent(id: string): Promise<void> {
  await sql`UPDATE appointments SET reminder_sent_at = now() WHERE id = ${id}`
}

export async function rescheduleAppointmentByCustomer(
  appointmentId: string,
  input: { date: string; startTime: string; staffId?: string },
): Promise<AppointmentRow> {
  const existing = await getAppointmentById(appointmentId)
  if (!existing || existing.status === 'cancelled' || existing.status === 'no_show') {
    throw new Error('CITA_NO_ENCONTRADA')
  }

  const serviceId = existing.service_id
  const staffId = input.staffId ?? existing.staff_id
  if (!staffId) throw new Error('CITA_NO_ENCONTRADA')

  const service = await getService(serviceId, { onlineOnly: false })
  if (!service) throw new Error('SERVICIO_INVALIDO')

  const staff = await getStaff(staffId)
  if (!staff || !staff.active) throw new Error('STAFF_INVALIDO')

  if (!(await staffCanPerformService(staffId, serviceId))) {
    throw new Error('STAFF_NO_REALIZA_SERVICIO')
  }

  const { date, startTime } = input

  if (
    !isValidDateString(date) ||
    !isSalonOpenDay(date) ||
    !isWithinSalonBookingWindow(date) ||
    !(await isStaffWorkingOnDate(staffId, date))
  ) {
    throw new Error('FECHA_INVALIDA')
  }

  const slots = await getAvailableSlots(date, serviceId, staffId, {
    excludeAppointmentId: appointmentId,
  })
  if (!slots.includes(startTime)) throw new Error('HORARIO_NO_DISPONIBLE')

  const scheduleChanged =
    date !== existing.appointment_date ||
    startTime !== existing.start_time ||
    staffId !== existing.staff_id
  const reminderSentAt = scheduleChanged
    ? hoursUntilAppointment(date, startTime) <= 24
      ? new Date().toISOString()
      : null
    : existing.reminder_sent_at

  const startMinutes = timeToMinutes(startTime)
  const bookingSegments =
    existing.color_group_id && isColorGroupColorRow(existing.color_group_role)
      ? getOccupiedSegmentsForBooking(service.id, startMinutes, service.durationMinutes)
      : [
          {
            startMinutes,
            durationMinutes: getBookingSpanMinutes(service.id, service.durationMinutes),
          },
        ]

  const lockKeys: Array<{ staffId: string; date: string }> = [{ staffId, date }]
  if (existing.staff_id && (existing.staff_id !== staffId || existing.appointment_date !== date)) {
    lockKeys.push({ staffId: existing.staff_id, date: existing.appointment_date })
  }

  await sql.begin(async (tx) => {
    await lockStaffDaysForBooking(tx, lockKeys)
    await assertBookingAvailable(tx, staffId, date, bookingSegments, appointmentId)

    if (existing.color_group_id && isColorGroupColorRow(existing.color_group_role)) {
      const washStart = minutesToTime(getWashPhaseStartMinutes(startMinutes))
      await tx`
        UPDATE appointments SET
          staff_id = ${staffId},
          staff_name = ${staff.name},
          appointment_date = ${date},
          start_time = ${startTime},
          reminder_sent_at = ${reminderSentAt}
        WHERE id = ${appointmentId}
      `
      await tx`
        UPDATE appointments SET
          staff_id = ${staffId},
          staff_name = ${staff.name},
          appointment_date = ${date},
          start_time = ${washStart},
          reminder_sent_at = ${reminderSentAt}
        WHERE color_group_id = ${existing.color_group_id}
          AND color_group_role = ${COLOR_GROUP_ROLE.wash}
      `
    } else {
      const storedDuration = getBookingSpanMinutes(service.id, service.durationMinutes)
      await tx`
        UPDATE appointments SET
          staff_id = ${staffId},
          staff_name = ${staff.name},
          duration_minutes = ${storedDuration},
          appointment_date = ${date},
          start_time = ${startTime},
          reminder_sent_at = ${reminderSentAt}
        WHERE id = ${appointmentId}
      `
    }
  })

  const row = (await getAppointmentById(appointmentId))!
  if (scheduleChanged) {
    void notifyAppointmentRescheduled(row).catch((err) => {
      console.error('Superpelu WhatsApp (cita reprogramada):', err)
    })
    void notifyAdminAppointmentUpdated(existing, row)
  }
  return row
}

/** Borrado definitivo (admin). No envía avisos. */
export async function deleteAppointmentById(appointmentId: string): Promise<boolean> {
  const existing = await getAppointmentById(appointmentId)
  if (!existing) return false
  if (existing.color_group_id) {
    const { deleted } = await deleteAppointmentsInColorGroup(existing)
    return deleted
  }
  const result = await sql`DELETE FROM appointments WHERE id = ${appointmentId}`
  return result.count > 0
}

export async function cancelAppointment(
  id: string,
  options?: { notifyCustomer?: boolean },
): Promise<AppointmentRow | undefined> {
  const existing = await getAppointmentById(id)
  if (!existing) return undefined

  const wasCancelled = existing.status === 'cancelled'
  if (existing.color_group_id) {
    await sql`
      UPDATE appointments SET status = 'cancelled', reminder_sent_at = now()
      WHERE color_group_id = ${existing.color_group_id}
    `
  } else {
    await sql`
      UPDATE appointments SET status = 'cancelled', reminder_sent_at = now()
      WHERE id = ${id}
    `
  }
  const row = await getAppointmentById(id)
  if (row && !wasCancelled) {
    void notifyAdminAppointmentCancelled(row)
    if (options?.notifyCustomer) {
      void notifyAppointmentCancelled(existing).catch((err) => {
        console.error('Superpelu WhatsApp (cita cancelada):', err)
      })
    }
  }
  return row
}

export async function markAppointmentNoShow(
  id: string,
  options?: { sendWhatsApp?: boolean },
): Promise<AppointmentRow | undefined> {
  const existing = await getAppointmentById(id)
  if (!existing) return undefined
  if (existing.status === 'cancelled' || existing.status === 'no_show') {
    return existing
  }

  if (existing.color_group_id) {
    await sql`
      UPDATE appointments SET status = 'no_show', reminder_sent_at = now()
      WHERE color_group_id = ${existing.color_group_id}
    `
  } else {
    await sql`
      UPDATE appointments SET status = 'no_show', reminder_sent_at = now()
      WHERE id = ${id}
    `
  }

  const row = await getAppointmentById(id)
  if (row && options?.sendWhatsApp) {
    void notifyAppointmentNoShow(row).catch((err) => {
      console.error('Superpelu WhatsApp (inasistencia):', err)
    })
  }
  return row
}

export function rowToPublic(row: AppointmentRow) {
  const durationMinutes = getCustomerFacingDurationMinutes(
    row.service_id,
    row.duration_minutes,
    row.color_group_role,
  )
  return {
    id: row.id,
    staffId: row.staff_id,
    staffName: row.staff_name,
    serviceId: row.service_id,
    serviceName: row.service_name,
    durationMinutes,
    colorGroupRole: row.color_group_role,
    occupiedSlots: appointmentOccupiedSlots(
      row.service_id,
      row.start_time,
      row.duration_minutes,
      { colorGroupRole: row.color_group_role },
    ),
    date: row.appointment_date,
    startTime: row.start_time,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    customerEmail: row.customer_email,
    notes: row.notes,
    status: row.status,
    locale: row.locale === 'en' ? 'en' : 'es',
    createdAt: row.created_at,
  }
}
