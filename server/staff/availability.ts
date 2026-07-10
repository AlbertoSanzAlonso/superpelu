import { sql } from '@server/db.js'
import { dayOfWeekFromDateString } from '@/lib/core/dates'
import { getSalonDayWindows, type SalonDayWindow } from '@server/schedule/salonDay.js'
import { resolveStaffSpecialSchedule } from '@server/schedule/special.js'

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

function rangesToStaffDayWindows(
  ranges: { start: string; end: string }[],
): StaffDayWindow[] {
  return ranges
    .map((range) => rowToWindow({ start_time: range.start, end_time: range.end }))
    .filter((window): window is StaffDayWindow => window !== null)
}

function intersectStaffWithSalonWindows(
  staffWindows: StaffDayWindow[],
  salonWindows: SalonDayWindow[],
): StaffDayWindow[] {
  const result: StaffDayWindow[] = []
  for (const staffWindow of staffWindows) {
    for (const salonWindow of salonWindows) {
      const startMinutes = Math.max(staffWindow.startMinutes, salonWindow.startMinutes)
      const endMinutes = Math.min(staffWindow.endMinutes, salonWindow.endMinutes)
      if (endMinutes <= startMinutes) continue
      result.push({
        startMinutes,
        endMinutes,
        startTime: minutesToTime(startMinutes),
        endTime: minutesToTime(endMinutes),
      })
    }
  }
  return result.sort((a, b) => a.startMinutes - b.startMinutes)
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function salonWindowsAsStaffWindows(salonWindows: SalonDayWindow[]): StaffDayWindow[] {
  return salonWindows.map((window) => ({ ...window }))
}

/** Franjas laborales del profesional para un día (puede haber varias, p. ej. mañana y tarde). */
export async function getStaffDayWindows(
  staffId: string,
  date: string,
): Promise<StaffDayWindow[]> {
  const staffSpecial = await resolveStaffSpecialSchedule(staffId, date)
  if (staffSpecial !== null) {
    return rangesToStaffDayWindows(staffSpecial)
  }

  const salonWindows = await getSalonDayWindows(date)
  if (salonWindows.length === 0) return []

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
      return salonWindowsAsStaffWindows(salonWindows)
    }
    return []
  }

  const staffWindows = rows.map(rowToWindow).filter((window): window is StaffDayWindow => window !== null)
  return intersectStaffWithSalonWindows(staffWindows, salonWindows)
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
