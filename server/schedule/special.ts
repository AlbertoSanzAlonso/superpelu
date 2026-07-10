import { sql } from '@server/db.js'
import type { SalonSpecialScheduleRow, StaffSpecialAvailabilityRow } from '@server/pg/types.js'
import type { ScheduleTimeRange } from '@server/schedule/index.js'

export type SpecialDaysMap = Record<string, ScheduleTimeRange[]>

function rowToRange(row: { start_time: string; end_time: string; is_closed?: boolean }): ScheduleTimeRange | null {
  if (row.is_closed) return null
  return { start: row.start_time, end: row.end_time }
}

function rowsToRanges(rows: { start_time: string; end_time: string; is_closed?: boolean }[]): ScheduleTimeRange[] {
  return rows.map(rowToRange).filter((range): range is ScheduleTimeRange => range !== null)
}

async function persistSpecialDay(
  table: 'staff' | 'salon',
  key: { staffId?: string; date: string },
  ranges: ScheduleTimeRange[],
): Promise<void> {
  if (table === 'staff') {
    await sql`
      DELETE FROM staff_special_availability
      WHERE staff_id = ${key.staffId!} AND special_date = ${key.date}
    `
  } else {
    await sql`DELETE FROM salon_special_schedule WHERE special_date = ${key.date}`
  }

  if (!ranges.length) {
    if (table === 'staff') {
      await sql`
        INSERT INTO staff_special_availability (staff_id, special_date, start_time, end_time, is_closed)
        VALUES (${key.staffId!}, ${key.date}, '00:00', '00:00', TRUE)
      `
    } else {
      await sql`
        INSERT INTO salon_special_schedule (special_date, start_time, end_time, is_closed)
        VALUES (${key.date}, '00:00', '00:00', TRUE)
      `
    }
    return
  }

  for (const range of ranges) {
    if (table === 'staff') {
      await sql`
        INSERT INTO staff_special_availability (staff_id, special_date, start_time, end_time, is_closed)
        VALUES (${key.staffId!}, ${key.date}, ${range.start}, ${range.end}, FALSE)
        ON CONFLICT (staff_id, special_date, start_time) DO UPDATE SET
          end_time = EXCLUDED.end_time,
          is_closed = FALSE
      `
    } else {
      await sql`
        INSERT INTO salon_special_schedule (special_date, start_time, end_time, is_closed)
        VALUES (${key.date}, ${range.start}, ${range.end}, FALSE)
        ON CONFLICT (special_date, start_time) DO UPDATE SET
          end_time = EXCLUDED.end_time,
          is_closed = FALSE
      `
    }
  }
}

function buildSpecialDaysMap(
  rows: { special_date: string; start_time: string; end_time: string; is_closed?: boolean }[],
): SpecialDaysMap {
  const specialDays: SpecialDaysMap = {}
  const byDate = new Map<string, typeof rows>()

  for (const row of rows) {
    const list = byDate.get(row.special_date) ?? []
    list.push(row)
    byDate.set(row.special_date, list)
  }

  for (const [date, dateRows] of byDate) {
    if (dateRows.some((row) => row.is_closed)) {
      specialDays[date] = []
    } else {
      specialDays[date] = rowsToRanges(dateRows)
    }
  }

  return specialDays
}

export async function getStaffSpecialSchedule(
  staffId: string,
  dateFrom?: string,
  dateTo?: string,
): Promise<SpecialDaysMap> {
  const rows = await sql<StaffSpecialAvailabilityRow[]>`
    SELECT staff_id, special_date, start_time, end_time, is_closed
    FROM staff_special_availability
    WHERE staff_id = ${staffId}
    ${dateFrom ? sql` AND special_date >= ${dateFrom}` : sql``}
    ${dateTo ? sql` AND special_date <= ${dateTo}` : sql``}
    ORDER BY special_date ASC, start_time ASC
  `

  return buildSpecialDaysMap(rows)
}

export async function resolveStaffSpecialSchedule(
  staffId: string,
  date: string,
): Promise<ScheduleTimeRange[] | null> {
  const rows = await sql<StaffSpecialAvailabilityRow[]>`
    SELECT staff_id, special_date, start_time, end_time, is_closed
    FROM staff_special_availability
    WHERE staff_id = ${staffId} AND special_date = ${date}
    ORDER BY start_time ASC
  `
  if (rows.length === 0) return null
  if (rows.some((row) => row.is_closed)) return []
  return rowsToRanges(rows)
}

export async function getSpecialScheduleForDate(
  staffId: string,
  date: string,
): Promise<ScheduleTimeRange[]> {
  const resolved = await resolveStaffSpecialSchedule(staffId, date)
  return resolved ?? []
}

export async function setStaffSpecialSchedule(
  staffId: string,
  specialDays: SpecialDaysMap,
): Promise<SpecialDaysMap> {
  for (const [date, ranges] of Object.entries(specialDays)) {
    await persistSpecialDay('staff', { staffId, date }, ranges ?? [])
  }
  return getStaffSpecialSchedule(staffId)
}

export async function deleteStaffSpecialDate(
  staffId: string,
  date: string,
): Promise<void> {
  await sql`
    DELETE FROM staff_special_availability
    WHERE staff_id = ${staffId} AND special_date = ${date}
  `
}

export async function getSalonSpecialSchedule(
  dateFrom?: string,
  dateTo?: string,
): Promise<SpecialDaysMap> {
  const rows = await sql<SalonSpecialScheduleRow[]>`
    SELECT special_date, start_time, end_time, is_closed
    FROM salon_special_schedule
    WHERE 1 = 1
    ${dateFrom ? sql` AND special_date >= ${dateFrom}` : sql``}
    ${dateTo ? sql` AND special_date <= ${dateTo}` : sql``}
    ORDER BY special_date ASC, start_time ASC
  `

  return buildSpecialDaysMap(rows)
}

export async function resolveSalonSpecialSchedule(date: string): Promise<ScheduleTimeRange[] | null> {
  const rows = await sql<SalonSpecialScheduleRow[]>`
    SELECT special_date, start_time, end_time, is_closed
    FROM salon_special_schedule
    WHERE special_date = ${date}
    ORDER BY start_time ASC
  `
  if (rows.length === 0) return null
  if (rows.some((row) => row.is_closed)) return []
  return rowsToRanges(rows)
}

export async function getSalonSpecialScheduleForDate(date: string): Promise<SpecialDaysMap[string] | null> {
  const resolved = await resolveSalonSpecialSchedule(date)
  if (resolved === null) return null
  return resolved
}

export async function setSalonSpecialSchedule(specialDays: SpecialDaysMap): Promise<SpecialDaysMap> {
  for (const [date, ranges] of Object.entries(specialDays)) {
    await persistSpecialDay('salon', { date }, ranges ?? [])
  }
  return getSalonSpecialSchedule()
}

export async function deleteSalonSpecialDate(date: string): Promise<void> {
  await sql`DELETE FROM salon_special_schedule WHERE special_date = ${date}`
}
