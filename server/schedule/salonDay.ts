import { dayOfWeekFromDateString, isValidDateString, isWithinSalonBookingWindow } from '@/lib/core/dates'
import { rangesToWorkWindows } from '@/lib/core/scheduleHours'
import { getSalonSchedule, type ScheduleTimeRange } from '@server/schedule/index.js'
import {
  getSalonSpecialScheduleForDate,
  resolveSalonSpecialSchedule,
} from '@server/schedule/special.js'

export type SalonDayWindow = {
  startMinutes: number
  endMinutes: number
  startTime: string
  endTime: string
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

function rangesToSalonDayWindows(ranges: ScheduleTimeRange[]): SalonDayWindow[] {
  return rangesToWorkWindows(ranges)
    .map((window) => {
      const startMinutes = timeToMinutes(window.startTime)
      const endMinutes = timeToMinutes(window.endTime)
      if (endMinutes <= startMinutes) return null
      return {
        startMinutes,
        endMinutes,
        startTime: window.startTime,
        endTime: window.endTime,
      }
    })
    .filter((window): window is SalonDayWindow => window !== null)
}

/** Franjas del salón para una fecha concreta (especial o semanal). */
export async function getSalonDayWindows(date: string): Promise<SalonDayWindow[]> {
  const special = await resolveSalonSpecialSchedule(date)
  if (special !== null) {
    return rangesToSalonDayWindows(special)
  }

  const dayOfWeek = dayOfWeekFromDateString(date)
  const salon = await getSalonSchedule()
  return rangesToSalonDayWindows(salon.weeklyWindows[dayOfWeek] ?? [])
}

/** El salón abre ese día (respeta días especiales). */
export async function isSalonOpenOnDate(date: string): Promise<boolean> {
  return (await getSalonDayWindows(date)).length > 0
}

export async function isBookingDateAllowed(
  date: string,
  options: { forStaffPortal?: boolean } = {},
): Promise<boolean> {
  if (!isValidDateString(date)) return false
  if (!(await isSalonOpenOnDate(date))) return false
  if (!options.forStaffPortal && !isWithinSalonBookingWindow(date)) return false
  return true
}

/** Horario especial del salón para una fecha, si existe. */
export async function hasSalonSpecialSchedule(date: string): Promise<boolean> {
  return (await getSalonSpecialScheduleForDate(date)) !== null
}
