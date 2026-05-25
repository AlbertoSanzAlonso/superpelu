import { randomUUID } from 'node:crypto'
import { db, type AppointmentRow } from './db.js'
import { getService, schedule, type ServiceId } from './config.js'

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function parseDate(date: string): Date {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function isValidDateString(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(parseDate(date).getTime())
}

function isOpenDay(date: string): boolean {
  return schedule.openDays.includes(parseDate(date).getDay())
}

function isWithinBookingWindow(date: string): boolean {
  const target = parseDate(date)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const max = new Date(today)
  max.setDate(max.getDate() + schedule.maxDaysAhead)
  return target >= today && target <= max
}

function getAppointmentsForDate(date: string): AppointmentRow[] {
  return db
    .prepare(
      `SELECT * FROM appointments
       WHERE appointment_date = ? AND status != 'cancelled'
       ORDER BY start_time ASC`,
    )
    .all(date) as AppointmentRow[]
}

function overlaps(
  startA: number,
  durationA: number,
  startB: number,
  durationB: number,
): boolean {
  const endA = startA + durationA
  const endB = startB + durationB
  return startA < endB && startB < endA
}

export function getAvailableSlots(date: string, serviceId: string): string[] {
  if (!isValidDateString(date) || !isOpenDay(date) || !isWithinBookingWindow(date)) {
    return []
  }

  const service = getService(serviceId)
  if (!service) return []

  const open = timeToMinutes(schedule.openTime)
  const close = timeToMinutes(schedule.closeTime)
  const existing = getAppointmentsForDate(date)

  const slots: string[] = []

  for (let start = open; start + service.durationMinutes <= close; start += schedule.slotMinutes) {
    const blocked = existing.some((apt) =>
      overlaps(
        start,
        service.durationMinutes,
        timeToMinutes(apt.start_time),
        apt.duration_minutes,
      ),
    )
    if (!blocked) {
      slots.push(minutesToTime(start))
    }
  }

  return slots
}

export type CreateAppointmentInput = {
  serviceId: ServiceId
  date: string
  startTime: string
  customerName: string
  customerPhone: string
  customerEmail?: string
  notes?: string
}

export function createAppointment(input: CreateAppointmentInput): AppointmentRow {
  const service = getService(input.serviceId)
  if (!service) {
    throw new Error('SERVICIO_INVALIDO')
  }

  if (!isValidDateString(input.date) || !isOpenDay(input.date) || !isWithinBookingWindow(input.date)) {
    throw new Error('FECHA_INVALIDA')
  }

  const slots = getAvailableSlots(input.date, input.serviceId)
  if (!slots.includes(input.startTime)) {
    throw new Error('HORARIO_NO_DISPONIBLE')
  }

  const id = randomUUID()
  const createdAt = new Date().toISOString()

  db.prepare(
    `INSERT INTO appointments (
      id, service_id, service_name, duration_minutes,
      appointment_date, start_time,
      customer_name, customer_phone, customer_email, notes,
      status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', ?)`,
  ).run(
    id,
    service.id,
    service.name,
    service.durationMinutes,
    input.date,
    input.startTime,
    input.customerName.trim(),
    input.customerPhone.trim(),
    input.customerEmail?.trim() || null,
    input.notes?.trim() || null,
    createdAt,
  )

  return db.prepare('SELECT * FROM appointments WHERE id = ?').get(id) as AppointmentRow
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
  const existing = db.prepare('SELECT * FROM appointments WHERE id = ?').get(id) as
    | AppointmentRow
    | undefined
  if (!existing) return undefined

  db.prepare(`UPDATE appointments SET status = 'cancelled' WHERE id = ?`).run(id)
  return db.prepare('SELECT * FROM appointments WHERE id = ?').get(id) as AppointmentRow
}

export function rowToPublic(row: AppointmentRow) {
  return {
    id: row.id,
    serviceId: row.service_id,
    serviceName: row.service_name,
    durationMinutes: row.duration_minutes,
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
