import { randomUUID } from 'node:crypto'
import { sql, type AppointmentRow } from '@server/db.js'
import { getService } from '@server/services.js'
import { serviceDisplayName } from '@/i18n/localeHelpers'
import { normalizeLocale, type Locale } from '@/i18n/types'
import { getStaffDayWindow, isStaffWorkingOnDate } from '@server/availability.js'
import { getBlocksForStaffOnDate, isRangeBlockedByStaff } from '@server/staffBlocks.js'
import { getStaff, staffCanPerformService } from '@server/staff.js'
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
  COLOR_SPLIT_SEGMENT_MINUTES,
  type OccupiedSegment,
} from '@/lib/bookingOccupancy'
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

async function getExcludedColorGroupId(appointmentId?: string): Promise<string | null> {
  if (!appointmentId) return null
  const row = await getAppointmentById(appointmentId)
  return row?.color_group_id ?? null
}

async function getOccupiedAppointmentsForStaffOnDate(
  date: string,
  staffId: string,
  excludeAppointmentId?: string,
): Promise<AppointmentRow[]> {
  const rows = await sql<AppointmentRow[]>`
    SELECT * FROM appointments
    WHERE appointment_date = ${date} AND staff_id = ${staffId} AND status != 'cancelled'
    ORDER BY start_time ASC
  `

  const excludeGroupId = await getExcludedColorGroupId(excludeAppointmentId)
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

export type SlotOptions = {
  excludeAppointmentId?: string
  /** Panel del profesional: sin límite de días de antelación pública. */
  forStaffPortal?: boolean
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

  const window = await getStaffDayWindow(staffId, date)
  if (!window) return []

  const slots: string[] = []
  const spanMinutes = getBookingSpanMinutes(service.id, service.durationMinutes)

  for (
    let start = window.startMinutes;
    start + spanMinutes <= window.endMinutes;
    start += schedule.slotMinutes
  ) {
    const segments = getOccupiedSegmentsForBooking(service.id, start, service.durationMinutes)
    if (!(await isBookingUnavailable(staffId, date, segments, options.excludeAppointmentId))) {
      slots.push(minutesToTime(start))
    }
  }

  return filterPastSlotsForToday(date, slots)
}

export type CreateAppointmentInput = {
  serviceId: string
  staffId: string
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
}

export async function createAppointment(
  input: CreateAppointmentInput,
): Promise<AppointmentRow> {
  const service = await getService(input.serviceId, { onlineOnly: !input.forStaffPortal })
  if (!service) throw new Error('SERVICIO_INVALIDO')

  const staff = await getStaff(input.staffId)
  if (!staff || !staff.active) throw new Error('STAFF_INVALIDO')

  if (!(await staffCanPerformService(input.staffId, input.serviceId))) {
    throw new Error('STAFF_NO_REALIZA_SERVICIO')
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

  const slots = await getAvailableSlots(input.date, input.serviceId, input.staffId, {
    forStaffPortal: input.forStaffPortal,
  })
  if (!slots.includes(input.startTime)) throw new Error('HORARIO_NO_DISPONIBLE')

  const customer = resolveCustomerFromInput({
    firstName: input.customerFirstName,
    lastName: input.customerLastName,
    customerName: input.customerName,
    phone: input.customerPhone,
  })
  await upsertCustomer({
    firstName: customer.firstName,
    lastName: customer.lastName,
    phone: customer.phone,
    email: input.customerEmail,
    notes: input.customerNotes ?? input.notes,
  })
  const nameSnapshot = customerNameSnapshot(customer.firstName, customer.lastName)

  const createdAt = new Date().toISOString()
  const locale = input.forStaffPortal ? 'es' : normalizeLocale(input.locale)
  const serviceName = serviceDisplayName(service, locale)

  // Si la cita es en menos de 24h, no hay recordatorio: se marca como ya gestionado.
  const reminderSentAt =
    hoursUntilAppointment(input.date, input.startTime) <= 24 ? createdAt : null

  const colorGroup = await prepareColorBookingGroupIds(service.id)
  let primaryId: string

  if (colorGroup) {
    const washServiceName = await resolveWashServiceName(locale)
    await insertColorBookingGroup({
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
    })
    primaryId = colorGroup.colorId
  } else {
    primaryId = randomUUID()
    const storedDuration = getBookingSpanMinutes(service.id, service.durationMinutes)
    await sql`
      INSERT INTO appointments (
        id, staff_id, staff_name, service_id, service_name, duration_minutes,
        appointment_date, start_time,
        customer_name, customer_phone, customer_email, notes,
        status, created_at, reminder_sent_at, locale
      ) VALUES (
        ${primaryId}, ${staff.id}, ${staff.name}, ${service.id}, ${serviceName}, ${storedDuration},
        ${input.date}, ${input.startTime},
        ${nameSnapshot}, ${customer.phone}, ${input.customerEmail?.trim() || null},
        ${input.notes?.trim() || null}, 'confirmed', ${createdAt}, ${reminderSentAt}, ${locale}
      )
    `
  }

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
  if (!existing || existing.status === 'cancelled') {
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
  if (await isBookingUnavailable(targetStaffId, date, segments, appointmentId)) {
    throw new Error('HORARIO_NO_DISPONIBLE')
  }

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

  const locale = normalizeLocale(existing.locale)
  const serviceName = serviceDisplayName(service, locale)

  const customerEmail =
    input.customerEmail !== undefined
      ? input.customerEmail?.trim() || null
      : existing.customer_email
  const appointmentNotes =
    input.notes !== undefined ? input.notes?.trim() || null : existing.notes

  if (existing.color_group_id && isColorGroupColorRow(existing.color_group_role)) {
    const washStart = minutesToTime(getWashPhaseStartMinutes(timeToMinutes(startTime)))
    await sql`
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
        reminder_sent_at = ${reminderSentAt}
      WHERE id = ${appointmentId}
    `
    if (dateOrTimeChanged) {
      await sql`
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
      await sql`
        UPDATE appointments SET
          customer_name = ${nameSnapshot},
          customer_phone = ${customerPhone},
          customer_email = ${customerEmail}
        WHERE color_group_id = ${existing.color_group_id}
          AND color_group_role = ${COLOR_GROUP_ROLE.wash}
      `
    }
  } else {
    await sql`
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
        reminder_sent_at = ${reminderSentAt}
      WHERE id = ${appointmentId}
    `
  }

  const updated = (await getAppointmentById(appointmentId))!
  const scheduleChanged =
    dateOrTimeChanged || serviceId !== existing.service_id || staffChanged
  const notifyCustomerReschedule =
    scheduleChanged &&
    !isColorGroupWashRow(existing.color_group_role) &&
    input.notifyCustomerWhatsApp !== false
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

export async function deleteAppointmentForStaff(
  appointmentId: string,
  staffId: string,
): Promise<boolean> {
  const existing = await getAppointmentById(appointmentId)
  if (!existing || existing.staff_id !== staffId) return false

  if (existing.color_group_id && isColorGroupColorRow(existing.color_group_role)) {
    const result = await sql`
      DELETE FROM appointments WHERE color_group_id = ${existing.color_group_id}
    `
    if (result.count > 0 && existing.status !== 'cancelled') {
      void notifyAdminAppointmentCancelled(existing)
      void notifyAppointmentCancelled(existing).catch((err) => {
        console.error('Superpelu WhatsApp (cita cancelada):', err)
      })
    }
    return result.count > 0
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
  if (!existing || existing.status === 'cancelled') {
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

  if (existing.color_group_id && isColorGroupColorRow(existing.color_group_role)) {
    const washStart = minutesToTime(getWashPhaseStartMinutes(timeToMinutes(startTime)))
    await sql`
      UPDATE appointments SET
        staff_id = ${staffId},
        staff_name = ${staff.name},
        appointment_date = ${date},
        start_time = ${startTime},
        reminder_sent_at = ${reminderSentAt}
      WHERE id = ${appointmentId}
    `
    await sql`
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
    await sql`
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
  if (existing.color_group_id && isColorGroupColorRow(existing.color_group_role)) {
    const result = await sql`
      DELETE FROM appointments WHERE color_group_id = ${existing.color_group_id}
    `
    return result.count > 0
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
    createdAt: row.created_at,
  }
}
