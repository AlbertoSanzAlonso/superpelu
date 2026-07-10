import { sql, type AppointmentRow } from "@server/db.js"
import { getService } from "@server/catalog/services.js"
import { isStaffWorkingOnDate } from "@server/staff/availability.js"
import { getStaff, staffCanPerformService } from "@server/staff/index.js"
import {
  notifyAppointmentCancelled,
  notifyAppointmentNoShow,
  notifyAppointmentRescheduled,
} from "@server/notifications/whatsapp.js"
import {
  notifyAdminAppointmentCancelled,
  notifyAdminAppointmentUpdated,
} from "@server/notifications/email.js"
import {
  hoursUntilAppointment,
} from "@/lib/core/dates"
import { isBookingDateAllowed } from "@server/schedule/salonDay.js"
import {
  appointmentOccupiedSlots,
  COLOR_GROUP_ROLE,
  getCustomerFacingDurationMinutes,
  getOccupiedSegmentsForBooking,
  getWashPhaseStartMinutes,
  isColorGroupColorRow,
  isColorGroupWashRow,
} from "@/lib/booking/occupancy"
import { parseBookingPattern } from "@/lib/booking/servicePattern"
import { lockStaffDaysForBooking } from "@server/appointments/lock.js"
import {
  listSeriesRootAppointments,
  type AppointmentSeriesMode,
} from "@server/appointments/series.js"
import {
  getAppointmentById,
  getAppointmentsByBookingGroup,
} from "@server/appointments/queries.js"
import {
  assertBookingAvailable,
  getAvailableSlots,
} from "@server/appointments/booking.js"
import { isValidDateString, minutesToTime, timeToMinutes } from "@server/appointments/time.js"

async function deleteAppointmentsInColorGroup(
  existing: AppointmentRow,
): Promise<{ deleted: boolean }> {
  if (!existing.color_group_id) return { deleted: false }
  const result = await sql`
    DELETE FROM appointments WHERE color_group_id = ${existing.color_group_id}
  `
  return { deleted: result.count > 0 }
}

export async function deleteAppointmentForStaff(
  appointmentId: string,
  staffId: string,
  mode: AppointmentSeriesMode = 'single',
): Promise<boolean> {
  const existing = await getAppointmentById(appointmentId)
  if (!existing || existing.staff_id !== staffId) return false

  if (mode === 'group' && existing.booking_group_id) {
    const siblings = await getAppointmentsByBookingGroup(existing.booking_group_id)
    const toDelete = siblings.filter((r) => !isColorGroupWashRow(r.color_group_role))
    if (toDelete.length === 0) return false
    const ids = toDelete.map((r) => r.id)
    await sql`DELETE FROM appointments WHERE id = ANY(${ids}::text[])`
    if (existing.status !== 'cancelled') {
      void notifyAdminAppointmentCancelled(existing)
      void notifyAppointmentCancelled(existing).catch((err) => {
        console.error('Superpelu WhatsApp (visita eliminada):', err)
      })
    }
    return true
  }

  if (mode === 'series' && existing.series_id) {
    const result = await sql`
      DELETE FROM appointments
      WHERE series_id = ${existing.series_id} AND staff_id = ${staffId}
    `
    if (result.count > 0 && existing.status !== 'cancelled') {
      void notifyAdminAppointmentCancelled(existing)
      void notifyAppointmentCancelled(existing).catch((err) => {
        console.error('Superpelu WhatsApp (cita cancelada):', err)
      })
    }
    return result.count > 0
  }

  if (existing.color_group_id) {
    const { deleted } = await deleteAppointmentsInColorGroup(existing)
    if (deleted && existing.status !== 'cancelled') {
      void notifyAdminAppointmentCancelled(existing)
      void notifyAppointmentCancelled(existing).catch((err) => {
        console.error('Superpelu WhatsApp (cita cancelada):', err)
      })
    }
    return deleted
  }

  const result = await sql`
    DELETE FROM appointments WHERE id = ${appointmentId} AND staff_id = ${staffId}
  `
  if (result.count > 0 && existing.status !== 'cancelled') {
    void notifyAdminAppointmentCancelled(existing)
    void notifyAppointmentCancelled(existing).catch((err) => {
      console.error('Superpelu WhatsApp (cita cancelada):', err)
    })
  }
  return result.count > 0
}

