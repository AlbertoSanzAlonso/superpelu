import { sql, type AppointmentRow } from "@server/db.js"
import { getService } from "@server/catalog/services.js"
import { serviceDisplayName } from "@/i18n/localeHelpers"
import { normalizeLocale } from "@/i18n/types"
import { getStaff } from "@server/staff/index.js"
import {
  resolveStaffPortalCustomerPatch,
} from "@server/customers/index.js"
import { notifyAppointmentUpdated } from "@server/notifications/whatsapp.js"
import { hoursUntilAppointment } from "@/lib/core/dates"
import {
  COLOR_GROUP_ROLE,
  getBookingSpanMinutes,
  getWashPhaseStartMinutes,
  isColorGroupColorRow,
  isColorGroupWashRow,
} from "@/lib/booking/occupancy"
import { lockStaffDaysForBooking, type DbClient } from "@server/appointments/lock.js"
import { getAppointmentById } from "@server/appointments/queries.js"
import { isValidDateString, minutesToTime, timeToMinutes } from "@server/appointments/time.js"
import type { UpdateAppointmentInput } from "@server/appointments/types.js"
import { createAppointment } from "@server/appointments/create.js"
export type { UpdateAppointmentInput } from "@server/appointments/types.js"

function servicesDiffer(
  existing: AppointmentRow,
  serviceIds: string[],
): boolean {
  if (serviceIds.length !== 1) return true
  return serviceIds[0] !== existing.service_id
}

/** Hay que recrear la visita (borrar + crear) si cambia el set de tratamientos. */
function shouldReplaceVisit(
  existing: AppointmentRow,
  serviceIds: string[],
): boolean {
  if (serviceIds.length === 0) return false
  if (serviceIds.length > 1) return true
  // Un solo tratamiento: recrear si cambió el servicio o si pertenecía a un
  // grupo multi (hay que eliminar los hermanos que el usuario quitó).
  return servicesDiffer(existing, serviceIds) || Boolean(existing.booking_group_id)
}

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

  const date = input.date ?? existing.appointment_date
  const startTime = input.startTime ?? existing.start_time
  const serviceIds = input.serviceIds?.filter(Boolean) ?? []

  // Edición desde agenda (admin/profesional): sin restricciones de hueco ni día laboral.
  const forceSchedule = true

  if (!isValidDateString(date)) {
    throw new Error('FECHA_INVALIDA')
  }

  // Multi-service, cambio de servicio, o visita multi reducida a uno → delete old + create new
  if (shouldReplaceVisit(existing, serviceIds)) {
    return replaceAppointment(existing, targetStaffId, serviceIds, {
      ...input,
      forceSchedule,
    })
  }

  const serviceId = input.serviceId ?? existing.service_id
  const service = await getService(serviceId, { onlineOnly: false })
  if (!service) throw new Error('SERVICIO_INVALIDO')

  const staffMember = await getStaff(targetStaffId)
  if (!staffMember?.active) throw new Error('STAFF_INVALIDO')

  const customDuration = input.serviceDurations?.[0] ?? null
  const useCustomDuration = customDuration != null && customDuration > 0
  const serviceChanged = serviceId !== existing.service_id

  const scheduleChanging =
    date !== existing.appointment_date ||
    startTime !== existing.start_time ||
    targetStaffId !== existing.staff_id ||
    serviceChanged

  // Si no envían duración, conservar la de la cita (p. ej. alargada en agenda).
  // Solo al cambiar de servicio se vuelve a la del catálogo.
  const storedDuration = useCustomDuration
    ? customDuration
    : serviceChanged
      ? getBookingSpanMinutes(service.id, service.durationMinutes, service.bookingPattern)
      : existing.duration_minutes

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
    const resolved = await resolveStaffPortalCustomerPatch({
      customerFirstName: input.customerFirstName,
      customerLastName: input.customerLastName,
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      customerEmail: input.customerEmail,
      customerNotes: input.customerNotes,
      customerLocale: input.customerLocale,
      guestCustomer: input.guestCustomer,
      existingName: existing.customer_name,
      existingPhone: existing.customer_phone,
      existingEmail: existing.customer_email,
    })
    nameSnapshot = resolved.nameSnapshot
    customerPhone = resolved.customerPhone
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

  const staff = staffMember

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
      // Edición agenda: no comprobar solapes (forceSchedule siempre activo).
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
  if (scheduleChanged && notifyCustomerReschedule) {
    void notifyAppointmentUpdated(updated).catch((err) => {
      console.error('Superpelu WhatsApp (cita modificada):', err)
    })
  }
  return updated
}

