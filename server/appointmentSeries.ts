import { sql, type AppointmentRow } from '@server/db.js'
import type { SeriesScope } from '@server/seriesDates.js'
import { COLOR_GROUP_ROLE } from '@/lib/bookingOccupancy'

export type AppointmentSeriesMeta = {
  appointmentId: string
  seriesId: string | null
  scope: SeriesScope | 'legacy'
  count: number
  dates: string[]
  anchorDate: string
  startTime: string
  serviceName: string
  customerName: string
}

function isSeriesRootRow(row: AppointmentRow): boolean {
  return row.color_group_role == null || row.color_group_role === COLOR_GROUP_ROLE.color
}

export async function getAppointmentSeriesMeta(
  appointmentId: string,
  staffId?: string,
): Promise<AppointmentSeriesMeta | null> {
  const rows = await sql<AppointmentRow[]>`
    SELECT * FROM appointments WHERE id = ${appointmentId}
  `
  const row = rows[0]
  if (!row || !isSeriesRootRow(row)) return null
  if (staffId != null && row.staff_id !== staffId) return null

  if (!row.series_id) {
    return {
      appointmentId: row.id,
      seriesId: null,
      scope: 'legacy',
      count: 1,
      dates: [row.appointment_date],
      anchorDate: row.appointment_date,
      startTime: row.start_time,
      serviceName: row.service_name,
      customerName: row.customer_name,
    }
  }

  const siblings = await sql<{ appointment_date: string }[]>`
    SELECT appointment_date FROM appointments
    WHERE series_id = ${row.series_id}
      AND (color_group_role IS NULL OR color_group_role = ${COLOR_GROUP_ROLE.color})
    ORDER BY appointment_date ASC
  `

  const scope = (row.scope as SeriesScope) ?? 'single'

  return {
    appointmentId: row.id,
    seriesId: row.series_id,
    scope,
    count: siblings.length,
    dates: siblings.map((s) => s.appointment_date),
    anchorDate: siblings[0]?.appointment_date ?? row.appointment_date,
    startTime: row.start_time,
    serviceName: row.service_name,
    customerName: row.customer_name,
  }
}

export type AppointmentSeriesMode = 'single' | 'series'

export async function listSeriesRootAppointments(
  seriesId: string,
  staffId?: string,
): Promise<AppointmentRow[]> {
  if (staffId != null) {
    return sql<AppointmentRow[]>`
      SELECT * FROM appointments
      WHERE series_id = ${seriesId}
        AND staff_id = ${staffId}
        AND (color_group_role IS NULL OR color_group_role = ${COLOR_GROUP_ROLE.color})
      ORDER BY appointment_date ASC
    `
  }
  return sql<AppointmentRow[]>`
    SELECT * FROM appointments
    WHERE series_id = ${seriesId}
      AND (color_group_role IS NULL OR color_group_role = ${COLOR_GROUP_ROLE.color})
    ORDER BY appointment_date ASC
  `
}
