import { sql } from '@server/db.js'
import { salonSchedule } from '@/data/schedule'

export type ScheduleTimeRange = { start: string; end: string }

export type SalonScheduleData = {
  openDays: number[]
  openTime: string
  closeTime: string
  weeklyWindows: Record<number, ScheduleTimeRange[]>
}

export type StaffScheduleData = {
  staffId: string
  staffName: string
  weeklyWindows: Record<number, ScheduleTimeRange[]>
}

export type FullScheduleData = {
  salon: SalonScheduleData
  staff: StaffScheduleData[]
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

export async function getSalonSchedule(): Promise<SalonScheduleData> {
  const rows = await sql<{ day_of_week: number; start_time: string; end_time: string }[]>`
    SELECT day_of_week, start_time, end_time FROM salon_schedule
    ORDER BY day_of_week ASC, start_time ASC
  `

  if (rows.length === 0) {
    return {
      openDays: [...salonSchedule.openDays],
      openTime: salonSchedule.openTime,
      closeTime: salonSchedule.closeTime,
      weeklyWindows: Object.fromEntries(
        Object.entries(salonSchedule.weeklyWindows).map(([day, ranges]) => [
          Number(day),
          ranges.map((r) => ({ start: r.start, end: r.end })),
        ]),
      ),
    }
  }

  const weeklyWindows: Record<number, ScheduleTimeRange[]> = {}
  const openDaysSet = new Set<number>()

  for (const row of rows) {
    if (!weeklyWindows[row.day_of_week]) weeklyWindows[row.day_of_week] = []
    weeklyWindows[row.day_of_week].push({ start: row.start_time, end: row.end_time })
    openDaysSet.add(row.day_of_week)
  }

  let openTime: string = salonSchedule.openTime
  let closeTime: string = salonSchedule.closeTime
  for (const ranges of Object.values(weeklyWindows)) {
    for (const r of ranges) {
      if (timeToMinutes(r.start) < timeToMinutes(openTime)) openTime = r.start
      if (timeToMinutes(r.end) > timeToMinutes(closeTime)) closeTime = r.end
    }
  }

  return {
    openDays: [...openDaysSet].sort(),
    openTime,
    closeTime,
    weeklyWindows,
  }
}

export async function setSalonSchedule(
  weeklyWindows: Record<number, ScheduleTimeRange[]>,
): Promise<SalonScheduleData> {
  await sql`DELETE FROM salon_schedule`

  for (const [dayStr, ranges] of Object.entries(weeklyWindows)) {
    const day = Number(dayStr)
    if (!ranges?.length) continue
    for (const range of ranges) {
      await sql`
        INSERT INTO salon_schedule (day_of_week, start_time, end_time)
        VALUES (${day}, ${range.start}, ${range.end})
        ON CONFLICT (day_of_week, start_time) DO UPDATE SET
          end_time = EXCLUDED.end_time
      `
    }
  }

  const salon = await getSalonSchedule()
  await syncAllStaffAvailabilityFromSalon(salon.weeklyWindows)
  return salon
}

/** Copia el horario semanal del salón a todas las profesionales activas. */
export async function syncAllStaffAvailabilityFromSalon(
  weeklyWindows?: Record<number, ScheduleTimeRange[]>,
): Promise<void> {
  const windows = weeklyWindows ?? (await getSalonSchedule()).weeklyWindows
  const staffRows = await sql<{ id: string }[]>`
    SELECT id FROM staff WHERE active = TRUE
  `
  for (const row of staffRows) {
    await setStaffSchedule(row.id, windows)
  }
}

export async function getStaffSchedule(staffId: string): Promise<Record<number, ScheduleTimeRange[]>> {
  const rows = await sql<{ day_of_week: number; start_time: string; end_time: string }[]>`
    SELECT day_of_week, start_time, end_time FROM staff_availability
    WHERE staff_id = ${staffId}
    ORDER BY day_of_week ASC, start_time ASC
  `

  const weeklyWindows: Record<number, ScheduleTimeRange[]> = {}
  for (const row of rows) {
    if (!weeklyWindows[row.day_of_week]) weeklyWindows[row.day_of_week] = []
    weeklyWindows[row.day_of_week].push({ start: row.start_time, end: row.end_time })
  }
  return weeklyWindows
}

export async function setStaffSchedule(
  staffId: string,
  weeklyWindows: Record<number, ScheduleTimeRange[]>,
): Promise<Record<number, ScheduleTimeRange[]>> {
  await sql`DELETE FROM staff_availability WHERE staff_id = ${staffId}`

  for (const [dayStr, ranges] of Object.entries(weeklyWindows)) {
    const day = Number(dayStr)
    if (!ranges?.length) continue
    for (const range of ranges) {
      await sql`
        INSERT INTO staff_availability (staff_id, day_of_week, start_time, end_time)
        VALUES (${staffId}, ${day}, ${range.start}, ${range.end})
        ON CONFLICT (staff_id, day_of_week, start_time) DO UPDATE SET
          end_time = EXCLUDED.end_time
      `
    }
  }

  return getStaffSchedule(staffId)
}

export async function getFullSchedule(): Promise<FullScheduleData> {
  const salon = await getSalonSchedule()

  const staffRows = await sql<{ id: string; name: string }[]>`
    SELECT id, name FROM staff WHERE active = TRUE ORDER BY sort_order ASC, name ASC
  `

  const staff: StaffScheduleData[] = []
  for (const row of staffRows) {
    const windows = await getStaffSchedule(row.id)
    staff.push({ staffId: row.id, staffName: row.name, weeklyWindows: windows })
  }

  return { salon, staff }
}

export async function seedSalonScheduleIfMissing(): Promise<void> {
  const [{ count }] = await sql<{ count: string }[]>`
    SELECT COUNT(*)::text AS count FROM salon_schedule
  `
  if (Number(count) > 0) return

  for (const [dayStr, ranges] of Object.entries(salonSchedule.weeklyWindows)) {
    const day = Number(dayStr)
    for (const range of ranges) {
      await sql`
        INSERT INTO salon_schedule (day_of_week, start_time, end_time)
        VALUES (${day}, ${range.start}, ${range.end})
      `
    }
  }
}