export async function rescheduleAppointmentByCustomer(
  appointmentId: string,
  input: { date: string; startTime: string; staffId?: string },
  options?: { notifyCustomer?: boolean },
): Promise<AppointmentRow> {
  const existing = await getAppointmentById(appointmentId)
  if (!existing || existing.status === 'cancelled' || existing.status === 'no_show') {
    throw new Error('CITA_NO_ENCONTRADA')
  }

  const serviceId = existing.service_id
  const staffId = input.staffId ?? existing.staff_id
  if (!staffId) throw new Error('CITA_NO_ENCONTRADA')

  const service = await getService(serviceId, { onlineOnly: false })
  if (!service) throw new Error('SERVICIO_INVALIDO')

  const staff = await getStaff(staffId)
  if (!staff || !staff.active) throw new Error('STAFF_INVALIDO')

  if (!(await staffCanPerformService(staffId, serviceId))) {
    throw new Error('STAFF_NO_REALIZA_SERVICIO')
  }

  const { date, startTime } = input

  if (
    !isValidDateString(date) ||
    !(await isBookingDateAllowed(date)) ||
    !(await isStaffWorkingOnDate(staffId, date))
  ) {
    throw new Error('FECHA_INVALIDA')
  }

  const appointmentDuration = existing.duration_minutes

  const slots = await getAvailableSlots(date, serviceId, staffId, {
    excludeAppointmentId: appointmentId,
    serviceDurations: [appointmentDuration],
  })
  if (!slots.includes(startTime)) throw new Error('HORARIO_NO_DISPONIBLE')

  const scheduleChanged =
    date !== existing.appointment_date ||
    startTime !== existing.start_time ||
    staffId !== existing.staff_id
  const reminderSentAt = scheduleChanged
    ? hoursUntilAppointment(date, startTime) <= 24
      ? new Date().toISOString()
      : null
    : existing.reminder_sent_at

  const startMinutes = timeToMinutes(startTime)
  const bookingSegments =
    existing.color_group_id && isColorGroupColorRow(existing.color_group_role)
      ? getOccupiedSegmentsForBooking(service.id, startMinutes, appointmentDuration, {
          bookingPattern: service.bookingPattern,
        })
      : [
          {
            startMinutes,
            durationMinutes: appointmentDuration,
          },
        ]

  const lockKeys: Array<{ staffId: string; date: string }> = [{ staffId, date }]
  if (existing.staff_id && (existing.staff_id !== staffId || existing.appointment_date !== date)) {
    lockKeys.push({ staffId: existing.staff_id, date: existing.appointment_date })
  }

  await sql.begin(async (tx) => {
    await lockStaffDaysForBooking(tx, lockKeys)
    await assertBookingAvailable(tx, staffId, date, bookingSegments, appointmentId)

    if (existing.color_group_id && isColorGroupColorRow(existing.color_group_role)) {
      const washStart = minutesToTime(getWashPhaseStartMinutes(startMinutes))
      await tx`
        UPDATE appointments SET
          staff_id = ${staffId},
          staff_name = ${staff.name},
          appointment_date = ${date},
          start_time = ${startTime},
          reminder_sent_at = ${reminderSentAt}
        WHERE id = ${appointmentId}
      `
      await tx`
        UPDATE appointments SET
          staff_id = ${staffId},
          staff_name = ${staff.name},
          appointment_date = ${date},
          start_time = ${washStart},
          reminder_sent_at = ${reminderSentAt}
        WHERE color_group_id = ${existing.color_group_id}
          AND color_group_role = ${COLOR_GROUP_ROLE.wash}
      `
    } else {
      await tx`
        UPDATE appointments SET
          staff_id = ${staffId},
          staff_name = ${staff.name},
          duration_minutes = ${appointmentDuration},
          appointment_date = ${date},
          start_time = ${startTime},
          reminder_sent_at = ${reminderSentAt}
        WHERE id = ${appointmentId}
      `
    }
  })

  const row = (await getAppointmentById(appointmentId))!
  if (scheduleChanged) {
    if (options?.notifyCustomer !== false) {
      void notifyAppointmentRescheduled(row).catch((err) => {
        console.error('Superpelu WhatsApp (cita reprogramada):', err)
      })
    }
    void notifyAdminAppointmentUpdated(existing, row)
  }
  return row
}

