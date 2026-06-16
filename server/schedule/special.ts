import { sql } from '@server/db.js'
import type { StaffSpecialAvailabilityRow } from '@server/pg/types.js'
import type { ScheduleTimeRange } from '@server/schedule/index.js'

export type SpecialDaysMap = Record<string, ScheduleTimeRange[]>

function rowToRange(row: StaffSpecialAvailabilityRow): ScheduleTimeRange {
  return { start: row.start_time, end: row.end_time }
}

export async function getStaffSpecialSchedule(
  staffId: string,
  dateFrom?: string,
  dateTo?: string,
): Promise<SpecialDaysMap> {
  const rows = await sql<StaffSpecialAvailabilityRow[]>`
    SELECT staff_id, special_date, start_time, end_time
    FROM staff_special_availability
    WHERE staff_id = ${staffId}
    ${dateFrom ? sql` AND special_date >= ${dateFrom}` : sql``}
    ${dateTo ? sql` AND special_date <= ${dateTo}` : sql``}
    ORDER BY special_date ASC, start_time ASC
  `

  const specialDays: SpecialDaysMap = {}
  for (const row of rows) {
    if (!specialDays[row.special_date]) specialDays[row.special_date] = []
    specialDays[row.special_date].push(rowToRange(row))
  }
  return specialDays
}

export async function getSpecialScheduleForDate(
  staffId: string,
  date: string,
): Promise<ScheduleTimeRange[]> {
  const rows = await sql<StaffSpecialAvailabilityRow[]>`
    SELECT staff_id, special_date, start_time, end_time
    FROM staff_special_availability
    WHERE staff_id = ${staffId} AND special_date = ${date}
    ORDER BY start_time ASC
  `
  return rows.map(rowToRange)
}

export async function setStaffSpecialSchedule(
  staffId: string,
  specialDays: SpecialDaysMap,
): Promise<SpecialDaysMap> {
  const dates = Object.keys(specialDays)
  if (dates.length === 0) return specialDays

  for (const date of dates) {
    await sql`
      DELETE FROM staff_special_availability
      WHERE staff_id = ${staffId} AND special_date = ${date}
    `
  }

  for (const [date, ranges] of Object.entries(specialDays)) {
    if (!ranges?.length) continue
    for (const range of ranges) {
      await sql`
        INSERT INTO staff_special_availability (staff_id, special_date, start_time, end_time)
        VALUES (${staffId}, ${date}, ${range.start}, ${range.end})
        ON CONFLICT (staff_id, special_date, start_time) DO UPDATE SET
          end_time = EXCLUDED.end_time
      `
    }
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
