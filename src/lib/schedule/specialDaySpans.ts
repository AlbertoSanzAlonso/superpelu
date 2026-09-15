import { addDaysToDateString } from '@/lib/core/dates'
import type { ScheduleTimeRange } from '@/types/schedule'

export type SpecialDaySpan = {
  /** Clave estable para React: inicio–fin. */
  id: string
  start: string
  end: string
  dates: string[]
  ranges: ScheduleTimeRange[]
}

export function rangesEqual(a: ScheduleTimeRange[], b: ScheduleTimeRange[]): boolean {
  if (a.length !== b.length) return false
  return a.every((r, i) => r.start === b[i]!.start && r.end === b[i]!.end)
}

/** Agrupa fechas consecutivas con el mismo horario en una sola franja. */
export function groupSpecialDaySpans(
  specialDays: Record<string, ScheduleTimeRange[]>,
): SpecialDaySpan[] {
  const dates = Object.keys(specialDays).sort()
  const spans: SpecialDaySpan[] = []

  for (const date of dates) {
    const ranges = specialDays[date] ?? []
    const last = spans[spans.length - 1]
    if (
      last &&
      addDaysToDateString(last.end, 1) === date &&
      rangesEqual(last.ranges, ranges)
    ) {
      last.end = date
      last.dates.push(date)
      last.id = `${last.start}_${last.end}`
      continue
    }
    spans.push({
      id: `${date}_${date}`,
      start: date,
      end: date,
      dates: [date],
      ranges,
    })
  }

  return spans
}

export function spanIntersectsMonth(span: SpecialDaySpan, month: string): boolean {
  return span.dates.some((date) => date.startsWith(month))
}
