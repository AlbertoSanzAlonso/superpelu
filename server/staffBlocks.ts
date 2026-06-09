import { randomUUID } from 'node:crypto'
import { sql, type StaffBlockRow } from '@server/db.js'
import {
  collectDatesForSeriesScope,
  type SeriesScope,
} from '@server/seriesDates.js'

export type BlockScope = SeriesScope

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

export async function getBlocksForStaffOnDate(
  date: string,
  staffId: string,
): Promise<StaffBlockRow[]> {
  return sql<StaffBlockRow[]>`
    SELECT * FROM staff_time_blocks
    WHERE block_date = ${date} AND staff_id = ${staffId}
    ORDER BY start_time ASC
  `
}

export async function getBlocksForStaffBetween(
  staffId: string,
  from: string,
  to: string,
): Promise<StaffBlockRow[]> {
  return sql<StaffBlockRow[]>`
    SELECT * FROM staff_time_blocks
    WHERE staff_id = ${staffId} AND block_date >= ${from} AND block_date <= ${to}
    ORDER BY block_date ASC, start_time ASC
  `
}

export async function isRangeBlockedByStaff(
  staffId: string,
  date: string,
  startMinutes: number,
  endMinutes: number,
): Promise<boolean> {
  const blocks = await getBlocksForStaffOnDate(date, staffId)
  return blocks.some((block) => {
    const bStart = timeToMinutes(block.start_time)
    const bEnd = timeToMinutes(block.end_time)
    return overlapsTimeRange(startMinutes, endMinutes, bStart, bEnd)
  })
}

async function assertNoOverlapOnDates(
  staffId: string,
  dates: string[],
  start: number,
  end: number,
): Promise<void> {
  for (const date of dates) {
    const existing = await getBlocksForStaffOnDate(date, staffId)
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

export async function createStaffBlock(input: CreateBlockInput): Promise<StaffBlockRow> {
  const scope = input.scope ?? 'single'
  const dates = await collectDatesForSeriesScope(input.staffId, input.date, scope, input.endDate)
  if (dates.length === 0) {
    throw new Error('FECHA_INVALIDA')
  }

  const start = timeToMinutes(input.startTime)
  const end = timeToMinutes(input.endTime)
  if (end <= start) {
    throw new Error('RANGO_INVALIDO')
  }

  await assertNoOverlapOnDates(input.staffId, dates, start, end)

  const seriesId = scope === 'single' ? null : randomUUID()
  const createdAt = new Date().toISOString()
  const note = input.note?.trim() || null

  let firstId = ''

  await sql.begin(async (tx) => {
    for (const day of dates) {
      const id = randomUUID()
      if (!firstId) firstId = id
      await tx`
        INSERT INTO staff_time_blocks (
          id, staff_id, block_date, start_time, end_time, note, series_id, scope, created_at
        ) VALUES (
          ${id}, ${input.staffId}, ${day}, ${input.startTime}, ${input.endTime},
          ${note}, ${seriesId}, ${scope}, ${createdAt}
        )
      `
    }
  })

  const rows = await sql<StaffBlockRow[]>`
    SELECT * FROM staff_time_blocks WHERE id = ${firstId}
  `
  return rows[0]!
}

export async function getBlockSeriesMeta(
  blockId: string,
  staffId?: string,
): Promise<BlockSeriesMeta | null> {
  const rows = await sql<StaffBlockRow[]>`
    SELECT * FROM staff_time_blocks WHERE id = ${blockId}
  `
  const row = rows[0]
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

  const siblings = await sql<{ block_date: string }[]>`
    SELECT block_date FROM staff_time_blocks
    WHERE series_id = ${row.series_id}
    ORDER BY block_date ASC
  `

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
export type UpdateBlockNoteMode = 'single' | 'series'

export async function updateStaffBlockNote(
  blockId: string,
  note: string | null,
  mode: UpdateBlockNoteMode = 'single',
  staffId?: string,
): Promise<StaffBlockRow | null> {
  const rows = await sql<StaffBlockRow[]>`
    SELECT * FROM staff_time_blocks WHERE id = ${blockId}
  `
  const row = rows[0]
  if (!row) return null
  if (staffId != null && row.staff_id !== staffId) return null

  const trimmed = note?.trim() || null

  if (mode === 'series' && row.series_id) {
    if (staffId != null) {
      await sql`
        UPDATE staff_time_blocks SET note = ${trimmed}
        WHERE series_id = ${row.series_id} AND staff_id = ${staffId}
      `
    } else {
      await sql`
        UPDATE staff_time_blocks SET note = ${trimmed}
        WHERE series_id = ${row.series_id}
      `
    }
  } else {
    await sql`
      UPDATE staff_time_blocks SET note = ${trimmed} WHERE id = ${blockId}
    `
  }

  const updated = await sql<StaffBlockRow[]>`
    SELECT * FROM staff_time_blocks WHERE id = ${blockId}
  `
  return updated[0] ?? null
}

export async function deleteStaffBlock(
  blockId: string,
  staffId: string,
  mode: DeleteBlockMode = 'single',
): Promise<boolean> {
  const rows = await sql<StaffBlockRow[]>`
    SELECT * FROM staff_time_blocks WHERE id = ${blockId} AND staff_id = ${staffId}
  `
  const row = rows[0]
  if (!row) return false

  if (mode === 'series' && row.series_id) {
    const result = await sql`
      DELETE FROM staff_time_blocks WHERE series_id = ${row.series_id} AND staff_id = ${staffId}
    `
    return result.count > 0
  }

  const result = await sql`
    DELETE FROM staff_time_blocks WHERE id = ${blockId} AND staff_id = ${staffId}
  `
  return result.count > 0
}

export async function deleteStaffBlockById(
  blockId: string,
  mode: DeleteBlockMode = 'single',
): Promise<boolean> {
  const rows = await sql<StaffBlockRow[]>`
    SELECT * FROM staff_time_blocks WHERE id = ${blockId}
  `
  const row = rows[0]
  if (!row) return false

  if (mode === 'series' && row.series_id) {
    const result = await sql`
      DELETE FROM staff_time_blocks WHERE series_id = ${row.series_id}
    `
    return result.count > 0
  }

  const result = await sql`DELETE FROM staff_time_blocks WHERE id = ${blockId}`
  return result.count > 0
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
