import { getStaffDayWindow } from '@server/availability.js'
import { getAvailableSlots } from '@server/appointments.js'
import { sql } from '@server/db.js'
import { schedule } from '@server/config.js'
import { getBlocksForStaffOnDate, rowBlockToPublic } from '@server/staffBlocks.js'
import { getStaff, listActiveStaff } from '@server/staff.js'
import type { AppointmentRow } from '@server/db.js'
import {
  appointmentOccupiedSlots,
  getOccupiedSegmentsForAppointment,
  occupiedSegmentsOverlap,
} from '@/lib/bookingOccupancy'

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
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

type OccupiedRow = AppointmentRow & { category_id: string | null }

async function getOccupiedOnDate(date: string, staffId: string): Promise<OccupiedRow[]> {
  return sql<OccupiedRow[]>`
    SELECT a.*, s.category_id
    FROM appointments a
    LEFT JOIN services s ON s.id = a.service_id
    WHERE a.appointment_date = ${date} AND a.staff_id = ${staffId} AND a.status != 'cancelled'
    ORDER BY a.start_time ASC
  `
}

export type DayScheduleAppointment = {
  id: string
  startTime: string
  endTime: string
  durationMinutes: number
  serviceId: string
  serviceName: string
  categoryId: string | null
  customerName: string
  customerPhone: string
  customerEmail: string | null
  notes: string | null
  createdAt: string
  occupiedSlots: { startTime: string; endTime: string }[]
}

export type DayScheduleBlock = {
  id: string
  startTime: string
  endTime: string
  note: string | null
}

export type StaffDaySchedule = {
  staffId: string
  staffName: string
  working: boolean
  window: { startTime: string; endTime: string } | null
  appointments: DayScheduleAppointment[]
  blocks: DayScheduleBlock[]
  freeSlots: string[]
}

export async function getStaffDaySchedule(
  staffId: string,
  date: string,
): Promise<StaffDaySchedule | null> {
  const staff = await getStaff(staffId)
  if (!staff) return null

  const window = await getStaffDayWindow(staffId, date)
  if (!window) {
    return {
      staffId: staff.id,
      staffName: staff.name,
      working: false,
      window: null,
      appointments: [],
      blocks: [],
      freeSlots: [],
    }
  }

  const occupied = await getOccupiedOnDate(date, staffId)
  const blockRows = await getBlocksForStaffOnDate(date, staffId)
  const blocks: DayScheduleBlock[] = blockRows.map((row) => ({
    id: row.id,
    startTime: row.start_time,
    endTime: row.end_time,
    note: row.note,
  }))
  const appointments: DayScheduleAppointment[] = occupied.map((row) => {
    const startMinutes = timeToMinutes(row.start_time)
    const occupiedSlots = appointmentOccupiedSlots(
      row.service_id,
      row.start_time,
      row.duration_minutes,
    )
    return {
      id: row.id,
      startTime: row.start_time,
      endTime: minutesToTime(startMinutes + row.duration_minutes),
      durationMinutes: row.duration_minutes,
      serviceId: row.service_id,
      serviceName: row.service_name,
      categoryId: row.category_id ?? null,
      customerName: row.customer_name,
      customerPhone: row.customer_phone,
      customerEmail: row.customer_email,
      notes: row.notes,
      createdAt: row.created_at,
      occupiedSlots,
    }
  })

  const freeSlots: string[] = []
  for (
    let start = window.startMinutes;
    start < window.endMinutes;
    start += schedule.slotMinutes
  ) {
    const slotSegment = { startMinutes: start, durationMinutes: schedule.slotMinutes }
    const blockedByApt = occupied.some((apt) => {
      const aptSegments = getOccupiedSegmentsForAppointment(
        apt.service_id,
        timeToMinutes(apt.start_time),
        apt.duration_minutes,
      )
      return occupiedSegmentsOverlap([slotSegment], aptSegments)
    })
    const blockedByBlock = blockRows.some((b) =>
      overlaps(
        start,
        schedule.slotMinutes,
        timeToMinutes(b.start_time),
        timeToMinutes(b.end_time) - timeToMinutes(b.start_time),
      ),
    )
    if (!blockedByApt && !blockedByBlock) {
      freeSlots.push(minutesToTime(start))
    }
  }

  return {
    staffId: staff.id,
    staffName: staff.name,
    working: true,
    window: { startTime: window.startTime, endTime: window.endTime },
    appointments,
    blocks,
    freeSlots,
  }
}

export { rowBlockToPublic }

export async function listStaffDaySchedules(date: string) {
  const members = await listActiveStaff()
  const schedules = await Promise.all(
    members.map((member) => getStaffDaySchedule(member.id, date)),
  )
  return schedules.filter((s): s is StaffDaySchedule => s !== null)
}

export { getAvailableSlots }
