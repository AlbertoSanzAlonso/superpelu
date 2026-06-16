import type { ScheduleTimeRange } from '@/types/schedule'

export const DAY_NAMES: Record<number, string> = {
  0: 'Domingo',
  1: 'Lunes',
  2: 'Martes',
  3: 'Miércoles',
  4: 'Jueves',
  5: 'Viernes',
  6: 'Sábado',
}

export const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]

export type WeeklyWindows = Record<number, ScheduleTimeRange[]>

export function emptyWeeklyWindows(): WeeklyWindows {
  return Object.fromEntries(DAY_ORDER.map((d) => [d, []]))
}

export function cloneWindows(w: WeeklyWindows): WeeklyWindows {
  return Object.fromEntries(
    Object.entries(w).map(([day, ranges]) => [Number(day), ranges.map((r) => ({ ...r }))]),
  )
}
