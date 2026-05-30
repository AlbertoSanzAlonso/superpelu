import { sql } from './db.js'
import { schedule } from './config.js'
import { dayOfWeekFromDateString, isSalonOpenDay } from '@/lib/dates'

export type StaffDayWindow = {
  startMinutes: number
  endMinutes: number
  startTime: string
  endTime: string
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

/** Franja laboral del profesional para un día concreto (plantilla semanal). */
export async function getStaffDayWindow(
  staffId: string,
  date: string,
): Promise<StaffDayWindow | null> {
  if (!isSalonOpenDay(date)) return null

  const dayOfWeek = dayOfWeekFromDateString(date)
  const rows = await sql<{ start_time: string; end_time: string }[]>`
    SELECT start_time, end_time FROM staff_availability
    WHERE staff_id = ${staffId} AND day_of_week = ${dayOfWeek}
  `
  const row = rows[0]

  if (!row) {
    const [{ count }] = await sql<{ count: string }[]>`
      SELECT COUNT(*)::text AS count FROM staff_availability WHERE staff_id = ${staffId}
    `
    if (Number(count) === 0) {
      return {
        startMinutes: timeToMinutes(schedule.openTime),
        endMinutes: timeToMinutes(schedule.closeTime),
        startTime: schedule.openTime,
        endTime: schedule.closeTime,
      }
    }
    return null
  }

  const startMinutes = timeToMinutes(row.start_time)
  const endMinutes = timeToMinutes(row.end_time)
  if (endMinutes <= startMinutes) return null

  return {
    startMinutes,
    endMinutes,
    startTime: row.start_time,
    endTime: row.end_time,
  }
}

export async function isStaffWorkingOnDate(staffId: string, date: string): Promise<boolean> {
  return (await getStaffDayWindow(staffId, date)) !== null
}
