import { randomUUID } from 'node:crypto'
import { sql, type AppointmentRow } from '@server/db.js'
import type { DbClient } from '@server/bookingLock.js'
import { getService } from '@server/services.js'
import { serviceDisplayName } from '@/i18n/localeHelpers'
import type { Locale } from '@/i18n/types'
import {
  COLOR_GROUP_ROLE,
  COLOR_SPLIT_SEGMENT_MINUTES,
  getWashPhaseStartMinutes,
  usesColorSplitBooking,
  WASH_COLOR_SERVICE_ID,
} from '@/lib/bookingOccupancy'

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

export async function getAppointmentsInColorGroup(
  colorGroupId: string,
): Promise<AppointmentRow[]> {
  return sql<AppointmentRow[]>`
    SELECT * FROM appointments
    WHERE color_group_id = ${colorGroupId}
    ORDER BY start_time ASC
  `
}

export async function getColorGroupWashRow(
  colorGroupId: string,
): Promise<AppointmentRow | undefined> {
  const rows = await sql<AppointmentRow[]>`
    SELECT * FROM appointments
    WHERE color_group_id = ${colorGroupId} AND color_group_role = ${COLOR_GROUP_ROLE.wash}
    LIMIT 1
  `
  return rows[0]
}

export type InsertColorGroupParams = {
  groupId: string
  colorId: string
  washId: string
  staffId: string
  staffName: string
  colorServiceId: string
  colorServiceName: string
  washServiceName: string
  date: string
  colorStartTime: string
  durationMinutes: number
  customerName: string
  customerPhone: string
  customerEmail: string | null
  notes: string | null
  createdAt: string
  reminderSentAt: string | null
  locale: Locale
  bookingGroupId?: string | null
}

export async function insertColorBookingGroup(
  params: InsertColorGroupParams,
  query: DbClient = sql,
): Promise<void> {
  const washStartMinutes = getWashPhaseStartMinutes(timeToMinutes(params.colorStartTime))
  const washStartTime = minutesToTime(washStartMinutes)

  await query`
    INSERT INTO appointments (
      id, staff_id, staff_name, service_id, service_name, duration_minutes,
      appointment_date, start_time,
      customer_name, customer_phone, customer_email, notes,
      status, created_at, reminder_sent_at, locale,
      color_group_id, color_group_role, booking_group_id
    ) VALUES (
      ${params.colorId}, ${params.staffId}, ${params.staffName},
      ${params.colorServiceId}, ${params.colorServiceName}, ${COLOR_SPLIT_SEGMENT_MINUTES},
      ${params.date}, ${params.colorStartTime},
      ${params.customerName}, ${params.customerPhone}, ${params.customerEmail}, ${params.notes},
      'confirmed', ${params.createdAt}, ${params.reminderSentAt}, ${params.locale},
      ${params.groupId}, ${COLOR_GROUP_ROLE.color}, ${params.bookingGroupId ?? null}
    )
  `

  await query`
    INSERT INTO appointments (
      id, staff_id, staff_name, service_id, service_name, duration_minutes,
      appointment_date, start_time,
      customer_name, customer_phone, customer_email, notes,
      status, created_at, reminder_sent_at, locale,
      color_group_id, color_group_role, booking_group_id
    ) VALUES (
      ${params.washId}, ${params.staffId}, ${params.staffName},
      ${WASH_COLOR_SERVICE_ID}, ${params.washServiceName}, ${COLOR_SPLIT_SEGMENT_MINUTES},
      ${params.date}, ${washStartTime},
      ${params.customerName}, ${params.customerPhone}, ${params.customerEmail}, ${params.notes},
      'confirmed', ${params.createdAt}, ${params.reminderSentAt}, ${params.locale},
      ${params.groupId}, ${COLOR_GROUP_ROLE.wash}, ${params.bookingGroupId ?? null}
    )
  `
}

export async function prepareColorBookingGroupIds(
  serviceId: string,
): Promise<{ groupId: string; colorId: string; washId: string } | null> {
  if (!usesColorSplitBooking(serviceId)) return null
  return {
    groupId: randomUUID(),
    colorId: randomUUID(),
    washId: randomUUID(),
  }
}

export async function resolveWashServiceName(locale: Locale): Promise<string> {
  const wash = await getService(WASH_COLOR_SERVICE_ID, { onlineOnly: false })
  if (!wash) return 'LAVAR COLOR'
  return serviceDisplayName(wash, locale)
}
