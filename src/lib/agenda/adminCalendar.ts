import { salonSchedule } from '@/data/schedule'
import { nowSalonMinutes, todaySalon } from '@/lib/core/dates'
import type { WorkTimeWindow } from '@/lib/core/scheduleHours'
import type { StaffDaySchedule } from '@/types/booking'

export const CALENDAR_SLOT_HEIGHT_PX = 44
export const CALENDAR_SLOT_HEIGHT_MIN_PX = 28
export const CALENDAR_SLOT_HEIGHT_MAX_PX = 88

const AGENDA_SLOT_HEIGHT_STORAGE_KEY = 'agenda-admin-slot-height'

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
  slotHeightPx: number
  totalHeightPx: number
  timeLabels: string[]
}

export function clampCalendarSlotHeightPx(height: number): number {
  return Math.min(
    CALENDAR_SLOT_HEIGHT_MAX_PX,
    Math.max(CALENDAR_SLOT_HEIGHT_MIN_PX, Math.round(height)),
  )
}

export function readStoredCalendarSlotHeightPx(): number {
  if (typeof sessionStorage === 'undefined') return CALENDAR_SLOT_HEIGHT_PX
  try {
    const raw = sessionStorage.getItem(AGENDA_SLOT_HEIGHT_STORAGE_KEY)
    if (raw == null) return CALENDAR_SLOT_HEIGHT_PX
    const parsed = Number(raw)
    if (!Number.isFinite(parsed)) return CALENDAR_SLOT_HEIGHT_PX
    return clampCalendarSlotHeightPx(parsed)
  } catch {
    return CALENDAR_SLOT_HEIGHT_PX
  }
}

export function storeCalendarSlotHeightPx(height: number): void {
  if (typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.setItem(AGENDA_SLOT_HEIGHT_STORAGE_KEY, String(clampCalendarSlotHeightPx(height)))
  } catch {
    // ignore quota / private mode
  }
}

/**
 * Franja vertical de la agenda admin.
 * Si hay horario del salón para el día (Horarios / BD), usa min–max de esas franjas;
 * si no, cae a openTime/closeTime del catálogo (no un 10–20 fijo aparte).
 */
export function resolveCalendarDayRange(
  _schedules?: StaffDaySchedule[],
  slotHeightPx: number = CALENDAR_SLOT_HEIGHT_PX,
  salonWindows?: WorkTimeWindow[],
): CalendarDayRange {
  const slotMinutes = salonSchedule.slotMinutes
  let startMinutes = timeToMinutes(salonSchedule.openTime)
  let endMinutes = timeToMinutes(salonSchedule.closeTime)

  if (salonWindows && salonWindows.length > 0) {
    startMinutes = Math.min(...salonWindows.map((w) => timeToMinutes(w.startTime)))
    endMinutes = Math.max(...salonWindows.map((w) => timeToMinutes(w.endTime)))
  }

  startMinutes = Math.floor(startMinutes / slotMinutes) * slotMinutes
  endMinutes = Math.ceil(endMinutes / slotMinutes) * slotMinutes
  if (endMinutes <= startMinutes) {
    endMinutes = startMinutes + slotMinutes
  }

  const height = clampCalendarSlotHeightPx(slotHeightPx)
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
    slotHeightPx: height,
    totalHeightPx: slotCount * height,
    timeLabels,
  }
}

export function eventTopPx(
  startTime: string,
  range: CalendarDayRange,
  slotHeight = range.slotHeightPx,
): number {
  const offsetSlots = (timeToMinutes(startTime) - range.startMinutes) / range.slotMinutes
  return offsetSlots * slotHeight
}

export function eventHeightPx(
  durationMinutes: number,
  range: CalendarDayRange,
  slotHeight = range.slotHeightPx,
): number {
  return (durationMinutes / range.slotMinutes) * slotHeight
}

export function blockDurationMinutes(startTime: string, endTime: string): number {
  return timeToMinutes(endTime) - timeToMinutes(startTime)
}

export function currentTimeLineTopPx(
  date: string,
  range: CalendarDayRange,
  slotHeight = range.slotHeightPx,
): number | null {
  if (date !== todaySalon()) return null
  const now = nowSalonMinutes()
  if (now < range.startMinutes || now >= range.endMinutes) return null
  return ((now - range.startMinutes) / range.slotMinutes) * slotHeight
}
