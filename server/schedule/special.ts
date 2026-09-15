import { sql } from '@server/db.js'
import type { SalonSpecialScheduleRow, StaffSpecialAvailabilityRow } from '@server/pg/types.js'
import type { ScheduleTimeRange } from '@server/schedule/index.js'

export type SpecialDayEntry = {
  ranges: ScheduleTimeRange[]
  note: string
}

export type SpecialDaysMap = Record<string, SpecialDayEntry>

function rowToRange(row: { start_time: string; end_time: string; is_closed?: boolean }): ScheduleTimeRange | null {
  if (row.is_closed) return null
  return { start: row.start_time, end: row.end_time }
}

function rowsToRanges(rows: { start_time: string; end_time: string; is_closed?: boolean }[]): ScheduleTimeRange[] {
  return rows.map(rowToRange).filter((range): range is ScheduleTimeRange => range !== null)
}

/** Acepta el formato nuevo `{ ranges, note }` o el legado (array de franjas). */
export function normalizeSpecialDayEntry(value: unknown): SpecialDayEntry {
  if (Array.isArray(value)) {
    return {
      ranges: value
        .filter(
          (r): r is ScheduleTimeRange =>
            !!r && typeof r === 'object' && typeof r.start === 'string' && typeof r.end === 'string',
        )
        .map((r) => ({ start: r.start, end: r.end })),
      note: '',
    }
  }
  if (value && typeof value === 'object') {
    const obj = value as { ranges?: unknown; note?: unknown }
    const ranges = Array.isArray(obj.ranges)
      ? obj.ranges
          .filter(
            (r): r is ScheduleTimeRange =>
              !!r && typeof r === 'object' && typeof (r as ScheduleTimeRange).start === 'string' && typeof (r as ScheduleTimeRange).end === 'string',
          )
          .map((r) => ({ start: r.start, end: r.end }))
      : []
    const note = typeof obj.note === 'string' ? obj.note : ''
    return { ranges, note }
  }
  return { ranges: [], note: '' }
}

export function normalizeSpecialDaysMap(input: Record<string, unknown>): SpecialDaysMap {
  const out: SpecialDaysMap = {}
  for (const [date, value] of Object.entries(input)) {
    out[date] = normalizeSpecialDayEntry(value)
  }
  return out
}

async function persistSpecialDay(
  table: 'staff' | 'salon',
  key: { staffId?: string; date: string },
  entry: SpecialDayEntry,
): Promise<void> {
  const note = entry.note ?? ''
  const ranges = entry.ranges ?? []

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
        INSERT INTO staff_special_availability (staff_id, special_date, start_time, end_time, is_closed, note)
        VALUES (${key.staffId!}, ${key.date}, '00:00', '00:00', TRUE, ${note})
      `
    } else {
      await sql`
        INSERT INTO salon_special_schedule (special_date, start_time, end_time, is_closed, note)
        VALUES (${key.date}, '00:00', '00:00', TRUE, ${note})
      `
    }
    return
  }

  for (const range of ranges) {
    if (table === 'staff') {
      await sql`
        INSERT INTO staff_special_availability (staff_id, special_date, start_time, end_time, is_closed, note)
        VALUES (${key.staffId!}, ${key.date}, ${range.start}, ${range.end}, FALSE, ${note})
        ON CONFLICT (staff_id, special_date, start_time) DO UPDATE SET
          end_time = EXCLUDED.end_time,
          is_closed = FALSE,
          note = EXCLUDED.note
      `
    } else {
      await sql`
        INSERT INTO salon_special_schedule (special_date, start_time, end_time, is_closed, note)
        VALUES (${key.date}, ${range.start}, ${range.end}, FALSE, ${note})
        ON CONFLICT (special_date, start_time) DO UPDATE SET
          end_time = EXCLUDED.end_time,
          is_closed = FALSE,
          note = EXCLUDED.note
      `
    }
  }
}

function buildSpecialDaysMap(
  rows: { special_date: string; start_time: string; end_time: string; is_closed?: boolean; note?: string | null }[],
): SpecialDaysMap {
  const specialDays: SpecialDaysMap = {}
  const byDate = new Map<string, typeof rows>()

  for (const row of rows) {
    const list = byDate.get(row.special_date) ?? []
    list.push(row)
    byDate.set(row.special_date, list)
  }

  for (const [date, dateRows] of byDate) {
    const note = dateRows.find((row) => (row.note ?? '').trim())?.note
      ?? dateRows[0]?.note
      ?? ''
    if (dateRows.some((row) => row.is_closed)) {
      specialDays[date] = { ranges: [], note: note ?? '' }
    } else {
      specialDays[date] = { ranges: rowsToRanges(dateRows), note: note ?? '' }
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
    SELECT staff_id, special_date, start_time, end_time, is_closed, note
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
    SELECT staff_id, special_date, start_time, end_time, is_closed, note
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
  specialDays: SpecialDaysMap | Record<string, unknown>,
): Promise<SpecialDaysMap> {
  const normalized = normalizeSpecialDaysMap(specialDays as Record<string, unknown>)
  for (const [date, entry] of Object.entries(normalized)) {
    await persistSpecialDay('staff', { staffId, date }, entry)
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
    SELECT special_date, start_time, end_time, is_closed, note
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
    SELECT special_date, start_time, end_time, is_closed, note
    FROM salon_special_schedule
    WHERE special_date = ${date}
    ORDER BY start_time ASC
  `
  if (rows.length === 0) return null
  if (rows.some((row) => row.is_closed)) return []
  return rowsToRanges(rows)
}

export async function getSalonSpecialScheduleForDate(date: string): Promise<ScheduleTimeRange[] | null> {
  return resolveSalonSpecialSchedule(date)
}

export async function setSalonSpecialSchedule(
  specialDays: SpecialDaysMap | Record<string, unknown>,
): Promise<SpecialDaysMap> {
  const normalized = normalizeSpecialDaysMap(specialDays as Record<string, unknown>)
  for (const [date, entry] of Object.entries(normalized)) {
    await persistSpecialDay('salon', { date }, entry)
  }
  return getSalonSpecialSchedule()
}

export async function deleteSalonSpecialDate(date: string): Promise<void> {
  await sql`DELETE FROM salon_special_schedule WHERE special_date = ${date}`
}
