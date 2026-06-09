import {
  addDaysToDateString,
  dayOfWeekFromDateString,
  isSalonOpenDay,
} from '@/lib/dates'
import { isStaffWorkingOnDate } from '@server/availability.js'

export type SeriesScope = 'single' | 'range' | 'weekly'

/** Semanas hacia delante para series «permanentes» (mismo día cada semana). */
export const WEEKS_PERMANENT = 104

export async function collectDatesForSeriesScope(
  staffId: string,
  anchorDate: string,
  scope: SeriesScope,
  endDate?: string,
  /** Si true, el alcance semanal se detiene en `endDate` (citas periódicas). */
  weeklyRespectsEndDate = false,
): Promise<string[]> {
  if (scope === 'single') {
    return (await isStaffWorkingOnDate(staffId, anchorDate)) ? [anchorDate] : []
  }

  if (scope === 'weekly') {
    const targetDow = dayOfWeekFromDateString(anchorDate)
    const dates: string[] = []
    let cursor = anchorDate
    for (let w = 0; w < WEEKS_PERMANENT; w++) {
      if (weeklyRespectsEndDate && endDate && cursor > endDate) break
      if (
        dayOfWeekFromDateString(cursor) === targetDow &&
        isSalonOpenDay(cursor) &&
        (await isStaffWorkingOnDate(staffId, cursor))
      ) {
        dates.push(cursor)
      }
      cursor = addDaysToDateString(cursor, 7)
    }
    return dates
  }

  if (!endDate || endDate < anchorDate) {
    throw new Error('FECHA_FIN_INVALIDA')
  }

  const dates: string[] = []
  let cursor = anchorDate
  while (cursor <= endDate) {
    if (isSalonOpenDay(cursor) && (await isStaffWorkingOnDate(staffId, cursor))) {
      dates.push(cursor)
    }
    cursor = addDaysToDateString(cursor, 1)
  }
  return dates
}
