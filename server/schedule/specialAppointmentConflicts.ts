import { sql, type AppointmentRow } from '@server/db.js'
import { parseBookingPattern } from '@/lib/booking/servicePattern'
import {
  getOccupiedSegmentsForAppointment,
  type OccupiedSegment,
} from '@/lib/booking/occupancy'
import { segmentFitsInWorkWindows, type WorkTimeWindow } from '@/lib/core/scheduleHours'
import { isBookingUnavailable } from '@server/appointments/booking.js'
import { minutesToTime, timeToMinutes } from '@server/appointments/time.js'
import { listStaffForService } from '@server/staff/index.js'
import { updateAppointmentForStaff } from '@server/appointments/update.js'
import {
  normalizeSpecialDayEntry,
  type SpecialDayEntry,
  type SpecialDaysMap,
} from '@server/schedule/special.js'

export type SpecialAppointmentConflict = {
  appointmentId: string
  date: string
  startTime: string
  endTime: string
  customerName: string
  serviceId: string
  serviceName: string
  canAutoReassign: boolean
  suggestedStaffId: string | null
  suggestedStaffName: string | null
}

function rangesToWorkWindows(ranges: { start: string; end: string }[]): WorkTimeWindow[] {
  return ranges.map((r) => ({ startTime: r.start, endTime: r.end }))
}

function segmentsFitInRanges(
  segments: OccupiedSegment[],
  ranges: { start: string; end: string }[],
): boolean {
  if (ranges.length === 0) return false
  const windows = rangesToWorkWindows(ranges)
  return segments.every((segment) =>
    segmentFitsInWorkWindows(segment.startMinutes, segment.durationMinutes, windows),
  )
}

function appointmentSegments(row: AppointmentRow & { booking_pattern?: unknown | null }): OccupiedSegment[] {
  return getOccupiedSegmentsForAppointment(
    row.service_id,
    timeToMinutes(row.start_time),
    row.duration_minutes,
    {
      colorGroupRole: row.color_group_role,
      bookingPattern: parseBookingPattern(row.booking_pattern ?? null),
    },
  )
}

function appointmentEndTime(row: AppointmentRow & { booking_pattern?: unknown | null }): string {
  const segments = appointmentSegments(row)
  if (segments.length === 0) {
    return minutesToTime(timeToMinutes(row.start_time) + row.duration_minutes)
  }
  const end = Math.max(...segments.map((s) => s.startMinutes + s.durationMinutes))
  return minutesToTime(end)
}

async function findReassignmentTarget(
  row: AppointmentRow & { booking_pattern?: unknown | null },
  fromStaffId: string,
): Promise<{ id: string; name: string } | null> {
  const candidates = (await listStaffForService(row.service_id)).filter((c) => c.id !== fromStaffId)
  const segments = appointmentSegments(row)
  for (const candidate of candidates) {
    const unavailable = await isBookingUnavailable(
      sql,
      candidate.id,
      row.appointment_date,
      segments,
      row.id,
      false,
      false,
    )
    if (!unavailable) {
      return { id: candidate.id, name: candidate.name }
    }
  }
  return null
}

/**
 * Citas del profesional que no caben en el horario especial propuesto
 * (solo fechas indicadas, p. ej. las que cambiaron de franjas).
 */
export async function findStaffSpecialAppointmentConflicts(
  staffId: string,
  proposedSpecialDays: SpecialDaysMap | Record<string, unknown>,
  datesToCheck: string[],
): Promise<SpecialAppointmentConflict[]> {
  const dates = [...new Set(datesToCheck)].filter(Boolean).sort()
  if (dates.length === 0) return []

  const normalized: SpecialDaysMap = {}
  for (const date of dates) {
    const raw = (proposedSpecialDays as Record<string, unknown>)[date]
    if (raw === undefined) continue
    normalized[date] = normalizeSpecialDayEntry(raw)
  }
  if (Object.keys(normalized).length === 0) return []

  const from = dates[0]!
  const to = dates[dates.length - 1]!
  const rows = await sql<(AppointmentRow & { booking_pattern: unknown | null })[]>`
    SELECT a.*, s.booking_pattern
    FROM appointments a
    LEFT JOIN services s ON s.id = a.service_id
    WHERE a.staff_id = ${staffId}
      AND a.appointment_date >= ${from}
      AND a.appointment_date <= ${to}
      AND a.status NOT IN ('cancelled', 'no_show')
    ORDER BY a.appointment_date ASC, a.start_time ASC, a.id ASC
  `

  const conflicts: SpecialAppointmentConflict[] = []
  for (const row of rows) {
    const entry = normalized[row.appointment_date] as SpecialDayEntry | undefined
    if (!entry) continue
    const segments = appointmentSegments(row)
    if (segmentsFitInRanges(segments, entry.ranges)) continue

    const target = await findReassignmentTarget(row, staffId)
    conflicts.push({
      appointmentId: row.id,
      date: row.appointment_date,
      startTime: row.start_time,
      endTime: appointmentEndTime(row),
      customerName: row.customer_name,
      serviceId: row.service_id,
      serviceName: row.service_name,
      canAutoReassign: Boolean(target),
      suggestedStaffId: target?.id ?? null,
      suggestedStaffName: target?.name ?? null,
    })
  }

  return conflicts
}

export type AutoReassignResult = {
  reassigned: { appointmentId: string; staffId: string; staffName: string }[]
  failed: { appointmentId: string; reason: string }[]
}

/** Reasigna citas en conflicto al profesional sugerido (si sigue libre). */
export async function autoReassignSpecialAppointmentConflicts(
  fromStaffId: string,
  appointmentIds: string[],
): Promise<AutoReassignResult> {
  const reassigned: AutoReassignResult['reassigned'] = []
  const failed: AutoReassignResult['failed'] = []

  for (const appointmentId of appointmentIds) {
    const rows = await sql<(AppointmentRow & { booking_pattern: unknown | null })[]>`
      SELECT a.*, s.booking_pattern
      FROM appointments a
      LEFT JOIN services s ON s.id = a.service_id
      WHERE a.id = ${appointmentId}
    `
    const row = rows[0]
    if (!row || row.staff_id !== fromStaffId || row.status === 'cancelled' || row.status === 'no_show') {
      failed.push({ appointmentId, reason: 'Cita no encontrada o ya reasignada' })
      continue
    }

    const target = await findReassignmentTarget(row, fromStaffId)
    if (!target) {
      failed.push({ appointmentId, reason: 'No hay profesional libre que pueda hacer el servicio' })
      continue
    }

    try {
      await updateAppointmentForStaff(appointmentId, fromStaffId, {
        staffId: target.id,
        date: row.appointment_date,
        startTime: row.start_time,
      })
      reassigned.push({
        appointmentId,
        staffId: target.id,
        staffName: target.name,
      })
    } catch (err) {
      failed.push({
        appointmentId,
        reason: err instanceof Error ? err.message : 'No se pudo reasignar',
      })
    }
  }

  return { reassigned, failed }
}