/** Borrado definitivo (admin). No envía avisos. */
export async function deleteAppointmentById(
  appointmentId: string,
  mode: AppointmentSeriesMode = 'single',
): Promise<boolean> {
  const existing = await getAppointmentById(appointmentId)
  if (!existing) return false

  if (mode === 'series' && existing.series_id) {
    const result = await sql`
      DELETE FROM appointments WHERE series_id = ${existing.series_id}
    `
    return result.count > 0
  }

  if (existing.color_group_id) {
    const { deleted } = await deleteAppointmentsInColorGroup(existing)
    return deleted
  }
  const result = await sql`DELETE FROM appointments WHERE id = ${appointmentId}`
  return result.count > 0
}

async function cancelSingleOccurrence(
  existing: AppointmentRow,
  options?: { notifyCustomer?: boolean; notifyAdmin?: boolean },
): Promise<AppointmentRow | undefined> {
  const wasCancelled = existing.status === 'cancelled'
  if (existing.color_group_id) {
    await sql`
      UPDATE appointments SET status = 'cancelled', reminder_sent_at = now()
      WHERE color_group_id = ${existing.color_group_id}
    `
  } else {
    await sql`
      UPDATE appointments SET status = 'cancelled', reminder_sent_at = now()
      WHERE id = ${existing.id}
    `
  }
  const row = await getAppointmentById(existing.id)
  if (row && !wasCancelled) {
    if (options?.notifyAdmin !== false) {
      void notifyAdminAppointmentCancelled(row)
    }
    if (options?.notifyCustomer) {
      void notifyAppointmentCancelled(existing).catch((err) => {
        console.error('Superpelu WhatsApp (cita cancelada):', err)
      })
    }
  }
  return row
}

async function cancelAppointmentSeries(
  existing: AppointmentRow,
  options?: { notifyCustomer?: boolean; notifyAdmin?: boolean; staffId?: string },
): Promise<AppointmentRow | undefined> {
  if (!existing.series_id) {
    return cancelSingleOccurrence(existing, options)
  }

  const roots = await listSeriesRootAppointments(existing.series_id, options?.staffId)
  const active = roots.filter((row) => row.status !== 'cancelled')
  if (active.length === 0) return existing

  for (const root of active) {
    if (root.color_group_id) {
      await sql`
        UPDATE appointments SET status = 'cancelled', reminder_sent_at = now()
        WHERE color_group_id = ${root.color_group_id}
      `
    } else {
      await sql`
        UPDATE appointments SET status = 'cancelled', reminder_sent_at = now()
        WHERE id = ${root.id}
      `
    }
  }

  const row = await getAppointmentById(existing.id)
  if (row && active.length > 0) {
    if (options?.notifyAdmin !== false) {
      void notifyAdminAppointmentCancelled(existing)
    }
    if (options?.notifyCustomer) {
      void notifyAppointmentCancelled(existing).catch((err) => {
        console.error('Superpelu WhatsApp (cita cancelada):', err)
      })
    }
  }
  return row
}

