import { sql, type AppointmentRow } from "@server/db.js"
import { getService } from "@server/services.js"
import { serviceDisplayName } from "@/i18n/localeHelpers"
import { normalizeLocale } from "@/i18n/types"
import { isStaffWorkingOnDate } from "@server/availability.js"
import { getStaff, staffCanPerformService } from "@server/staff.js"
import {
  customerNameSnapshot,
  getCustomer,
  resolveCustomerFromInput,
  upsertCustomer,
} from "@server/customers.js"
import { notifyAppointmentRescheduled } from "@server/appointmentWhatsApp.js"
import { notifyAdminAppointmentUpdated } from "@server/appointmentEmail.js"
import { hoursUntilAppointment, isSalonOpenDay } from "@/lib/dates"
import {
  COLOR_GROUP_ROLE,
  COLOR_SPLIT_SEGMENT_MINUTES,
  getBookingSpanMinutes,
  getOccupiedSegmentsForBooking,
  getWashPhaseStartMinutes,
  isColorGroupColorRow,
  isColorGroupWashRow,
  type OccupiedSegment,
} from "@/lib/bookingOccupancy"
import { lockStaffDaysForBooking, type DbClient } from "@server/bookingLock.js"
import { getAppointmentById } from "@server/appointmentQueries.js"
import { assertBookingAvailable } from "@server/appointmentBooking.js"
import { isValidDateString, minutesToTime, timeToMinutes } from "@server/appointmentTime.js"
import type { UpdateAppointmentInput } from "@server/appointmentTypes.js"
export type { UpdateAppointmentInput } from "@server/appointmentTypes.js"

