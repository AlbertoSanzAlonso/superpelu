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
  staffCanPerformService,
  type PublicStaff,
} from '@server/staff.js'
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
  const staffList = await listStaffForService(serviceId)
  const merged = new Set<string>()
  await Promise.all(
    staffList.map(async (member) => {
      const memberSlots = await getAvailableSlots(date, serviceId, member.id, options)
      for (const slot of memberSlots) merged.add(slot)
    }),
  )
  return [...merged].sort((a, b) => timeToMinutes(a) - timeToMinutes(b))
}

export async function getStaffAvailableAtSlot(
  date: string,
  serviceId: string,
  startTime: string,
  options: SlotOptions = {},
): Promise<PublicStaff[]> {
  const staffList = await listStaffForService(serviceId)
  const available: PublicStaff[] = []
  for (const member of staffList) {
    const slots = await getAvailableSlots(date, serviceId, member.id, options)
    if (slots.includes(startTime)) available.push(member)
  }
  return available
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
  /** Idioma en ficha del cliente (agenda); si no se envía, se usa el guardado o español. */
  customerLocale?: Locale
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
