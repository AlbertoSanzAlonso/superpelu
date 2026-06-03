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

type OccupiedRow = AppointmentRow & { category_id: string | null; customer_locale: string | null }

async function getOccupiedOnDate(date: string, staffId: string): Promise<OccupiedRow[]> {
  return sql<OccupiedRow[]>`
    SELECT a.*, s.category_id, c.locale AS customer_locale
    FROM appointments a
    LEFT JOIN services s ON s.id = a.service_id
    LEFT JOIN customers c ON c.phone = a.customer_phone
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
  customerLocale: 'es' | 'en'
  notes: string | null
  status: string
  createdAt: string
  occupiedSlots: { startTime: string; endTime: string }[]
  colorGroupId: string | null
  colorGroupRole: string | null
  colorGroupLinked: {
    id: string
    startTime: string
    endTime: string
    serviceId: string
    serviceName: string
    staffId: string
    staffName: string
    categoryId: string | null
  } | null
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
      { colorGroupRole: row.color_group_role },
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
      customerLocale: row.customer_locale === 'en' ? 'en' : 'es',
      notes: row.notes,
      status: row.status,
      createdAt: row.created_at,
      occupiedSlots,
      colorGroupId: row.color_group_id,
      colorGroupRole: row.color_group_role,
      colorGroupLinked: null,
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
      if (apt.status === 'no_show') return false
      const aptSegments = getOccupiedSegmentsForAppointment(
        apt.service_id,
        timeToMinutes(apt.start_time),
        apt.duration_minutes,
        { colorGroupRole: apt.color_group_role },
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

function enrichColorGroupLinks(schedules: StaffDaySchedule[]): StaffDaySchedule[] {
  const byGroup = new Map<
    string,
    { color?: DayScheduleAppointment; wash?: DayScheduleAppointment }
  >()

  for (const schedule of schedules) {
    for (const apt of schedule.appointments) {
      if (!apt.colorGroupId) continue
      const entry = byGroup.get(apt.colorGroupId) ?? {}
      if (apt.colorGroupRole === 'color') entry.color = apt
      if (apt.colorGroupRole === 'wash') entry.wash = apt
      byGroup.set(apt.colorGroupId, entry)
    }
  }

  function staffForAppointmentId(aptId: string): { staffId: string; staffName: string } | null {
    for (const s of schedules) {
      if (s.appointments.some((a) => a.id === aptId)) {
        return { staffId: s.staffId, staffName: s.staffName }
      }
    }
    return null
  }

  const toLinked = (
    sibling: DayScheduleAppointment | undefined,
  ): DayScheduleAppointment['colorGroupLinked'] => {
    if (!sibling) return null
    const staff = staffForAppointmentId(sibling.id)
    if (!staff) return null
    return {
      id: sibling.id,
      startTime: sibling.startTime,
      endTime: sibling.endTime,
      serviceId: sibling.serviceId,
      serviceName: sibling.serviceName,
      staffId: staff.staffId,
      staffName: staff.staffName,
      categoryId: sibling.categoryId,
    }
  }

  return schedules.map((schedule) => ({
    ...schedule,
    appointments: schedule.appointments.map((apt) => {
      if (!apt.colorGroupId) return apt
      const group = byGroup.get(apt.colorGroupId)
      if (!group) return apt
      const sibling = apt.colorGroupRole === 'color' ? group.wash : group.color
      return {
        ...apt,
        colorGroupLinked: toLinked(sibling),
      }
    }),
  }))
}

export async function listStaffDaySchedules(date: string) {
  const members = await listActiveStaff()
  const schedules = await Promise.all(
    members.map((member) => getStaffDaySchedule(member.id, date)),
  )
  const filtered = schedules.filter((s): s is StaffDaySchedule => s !== null)
  return enrichColorGroupLinks(filtered)
}

export { getAvailableSlots }