export async function cancelAppointment(
  id: string,
  options?: {
    notifyCustomer?: boolean
    notifyAdmin?: boolean
    mode?: AppointmentSeriesMode
    staffId?: string
  },
): Promise<AppointmentRow | undefined> {
  const existing = await getAppointmentById(id)
  if (!existing) return undefined

  if (options?.mode === 'group' && existing.booking_group_id) {
    const siblings = await getAppointmentsByBookingGroup(existing.booking_group_id)
    const rootsToCancel = siblings.filter(
      (r) => r.status === 'confirmed' && !isColorGroupWashRow(r.color_group_role),
    )
    for (const row of rootsToCancel) {
      await cancelSingleOccurrence(row, { notifyCustomer: false, notifyAdmin: false })
    }
    if (rootsToCancel.length > 0) {
      if (options?.notifyAdmin !== false) void notifyAdminAppointmentCancelled(existing)
      if (options?.notifyCustomer) {
        void notifyAppointmentCancelled(existing).catch((err) => {
          console.error('Superpelu WhatsApp (visita cancelada):', err)
        })
      }
    }
    return getAppointmentById(id)
  }

  if (options?.mode === 'series' && existing.series_id) {
    return cancelAppointmentSeries(existing, options)
  }
  return cancelSingleOccurrence(existing, options)
}

/** Cancela todos los tratamientos activos de una visita multi-tratamiento (cliente). */
export async function cancelBookingGroupByCustomer(
  anchorId: string,
  options?: { notifyCustomer?: boolean },
): Promise<number> {
  const anchor = await getAppointmentById(anchorId)
  if (!anchor) return 0

  if (!anchor.booking_group_id) {
    const row = await cancelAppointment(anchorId, options)
    return row ? 1 : 0
  }

  const allRows = await getAppointmentsByBookingGroup(anchor.booking_group_id)
  const rootsToCancel = allRows.filter(
    (row) => row.status === 'confirmed' && !isColorGroupWashRow(row.color_group_role),
  )
  if (rootsToCancel.length === 0) return 0

  let cancelled = 0
  for (const row of rootsToCancel) {
    const result = await cancelAppointment(row.id, { notifyCustomer: false, notifyAdmin: false })
    if (result) cancelled++
  }

  if (cancelled > 0) {
    const notifyRow = rootsToCancel[0]!
    void notifyAdminAppointmentCancelled(notifyRow)
    if (options?.notifyCustomer) {
      void notifyAppointmentCancelled(notifyRow).catch((err) => {
        console.error('Superpelu WhatsApp (visita cancelada):', err)
      })
    }
  }

  return cancelled
}

export async function markAppointmentNoShow(
  id: string,
  options?: { sendWhatsApp?: boolean },
): Promise<AppointmentRow | undefined> {
  const existing = await getAppointmentById(id)
  if (!existing) return undefined
  if (existing.status === 'cancelled' || existing.status === 'no_show') {
    return existing
  }

  if (existing.color_group_id) {
    await sql`
      UPDATE appointments SET status = 'no_show', reminder_sent_at = now()
      WHERE color_group_id = ${existing.color_group_id}
    `
  } else {
    await sql`
      UPDATE appointments SET status = 'no_show', reminder_sent_at = now()
      WHERE id = ${id}
    `
  }

  const row = await getAppointmentById(id)
  if (row && options?.sendWhatsApp) {
    void notifyAppointmentNoShow(row).catch((err) => {
      console.error('Superpelu WhatsApp (inasistencia):', err)
    })
  }
  return row
}

export function rowToPublic(row: AppointmentRow & { booking_pattern?: unknown | null }) {
  const bookingPattern = parseBookingPattern(row.booking_pattern)
  const durationMinutes = getCustomerFacingDurationMinutes(
    row.service_id,
    row.duration_minutes,
    row.color_group_role,
  )
  return {
    id: row.id,
    staffId: row.staff_id,
    staffName: row.staff_name,
    serviceId: row.service_id,
    serviceName: row.service_name,
    durationMinutes,
    colorGroupRole: row.color_group_role,
    bookingPattern,
    occupiedSlots: appointmentOccupiedSlots(
      row.service_id,
      row.start_time,
      row.duration_minutes,
      { colorGroupRole: row.color_group_role, bookingPattern },
    ),
    date: row.appointment_date,
    startTime: row.start_time,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    customerEmail: row.customer_email,
    notes: row.notes,
    status: row.status,
    locale: row.locale === 'en' ? 'en' : 'es',
    createdAt: row.created_at,
    seriesId: row.series_id,
    scope: row.scope,
  }
}
