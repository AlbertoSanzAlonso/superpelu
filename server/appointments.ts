import { randomUUID } from 'node:crypto'
import { db, type AppointmentRow } from './db.js'
import { getService } from './services.js'
import { getStaffDayWindow, isStaffWorkingOnDate } from './availability.js'
import { getBlocksForStaffOnDate, isRangeBlockedByStaff } from './staffBlocks.js'
import { getStaff, staffCanPerformService } from './staff.js'
import { schedule } from './config.js'
import {
  customerNameSnapshot,
  resolveCustomerFromInput,
  upsertCustomer,
} from './customers.js'
import { isSalonOpenDay, isWithinSalonBookingWindow, todaySalon } from '../src/lib/dates.ts'
import {
  appointmentOccupiedSlots,
  getBookingSpanMinutes,
  getOccupiedSegmentsForAppointment,
  getOccupiedSegmentsForBooking,
  occupiedSegmentsOverlap,
  type OccupiedSegment,
} from '../src/lib/bookingOccupancy.ts'

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

function getOccupiedAppointmentsForStaffOnDate(
  date: string,
  staffId: string,
  excludeAppointmentId?: string,
): AppointmentRow[] {
  const rows = db
    .prepare(
      `SELECT * FROM appointments
       WHERE appointment_date = ? AND staff_id = ? AND status != 'cancelled'
       ORDER BY start_time ASC`,
    )
    .all(date, staffId) as AppointmentRow[]

  if (!excludeAppointmentId) return rows
  return rows.filter((row) => row.id !== excludeAppointmentId)
}

function isSegmentBlocked(
  staffId: string,
  date: string,
  segment: OccupiedSegment,
): boolean {
  const endMinutes = segment.startMinutes + segment.durationMinutes
  return isRangeBlockedByStaff(staffId, date, segment.startMinutes, endMinutes)
}

function isBookingUnavailable(
  staffId: string,
  date: string,
  segments: OccupiedSegment[],
  excludeAppointmentId?: string,
): boolean {
  if (segments.some((segment) => isSegmentBlocked(staffId, date, segment))) {
    return true
  }

  const occupied = getOccupiedAppointmentsForStaffOnDate(date, staffId, excludeAppointmentId)
  return occupied.some((apt) => {
    const aptSegments = getOccupiedSegmentsForAppointment(
      apt.service_id,
      timeToMinutes(apt.start_time),
      apt.duration_minutes,
    )
    return occupiedSegmentsOverlap(segments, aptSegments)
  })
}

export type SlotOptions = {
  excludeAppointmentId?: string
  /** Panel del profesional: sin límite de días de antelación pública. */
  forStaffPortal?: boolean
}