export async function updateAppointmentForStaff(
  appointmentId: string,
  staffId: string,
  input: UpdateAppointmentInput,
): Promise<AppointmentRow> {
  const existing = await getAppointmentById(appointmentId)
  if (!existing || existing.status === 'cancelled' || existing.status === 'no_show') {
    throw new Error('CITA_NO_ENCONTRADA')
  }
  if (existing.staff_id !== staffId && input.staffId === undefined) {
    throw new Error('CITA_NO_ENCONTRADA')
  }

  const targetStaffId = input.staffId ?? existing.staff_id ?? staffId
  if (!targetStaffId) throw new Error('CITA_NO_ENCONTRADA')

  const serviceId = input.serviceId ?? existing.service_id
  const date = input.date ?? existing.appointment_date
  const startTime = input.startTime ?? existing.start_time
  const service = await getService(serviceId, { onlineOnly: false })
  if (!service) throw new Error('SERVICIO_INVALIDO')

  if (!(await staffCanPerformService(targetStaffId, serviceId))) {
    throw new Error('STAFF_NO_REALIZA_SERVICIO')
  }

  if (
    !isValidDateString(date) ||
    !isSalonOpenDay(date) ||
    !(await isStaffWorkingOnDate(targetStaffId, date))
  ) {
    throw new Error('FECHA_INVALIDA')
  }

  const startMinutes = timeToMinutes(startTime)
  let segments: OccupiedSegment[]
  if (isColorGroupWashRow(existing.color_group_role)) {
    segments = [{ startMinutes, durationMinutes: COLOR_SPLIT_SEGMENT_MINUTES }]
  } else if (isColorGroupColorRow(existing.color_group_role)) {
    segments = [{ startMinutes, durationMinutes: COLOR_SPLIT_SEGMENT_MINUTES }]
  } else {
    segments = getOccupiedSegmentsForBooking(service.id, startMinutes, service.durationMinutes)
  }
  const scheduleChanging =
    date !== existing.appointment_date ||
    startTime !== existing.start_time ||
    targetStaffId !== existing.staff_id ||
    serviceId !== existing.service_id

  const storedDuration = isColorGroupWashRow(existing.color_group_role)
    ? COLOR_SPLIT_SEGMENT_MINUTES
    : isColorGroupColorRow(existing.color_group_role)
      ? COLOR_SPLIT_SEGMENT_MINUTES
      : getBookingSpanMinutes(service.id, service.durationMinutes)

  const hasCustomerPatch =
    input.customerName !== undefined ||
    input.customerFirstName !== undefined ||
    input.customerLastName !== undefined ||
    input.customerPhone !== undefined ||
    input.customerEmail !== undefined ||
    input.customerNotes !== undefined

  let nameSnapshot = existing.customer_name
  let customerPhone = existing.customer_phone

  if (hasCustomerPatch) {
    const split = resolveCustomerFromInput({
      firstName: input.customerFirstName,
      lastName: input.customerLastName,
      customerName: input.customerName ?? existing.customer_name,
      phone: input.customerPhone ?? existing.customer_phone,
    })
    const profile = await getCustomer(split.phone)
    await upsertCustomer({
      firstName: split.firstName,
      lastName: split.lastName,
      phone: split.phone,
      email:
        input.customerEmail !== undefined ? input.customerEmail : existing.customer_email,
      notes:
        input.customerNotes !== undefined
          ? input.customerNotes
          : (profile?.notes ?? null),
      ...(input.customerLocale !== undefined
        ? { locale: normalizeLocale(input.customerLocale) }
        : {}),
    })
    nameSnapshot = customerNameSnapshot(split.firstName, split.lastName)
    customerPhone = split.phone
  }

  // Reprogramación: si la nueva fecha/hora queda a más de 24h, reactivar el
  // recordatorio (NULL); si queda a 24h o menos, marcar como gestionado.
  const dateOrTimeChanged =
    date !== existing.appointment_date || startTime !== existing.start_time
  const staffChanged = targetStaffId !== existing.staff_id
  const reminderSentAt =
    dateOrTimeChanged || staffChanged
      ? hoursUntilAppointment(date, startTime) <= 24
        ? new Date().toISOString()
        : null
      : existing.reminder_sent_at

  const staff = (await getStaff(targetStaffId))!
  if (!staff?.active) throw new Error('STAFF_INVALIDO')

  const locale =
    input.customerLocale !== undefined
      ? normalizeLocale(input.customerLocale)
      : normalizeLocale(existing.locale)
  const serviceName = serviceDisplayName(service, locale)

  const customerEmail =
    input.customerEmail !== undefined
      ? input.customerEmail?.trim() || null
      : existing.customer_email
  const appointmentNotes =
    input.notes !== undefined ? input.notes?.trim() || null : existing.notes

  const persistUpdates = async (query: DbClient) => {
    if (existing.color_group_id && isColorGroupColorRow(existing.color_group_role)) {
      const washStart = minutesToTime(getWashPhaseStartMinutes(timeToMinutes(startTime)))
      await query`
        UPDATE appointments SET
          staff_id = ${targetStaffId},
          service_id = ${service.id},
          service_name = ${serviceName},
          duration_minutes = ${storedDuration},
          appointment_date = ${date},
          start_time = ${startTime},
          customer_name = ${nameSnapshot},
          customer_phone = ${customerPhone},
          customer_email = ${customerEmail},
          notes = ${appointmentNotes},
          staff_name = ${staff.name},
          reminder_sent_at = ${reminderSentAt},
          locale = ${locale}
        WHERE id = ${appointmentId}
      `
      if (dateOrTimeChanged) {
        await query`
          UPDATE appointments SET
            appointment_date = ${date},
            start_time = ${washStart},
            customer_name = ${nameSnapshot},
            customer_phone = ${customerPhone},
            customer_email = ${customerEmail},
            reminder_sent_at = ${reminderSentAt}
          WHERE color_group_id = ${existing.color_group_id}
            AND color_group_role = ${COLOR_GROUP_ROLE.wash}
        `
      } else if (hasCustomerPatch) {
        await query`
          UPDATE appointments SET
            customer_name = ${nameSnapshot},
            customer_phone = ${customerPhone},
            customer_email = ${customerEmail}
          WHERE color_group_id = ${existing.color_group_id}
            AND color_group_role = ${COLOR_GROUP_ROLE.wash}
        `
      }
    } else {
      await query`
        UPDATE appointments SET
          staff_id = ${targetStaffId},
          service_id = ${service.id},
          service_name = ${serviceName},
          duration_minutes = ${storedDuration},
          appointment_date = ${date},
          start_time = ${startTime},
          customer_name = ${nameSnapshot},
          customer_phone = ${customerPhone},
          customer_email = ${customerEmail},
          notes = ${appointmentNotes},
          staff_name = ${staff.name},
          reminder_sent_at = ${reminderSentAt},
          locale = ${locale}
        WHERE id = ${appointmentId}
      `
    }
  }

  if (scheduleChanging) {
    const lockKeys: Array<{ staffId: string; date: string }> = [
      { staffId: targetStaffId, date },
    ]
    if (existing.staff_id) {
      lockKeys.push({ staffId: existing.staff_id, date: existing.appointment_date })
    }
    await sql.begin(async (tx) => {
      await lockStaffDaysForBooking(tx, lockKeys)
      await assertBookingAvailable(tx, targetStaffId, date, segments, appointmentId)
      await persistUpdates(tx)
    })
  } else {
    await persistUpdates(sql)
  }

  const updated = (await getAppointmentById(appointmentId))!
  const scheduleChanged =
    dateOrTimeChanged || serviceId !== existing.service_id || staffChanged
  const notifyCustomerReschedule =
    scheduleChanged &&
    !isColorGroupWashRow(existing.color_group_role) &&
    input.notifyCustomerWhatsApp === true
  if (scheduleChanged) {
    if (notifyCustomerReschedule) {
      void notifyAppointmentRescheduled(updated).catch((err) => {
        console.error('Superpelu WhatsApp (cita reprogramada):', err)
      })
    }
    void notifyAdminAppointmentUpdated(existing, updated)
  }
  return updated
}

export async function updateAppointmentForAdmin(
  appointmentId: string,
  input: UpdateAppointmentInput,
): Promise<AppointmentRow> {
  const existing = await getAppointmentById(appointmentId)
  if (!existing || existing.status === 'cancelled' || !existing.staff_id) {
    throw new Error('CITA_NO_ENCONTRADA')
  }
  return updateAppointmentForStaff(appointmentId, existing.staff_id, input)
}
