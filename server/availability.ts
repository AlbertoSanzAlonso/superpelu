import { db } from './db.js'
import { schedule } from './config.js'
import { dayOfWeekFromDateString, isSalonOpenDay } from '../src/lib/dates.ts'

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
export function getStaffDayWindow(staffId: string, date: string): StaffDayWindow | null {
  if (!isSalonOpenDay(date)) return null

  const dayOfWeek = dayOfWeekFromDateString(date)
  const row = db
    .prepare(
      `SELECT start_time, end_time FROM staff_availability
       WHERE staff_id = ? AND day_of_week = ?`,
    )
    .get(staffId, dayOfWeek) as { start_time: string; end_time: string } | undefined

  if (!row) {
    const { count } = db
      .prepare('SELECT COUNT(*) AS count FROM staff_availability WHERE staff_id = ?')
      .get(staffId) as { count: number }
    if (count === 0) {
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

export function isStaffWorkingOnDate(staffId: string, date: string): boolean {
  return getStaffDayWindow(staffId, date) !== null
}