export function getAvailableSlots(
  date: string,
  serviceId: string,
  staffId: string,
  options: SlotOptions = {},
): string[] {
  const dateAllowed = options.forStaffPortal
    ? isValidDateString(date) && isSalonOpenDay(date)
    : isValidDateString(date) && isSalonOpenDay(date) && isWithinSalonBookingWindow(date)

  if (!dateAllowed) return []

  const service = getService(serviceId, { onlineOnly: !options.forStaffPortal })
  if (!service) return []

  const staff = getStaff(staffId)
  if (!staff || staff.active !== 1 || !staffCanPerformService(staffId, serviceId)) {
    return []
  }

  const window = getStaffDayWindow(staffId, date)
  if (!window) return []

  const slots: string[] = []

  const spanMinutes = getBookingSpanMinutes(service.id, service.durationMinutes)

  for (
    let start = window.startMinutes;
    start + spanMinutes <= window.endMinutes;
    start += schedule.slotMinutes
  ) {
    const segments = getOccupiedSegmentsForBooking(service.id, start, service.durationMinutes)
    if (!isBookingUnavailable(staffId, date, segments, options.excludeAppointmentId)) {
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
  /** Nombre completo (reserva pública); alternativa a firstName + lastName. */
  customerName?: string
  customerFirstName?: string
  customerLastName?: string
  customerPhone: string
  customerEmail?: string
  notes?: string
  forStaffPortal?: boolean
}

export function createAppointment(input: CreateAppointmentInput): AppointmentRow {
  const service = getService(input.serviceId, { onlineOnly: !input.forStaffPortal })
  if (!service) throw new Error('SERVICIO_INVALIDO')

  const staff = getStaff(input.staffId)
  if (!staff || staff.active !== 1) throw new Error('STAFF_INVALIDO')

  if (!staffCanPerformService(input.staffId, input.serviceId)) {
    throw new Error('STAFF_NO_REALIZA_SERVICIO')
  }

  const dateOk = input.forStaffPortal
    ? isValidDateString(input.date) &&
      isSalonOpenDay(input.date) &&
      isStaffWorkingOnDate(input.staffId, input.date)
    : isValidDateString(input.date) &&
      isSalonOpenDay(input.date) &&
      isWithinSalonBookingWindow(input.date) &&
      isStaffWorkingOnDate(input.staffId, input.date)

  if (!dateOk) throw new Error('FECHA_INVALIDA')

  const slots = getAvailableSlots(input.date, input.serviceId, input.staffId, {
    forStaffPortal: input.forStaffPortal,
  })
  if (!slots.includes(input.startTime)) throw new Error('HORARIO_NO_DISPONIBLE')

  const customer = resolveCustomerFromInput({
    firstName: input.customerFirstName,
    lastName: input.customerLastName,
    customerName: input.customerName,
    phone: input.customerPhone,
  })
  upsertCustomer({
    firstName: customer.firstName,
    lastName: customer.lastName,
    phone: customer.phone,
    email: input.customerEmail,
    notes: input.notes,
  })
  const nameSnapshot = customerNameSnapshot(customer.firstName, customer.lastName)

  const id = randomUUID()
  const createdAt = new Date().toISOString()
  const storedDuration = getBookingSpanMinutes(service.id, service.durationMinutes)

  db.prepare(
    `INSERT INTO appointments (
      id, staff_id, staff_name, service_id, service_name, duration_minutes,
      appointment_date, start_time,
      customer_name, customer_phone, customer_email, notes,
      status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', ?)`,
  ).run(
    id,
    staff.id,
    staff.name,
    service.id,
    service.nameEs,
    storedDuration,
    input.date,
    input.startTime,
    nameSnapshot,
    customer.phone,
    input.customerEmail?.trim() || null,
    input.notes?.trim() || null,
    createdAt,
  )

  return db.prepare('SELECT * FROM appointments WHERE id = ?').get(id) as AppointmentRow
}

export type UpdateAppointmentInput = {
  serviceId?: string
  date?: string
  startTime?: string
  customerName?: string
  customerFirstName?: string
  customerLastName?: string
  customerPhone?: string
  customerEmail?: string | null
  notes?: string | null
}

export function getAppointmentById(id: string): AppointmentRow | undefined {
  return db.prepare('SELECT * FROM appointments WHERE id = ?').get(id) as
    | AppointmentRow
    | undefined
}

export function listAppointmentsForStaff(
  staffId: string,
  from: string,
  to: string,
): AppointmentRow[] {
  return db
    .prepare(
      `SELECT * FROM appointments
       WHERE staff_id = ? AND appointment_date >= ? AND appointment_date <= ?
         AND status != 'cancelled'
       ORDER BY appointment_date ASC, start_time ASC`,
    )
    .all(staffId, from, to) as AppointmentRow[]
}

export function updateAppointmentForStaff(
  appointmentId: string,
  staffId: string,
  input: UpdateAppointmentInput,
): AppointmentRow {
  const existing = getAppointmentById(appointmentId)
  if (!existing || existing.staff_id !== staffId || existing.status === 'cancelled') {
    throw new Error('CITA_NO_ENCONTRADA')
  }

  const serviceId = input.serviceId ?? existing.service_id
  const date = input.date ?? existing.appointment_date
  const startTime = input.startTime ?? existing.start_time
  const service = getService(serviceId, { onlineOnly: false })
  if (!service) throw new Error('SERVICIO_INVALIDO')

  if (!staffCanPerformService(staffId, serviceId)) {
    throw new Error('STAFF_NO_REALIZA_SERVICIO')
  }

  if (!isValidDateString(date) || !isSalonOpenDay(date) || !isStaffWorkingOnDate(staffId, date)) {
    throw new Error('FECHA_INVALIDA')
  }

  const startMinutes = timeToMinutes(startTime)
  const segments = getOccupiedSegmentsForBooking(service.id, startMinutes, service.durationMinutes)
  if (isBookingUnavailable(staffId, date, segments, appointmentId)) {
    throw new Error('HORARIO_NO_DISPONIBLE')
  }

  const storedDuration = getBookingSpanMinutes(service.id, service.durationMinutes)

  const hasCustomerPatch =
    input.customerName !== undefined ||
    input.customerFirstName !== undefined ||
    input.customerLastName !== undefined ||
    input.customerPhone !== undefined

  let nameSnapshot = existing.customer_name
  let customerPhone = existing.customer_phone

  if (hasCustomerPatch) {
    const split = resolveCustomerFromInput({
      firstName: input.customerFirstName,
      lastName: input.customerLastName,
      customerName: input.customerName ?? existing.customer_name,
      phone: input.customerPhone ?? existing.customer_phone,
    })
    upsertCustomer({
      firstName: split.firstName,
      lastName: split.lastName,
      phone: split.phone,
      email:
        input.customerEmail !== undefined ? input.customerEmail : existing.customer_email,
      notes: input.notes !== undefined ? input.notes : existing.notes,
    })
    nameSnapshot = customerNameSnapshot(split.firstName, split.lastName)
    customerPhone = split.phone
  }

  const staff = getStaff(staffId)!
  db.prepare(
    `UPDATE appointments SET
      service_id = ?, service_name = ?, duration_minutes = ?,
      appointment_date = ?, start_time = ?,
      customer_name = ?, customer_phone = ?, customer_email = ?, notes = ?,
      staff_name = ?
     WHERE id = ?`,
  ).run(
    service.id,
    service.nameEs,
    storedDuration,
    date,
    startTime,
    nameSnapshot,
    customerPhone,
    input.customerEmail !== undefined
      ? input.customerEmail?.trim() || null
      : existing.customer_email,
    input.notes !== undefined ? input.notes?.trim() || null : existing.notes,
    staff.name,
    appointmentId,
  )

  return getAppointmentById(appointmentId)!
}

export function updateAppointmentForAdmin(
  appointmentId: string,
  input: UpdateAppointmentInput,
): AppointmentRow {
  const existing = getAppointmentById(appointmentId)
  if (!existing || existing.status === 'cancelled' || !existing.staff_id) {
    throw new Error('CITA_NO_ENCONTRADA')
  }
  return updateAppointmentForStaff(appointmentId, existing.staff_id, input)
}

export function deleteAppointmentForStaff(appointmentId: string, staffId: string): boolean {
  const existing = getAppointmentById(appointmentId)
  if (!existing || existing.staff_id !== staffId) return false
  db.prepare(`DELETE FROM appointments WHERE id = ? AND staff_id = ?`).run(appointmentId, staffId)
  return true
}

export function listAppointments(from: string, to: string): AppointmentRow[] {
  return db
    .prepare(
      `SELECT * FROM appointments
       WHERE appointment_date >= ? AND appointment_date <= ?
       ORDER BY appointment_date ASC, start_time ASC`,
    )
    .all(from, to) as AppointmentRow[]
}

export function cancelAppointment(id: string): AppointmentRow | undefined {
  const existing = getAppointmentById(id)
  if (!existing) return undefined

  db.prepare(`UPDATE appointments SET status = 'cancelled' WHERE id = ?`).run(id)
  return getAppointmentById(id)
}

export function rowToPublic(row: AppointmentRow) {
  return {
    id: row.id,
    staffId: row.staff_id,
    staffName: row.staff_name,
    serviceId: row.service_id,
    serviceName: row.service_name,
    durationMinutes: row.duration_minutes,
    occupiedSlots: appointmentOccupiedSlots(
      row.service_id,
      row.start_time,
      row.duration_minutes,
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
