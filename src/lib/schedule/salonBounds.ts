import type { ScheduleTimeRange } from '@/types/schedule'

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function dayBounds(ranges: ScheduleTimeRange[]): { start: number; end: number } | null {
  if (ranges.length === 0) return null
  let start = Infinity
  let end = -Infinity
  for (const range of ranges) {
    start = Math.min(start, timeToMinutes(range.start))
    end = Math.max(end, timeToMinutes(range.end))
  }
  if (!Number.isFinite(start) || end <= start) return null
  return { start, end }
}

export type SalonBoundsConflict = {
  staffRanges: ScheduleTimeRange[]
  salonRanges: ScheduleTimeRange[]
  proposedSalonRanges: ScheduleTimeRange[]
  messages: string[]
}

/** Comprueba si el horario del personal excede los límites exteriores del salón. */
export function detectSalonBoundsConflict(
  staffRanges: ScheduleTimeRange[],
  salonRanges: ScheduleTimeRange[],
): SalonBoundsConflict | null {
  if (staffRanges.length === 0) return null

  const staff = dayBounds(staffRanges)
  if (!staff) return null

  if (salonRanges.length === 0) {
    return {
      staffRanges,
      salonRanges,
      proposedSalonRanges: staffRanges.map((r) => ({ ...r })),
      messages: ['El salón está cerrado ese día.'],
    }
  }

  const salon = dayBounds(salonRanges)
  if (!salon) return null

  const messages: string[] = []
  if (staff.start < salon.start) {
    messages.push(
      `empieza a las ${minutesToTime(staff.start)} y el salón abre a las ${minutesToTime(salon.start)}`,
    )
  }
  if (staff.end > salon.end) {
    messages.push(
      `termina a las ${minutesToTime(staff.end)} y el salón cierra a las ${minutesToTime(salon.end)}`,
    )
  }

  if (messages.length === 0) return null

  return {
    staffRanges,
    salonRanges,
    proposedSalonRanges: expandSalonRangesForStaff(staffRanges, salonRanges),
    messages,
  }
}

/** Amplía las franjas del salón para cubrir los límites exteriores del personal. */
export function expandSalonRangesForStaff(
  staffRanges: ScheduleTimeRange[],
  salonRanges: ScheduleTimeRange[],
): ScheduleTimeRange[] {
  if (staffRanges.length === 0) return salonRanges.map((r) => ({ ...r }))
  if (salonRanges.length === 0) return staffRanges.map((r) => ({ ...r }))

  const staff = dayBounds(staffRanges)
  if (!staff) return salonRanges.map((r) => ({ ...r }))

  const result = salonRanges.map((r) => ({ ...r }))

  if (staff.start < dayBounds(result)!.start) {
    const firstIdx = result.reduce(
      (best, range, index) =>
        timeToMinutes(range.start) < timeToMinutes(result[best].start) ? index : best,
      0,
    )
    result[firstIdx] = { ...result[firstIdx], start: minutesToTime(staff.start) }
  }

  const salonAfterStart = dayBounds(result)
  if (salonAfterStart && staff.end > salonAfterStart.end) {
    const lastIdx = result.reduce(
      (best, range, index) =>
        timeToMinutes(range.end) > timeToMinutes(result[best].end) ? index : best,
      0,
    )
    result[lastIdx] = { ...result[lastIdx], end: minutesToTime(staff.end) }
  }

  return result
}

export type WeeklySalonConflict = SalonBoundsConflict & {
  dayOfWeek: number
  dayLabel: string
}

export function detectWeeklyStaffSalonConflicts(
  staffWindows: Record<number, ScheduleTimeRange[]>,
  salonWindows: Record<number, ScheduleTimeRange[]>,
  dayLabels: Record<number, string>,
): WeeklySalonConflict[] {
  const conflicts: WeeklySalonConflict[] = []

  for (const [dayStr, staffRanges] of Object.entries(staffWindows)) {
    const dayOfWeek = Number(dayStr)
    const ranges = staffRanges ?? []
    if (ranges.length === 0) continue

    const conflict = detectSalonBoundsConflict(ranges, salonWindows[dayOfWeek] ?? [])
    if (!conflict) continue

    conflicts.push({
      ...conflict,
      dayOfWeek,
      dayLabel: dayLabels[dayOfWeek] ?? `Día ${dayOfWeek}`,
    })
  }

  return conflicts.sort((a, b) => a.dayOfWeek - b.dayOfWeek)
}

export type SpecialSalonConflict = SalonBoundsConflict & {
  date: string
  dateLabel: string
}

export function resolveSalonRangesForDate(
  date: string,
  salonWeeklyWindows: Record<number, ScheduleTimeRange[]>,
  salonSpecialDays: Record<string, ScheduleTimeRange[]>,
): ScheduleTimeRange[] {
  if (Object.prototype.hasOwnProperty.call(salonSpecialDays, date)) {
    return salonSpecialDays[date] ?? []
  }
  const dayOfWeek = new Date(`${date}T12:00:00`).getDay()
  return salonWeeklyWindows[dayOfWeek] ?? []
}

export function detectSpecialStaffSalonConflicts(
  staffSpecialDays: Record<string, ScheduleTimeRange[]>,
  salonWeeklyWindows: Record<number, ScheduleTimeRange[]>,
  salonSpecialDays: Record<string, ScheduleTimeRange[]>,
): SpecialSalonConflict[] {
  const conflicts: SpecialSalonConflict[] = []

  for (const [date, staffRanges] of Object.entries(staffSpecialDays)) {
    if ((staffRanges ?? []).length === 0) continue

    const salonRanges = resolveSalonRangesForDate(date, salonWeeklyWindows, salonSpecialDays)
    const conflict = detectSalonBoundsConflict(staffRanges, salonRanges)
    if (!conflict) continue

    const d = new Date(`${date}T12:00:00`)
    const dateLabel = d.toLocaleDateString('es-ES', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })

    conflicts.push({
      ...conflict,
      date,
      dateLabel,
    })
  }

  return conflicts.sort((a, b) => a.date.localeCompare(b.date))
}
