import { sql } from '@server/db.js'
import { rangesToWorkWindows } from '@/lib/core/scheduleHours'
import { dayOfWeekFromDateString, isSalonOpenDay } from '@/lib/core/dates'
import { getSalonSchedule } from '@server/schedule/index.js'
import { getSpecialScheduleForDate } from '@server/schedule/special.js'

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

function rowToWindow(row: { start_time: string; end_time: string }): StaffDayWindow | null {
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

async function salonFallbackWindows(dayOfWeek: number): Promise<StaffDayWindow[]> {
  const salon = await getSalonSchedule()
  const ranges = salon.weeklyWindows[dayOfWeek] ?? []
  return rangesToWorkWindows(ranges).map((w) => ({
    startMinutes: timeToMinutes(w.startTime),
    endMinutes: timeToMinutes(w.endTime),
    startTime: w.startTime,
    endTime: w.endTime,
  }))
}

/** Franjas laborales del profesional para un día (puede haber varias, p. ej. mañana y tarde). */
export async function getStaffDayWindows(
  staffId: string,
  date: string,
): Promise<StaffDayWindow[]> {
  if (!isSalonOpenDay(date)) return []

  const special = await getSpecialScheduleForDate(staffId, date)
  if (special.length > 0) {
    return special
      .map((r) => rowToWindow({ start_time: r.start, end_time: r.end }))
      .filter((w): w is StaffDayWindow => w !== null)
  }

  const dayOfWeek = dayOfWeekFromDateString(date)
  const rows = await sql<{ start_time: string; end_time: string }[]>`
    SELECT start_time, end_time FROM staff_availability
    WHERE staff_id = ${staffId} AND day_of_week = ${dayOfWeek}
    ORDER BY start_time ASC
  `

  if (rows.length === 0) {
    const [{ count }] = await sql<{ count: string }[]>`
      SELECT COUNT(*)::text AS count FROM staff_availability WHERE staff_id = ${staffId}
    `
    if (Number(count) === 0) {
      return salonFallbackWindows(dayOfWeek)
    }
    return []
  }

  return rows.map(rowToWindow).filter((w): w is StaffDayWindow => w !== null)
}

/** Primera franja del día (compatibilidad). Preferir getStaffDayWindows. */
export async function getStaffDayWindow(
  staffId: string,
  date: string,
): Promise<StaffDayWindow | null> {
  const windows = await getStaffDayWindows(staffId, date)
  return windows[0] ?? null
}

export async function isStaffWorkingOnDate(staffId: string, date: string): Promise<boolean> {
  return (await getStaffDayWindows(staffId, date)).length > 0
}
