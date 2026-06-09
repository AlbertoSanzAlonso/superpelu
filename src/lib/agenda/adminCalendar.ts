import { salonSchedule } from '@/data/schedule'
import { nowSalonMinutes, todaySalon } from '@/lib/core/dates'
import type { StaffDaySchedule } from '@/types/booking'

export const CALENDAR_SLOT_HEIGHT_PX = 44

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export type CalendarDayRange = {
  startMinutes: number
  endMinutes: number
  slotMinutes: number
  slotCount: number
  totalHeightPx: number
  timeLabels: string[]
}

const SALON_DAY_START = '10:00'
const SALON_DAY_END = '20:00'

/** Franja fija del salón (10:00–20:00) para la vista admin. */
export function resolveCalendarDayRange(_schedules?: StaffDaySchedule[]): CalendarDayRange {
  const slotMinutes = salonSchedule.slotMinutes
  const startMinutes = timeToMinutes(SALON_DAY_START)
  const endMinutes = timeToMinutes(SALON_DAY_END)

  const slotCount = (endMinutes - startMinutes) / slotMinutes
  const timeLabels: string[] = []
  for (let m = startMinutes; m < endMinutes; m += slotMinutes) {
    timeLabels.push(minutesToTime(m))
  }

  return {
    startMinutes,
    endMinutes,
    slotMinutes,
    slotCount,
    totalHeightPx: slotCount * CALENDAR_SLOT_HEIGHT_PX,
    timeLabels,
  }
}

export function eventTopPx(
  startTime: string,
  range: CalendarDayRange,
  slotHeight = CALENDAR_SLOT_HEIGHT_PX,
): number {
  const offsetSlots = (timeToMinutes(startTime) - range.startMinutes) / range.slotMinutes
  return offsetSlots * slotHeight
}

export function eventHeightPx(
  durationMinutes: number,
  range: CalendarDayRange,
  slotHeight = CALENDAR_SLOT_HEIGHT_PX,
): number {
  return (durationMinutes / range.slotMinutes) * slotHeight
}

export function blockDurationMinutes(startTime: string, endTime: string): number {
  return timeToMinutes(endTime) - timeToMinutes(startTime)
}

export function currentTimeLineTopPx(
  date: string,
  range: CalendarDayRange,
  slotHeight = CALENDAR_SLOT_HEIGHT_PX,
): number | null {
  if (date !== todaySalon()) return null
  const now = nowSalonMinutes()
  if (now < range.startMinutes || now >= range.endMinutes) return null
  return ((now - range.startMinutes) / range.slotMinutes) * slotHeight
}