async function replaceAppointment(
  existing: AppointmentRow,
  targetStaffId: string,
  serviceIds: string[],
  input: UpdateAppointmentInput,
): Promise<AppointmentRow> {
  const date = input.date ?? existing.appointment_date
  // Si hay hora por tratamiento, la del primero manda (p. ej. al quitar el primero de la visita).
  const startTime =
    input.serviceStartTimes?.length === serviceIds.length && input.serviceStartTimes[0]
      ? input.serviceStartTimes[0]
      : (input.startTime ?? existing.start_time)
  const staff = await getStaff(targetStaffId)
  if (!staff?.active) throw new Error('STAFF_INVALIDO')

  const staffAssignments =
    input.staffAssignments?.length === serviceIds.length
      ? input.staffAssignments.map((id) => id || targetStaffId)
      : undefined

  const customerResolved = await resolveStaffPortalCustomerPatch({
    customerFirstName: input.customerFirstName,
    customerLastName: input.customerLastName,
    customerName: input.customerName,
    customerPhone: input.customerPhone,
    customerEmail: input.customerEmail,
    customerNotes: input.customerNotes,
    customerLocale: input.customerLocale,
    guestCustomer: input.guestCustomer,
    existingName: existing.customer_name,
    existingPhone: existing.customer_phone,
    existingEmail: existing.customer_email,
  })

  // Borrar el grupo antiguo primero para que no bloquee la recreación.
  // Preferir DELETE por columna de grupo (evita ANY(...::uuid[]) con postgres.js).
  if (existing.booking_group_id) {
    await sql`DELETE FROM appointments WHERE booking_group_id = ${existing.booking_group_id}`
    // Lavados de color huérfanos (mismo color_group, sin booking_group).
    if (existing.color_group_id) {
      await sql`DELETE FROM appointments WHERE color_group_id = ${existing.color_group_id}`
    }
  } else if (existing.color_group_id) {
    await sql`DELETE FROM appointments WHERE color_group_id = ${existing.color_group_id}`
  } else {
    await sql`DELETE FROM appointments WHERE id = ${existing.id}`
  }

  const created = await createAppointment({
    staffId: targetStaffId,
    staffAssignments,
    serviceIds,
    serviceStartTimes: input.serviceStartTimes?.length === serviceIds.length
      ? input.serviceStartTimes
      : undefined,
    serviceDurations: input.serviceDurations?.length === serviceIds.length
      ? input.serviceDurations
      : undefined,
    date,
    startTime,
    customerFirstName: input.customerFirstName,
    customerLastName: input.customerLastName,
    customerPhone: customerResolved.customerPhone,
    customerEmail:
      input.customerEmail !== undefined ? (input.customerEmail ?? undefined) : (existing.customer_email ?? undefined),
    customerNotes:
      input.customerNotes !== undefined ? (input.customerNotes ?? undefined) : undefined,
    notes: input.notes !== undefined ? (input.notes ?? undefined) : undefined,
    customerLocale: input.customerLocale ?? normalizeLocale(existing.locale),
    forStaffPortal: true,
    forceSchedule: true,
    guestCustomer: input.guestCustomer,
    // Es una modificación: no mandar "cita nueva" ni confundir con cancelación.
    skipCustomerWhatsApp: true,
  })

  if (input.notifyCustomerWhatsApp === true) {
    void notifyAppointmentUpdated(created).catch((err) => {
      console.error('Superpelu WhatsApp (cita modificada):', err)
    })
  }
  return created
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
