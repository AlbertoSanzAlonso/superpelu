import { randomUUID } from 'node:crypto'
import {
  addDaysToDateString,
  dayOfWeekFromDateString,
  isSalonOpenDay,
} from '../src/lib/dates.ts'
import { isStaffWorkingOnDate } from './availability.js'
import { db } from './db.js'

export type BlockScope = 'single' | 'range' | 'weekly'

/** Semanas hacia delante para bloqueos «permanentes» (mismo día cada semana). */
const WEEKS_PERMANENT = 104

export type StaffBlockRow = {
  id: string
  staff_id: string
  block_date: string
  start_time: string
  end_time: string
  note: string | null
  series_id: string | null
  scope: string | null
  created_at: string
}

export type BlockSeriesMeta = {
  blockId: string
  seriesId: string | null
  scope: BlockScope | 'legacy'
  count: number
  dates: string[]
  anchorDate: string
  startTime: string
  endTime: string
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

export function overlapsTimeRange(
  startA: number,
  endA: number,
  startB: number,
  endB: number,
): boolean {
  return startA < endB && startB < endA
}

export function getBlocksForStaffOnDate(date: string, staffId: string): StaffBlockRow[] {
  return db
    .prepare(
      `SELECT * FROM staff_time_blocks
       WHERE block_date = ? AND staff_id = ?
       ORDER BY start_time ASC`,
    )
    .all(date, staffId) as StaffBlockRow[]
}

export function getBlocksForStaffBetween(
  staffId: string,
  from: string,
  to: string,
): StaffBlockRow[] {
  return db
    .prepare(
      `SELECT * FROM staff_time_blocks
       WHERE staff_id = ? AND block_date >= ? AND block_date <= ?
       ORDER BY block_date ASC, start_time ASC`,
    )
    .all(staffId, from, to) as StaffBlockRow[]
}

export function isRangeBlockedByStaff(
  staffId: string,
  date: string,
  startMinutes: number,
  endMinutes: number,
): boolean {
  const blocks = getBlocksForStaffOnDate(date, staffId)
  return blocks.some((block) => {
    const bStart = timeToMinutes(block.start_time)
    const bEnd = timeToMinutes(block.end_time)
    return overlapsTimeRange(startMinutes, endMinutes, bStart, bEnd)
  })
}

function collectDatesForScope(
  staffId: string,
  anchorDate: string,
  scope: BlockScope,
  endDate?: string,
): string[] {
  if (scope === 'single') {
    return isStaffWorkingOnDate(staffId, anchorDate) ? [anchorDate] : []
  }

  if (scope === 'weekly') {
    const targetDow = dayOfWeekFromDateString(anchorDate)
    const dates: string[] = []
    let cursor = anchorDate
    for (let w = 0; w < WEEKS_PERMANENT; w++) {
      if (
        dayOfWeekFromDateString(cursor) === targetDow &&
        isSalonOpenDay(cursor) &&
        isStaffWorkingOnDate(staffId, cursor)
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
    if (isSalonOpenDay(cursor) && isStaffWorkingOnDate(staffId, cursor)) {
      dates.push(cursor)
    }
    cursor = addDaysToDateString(cursor, 1)
  }
  return dates
}

function assertNoOverlapOnDates(
  staffId: string,
  dates: string[],
  start: number,
  end: number,
): void {
  for (const date of dates) {
    const existing = getBlocksForStaffOnDate(date, staffId)
    if (
      existing.some((b) =>
        overlapsTimeRange(start, end, timeToMinutes(b.start_time), timeToMinutes(b.end_time)),
      )
    ) {
      throw new Error('BLOQUEO_SOLAPADO')
    }
  }
}

export type CreateBlockInput = {
  staffId: string
  date: string
  startTime: string
  endTime: string
  note?: string
  scope?: BlockScope
  endDate?: string
}

export function createStaffBlock(input: CreateBlockInput): StaffBlockRow {
  const scope = input.scope ?? 'single'
  const dates = collectDatesForScope(input.staffId, input.date, scope, input.endDate)
  if (dates.length === 0) {
    throw new Error('FECHA_INVALIDA')
  }

  const start = timeToMinutes(input.startTime)
  const end = timeToMinutes(input.endTime)
  if (end <= start) {
    throw new Error('RANGO_INVALIDO')
  }

  assertNoOverlapOnDates(input.staffId, dates, start, end)

  const seriesId = scope === 'single' ? null : randomUUID()
  const createdAt = new Date().toISOString()
  const note = input.note?.trim() || null

  const insert = db.prepare(
    `INSERT INTO staff_time_blocks (
       id, staff_id, block_date, start_time, end_time, note, series_id, scope, created_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )

  const insertMany = db.transaction((dayList: string[]) => {
    let firstId = ''
    for (const day of dayList) {
      const id = randomUUID()
      if (!firstId) firstId = id
      insert.run(
        id,
        input.staffId,
        day,
        input.startTime,
        input.endTime,
        note,
        seriesId,
        scope,
        createdAt,
      )
    }
    return firstId
  })

  const firstId = insertMany(dates)
  return db.prepare('SELECT * FROM staff_time_blocks WHERE id = ?').get(firstId) as StaffBlockRow
}

export function getBlockSeriesMeta(
  blockId: string,
  staffId?: string,
): BlockSeriesMeta | null {
  const row = db.prepare('SELECT * FROM staff_time_blocks WHERE id = ?').get(blockId) as
    | StaffBlockRow
    | undefined
  if (!row) return null
  if (staffId != null && row.staff_id !== staffId) return null

  if (!row.series_id) {
    return {
      blockId: row.id,
      seriesId: null,
      scope: 'legacy',
      count: 1,
      dates: [row.block_date],
      anchorDate: row.block_date,
      startTime: row.start_time,
      endTime: row.end_time,
    }
  }

  const siblings = db
    .prepare(
      `SELECT block_date FROM staff_time_blocks
       WHERE series_id = ?
       ORDER BY block_date ASC`,
    )
    .all(row.series_id) as { block_date: string }[]

  const scope = (row.scope as BlockScope) ?? 'single'

  return {
    blockId: row.id,
    seriesId: row.series_id,
    scope,
    count: siblings.length,
    dates: siblings.map((s) => s.block_date),
    anchorDate: siblings[0]?.block_date ?? row.block_date,
    startTime: row.start_time,
    endTime: row.end_time,
  }
}

export type DeleteBlockMode = 'single' | 'series'

export function deleteStaffBlock(blockId: string, staffId: string, mode: DeleteBlockMode = 'single'): boolean {
  const row = db
    .prepare('SELECT * FROM staff_time_blocks WHERE id = ? AND staff_id = ?')
    .get(blockId, staffId) as StaffBlockRow | undefined
  if (!row) return false

  if (mode === 'series' && row.series_id) {
    const result = db
      .prepare('DELETE FROM staff_time_blocks WHERE series_id = ? AND staff_id = ?')
      .run(row.series_id, staffId)
    return result.changes > 0
  }

  const result = db
    .prepare('DELETE FROM staff_time_blocks WHERE id = ? AND staff_id = ?')
    .run(blockId, staffId)
  return result.changes > 0
}

export function deleteStaffBlockById(blockId: string, mode: DeleteBlockMode = 'single'): boolean {
  const row = db.prepare('SELECT * FROM staff_time_blocks WHERE id = ?').get(blockId) as
    | StaffBlockRow
    | undefined
  if (!row) return false

  if (mode === 'series' && row.series_id) {
    const result = db.prepare('DELETE FROM staff_time_blocks WHERE series_id = ?').run(row.series_id)
    return result.changes > 0
  }

  const result = db.prepare('DELETE FROM staff_time_blocks WHERE id = ?').run(blockId)
  return result.changes > 0
}

export function rowBlockToPublic(row: StaffBlockRow) {
  return {
    id: row.id,
    staffId: row.staff_id,
    date: row.block_date,
    startTime: row.start_time,
    endTime: row.end_time,
    note: row.note,
    seriesId: row.series_id,
    scope: row.scope,
    createdAt: row.created_at,
  }
}
