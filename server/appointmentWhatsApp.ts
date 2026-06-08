import type { AppointmentRow } from '@server/db.js'
import { getAppointmentById, getAppointmentsByBookingGroup } from '@server/appointments.js'
import { isColorGroupWashRow } from '@/lib/bookingOccupancy'
import {
  buildWhatsAppAppointmentMessage,
  filterWhatsAppBookingGroupRows,
} from '@/i18n/whatsappAppointment'
import { appointmentLocale } from '@/i18n/localeHelpers'
import { getOpenWaConfig, openWaSendText, phoneToWhatsAppChatId } from '@server/openwa.js'
import { sendWhatsAppWithLogoHeader } from '@server/whatsappBranding.js'
import { buildBookingUrl, buildManageUrl } from '@server/appointmentLinks.js'

export async function buildAppointmentConfirmationMessage(
  row: AppointmentRow,
): Promise<string> {
  const groupRows = row.booking_group_id
    ? filterWhatsAppBookingGroupRows(await getAppointmentsByBookingGroup(row.booking_group_id))
    : undefined
  return buildWhatsAppAppointmentMessage(row, 'confirmation', {
    manageUrl: buildManageUrl(row),
    groupRows,
  })
}

export function buildAppointmentRescheduledMessage(row: AppointmentRow): string {
  return buildWhatsAppAppointmentMessage(row, 'rescheduled', {
    manageUrl: buildManageUrl(row),
  })
}

export function buildAppointmentReminderMessage(row: AppointmentRow): string {
  return buildWhatsAppAppointmentMessage(row, 'reminder', {
    manageUrl: buildManageUrl(row),
  })
}

export function buildAppointmentCancelledMessage(
  row: AppointmentRow,
  groupRows?: AppointmentRow[],
): string {
  return buildWhatsAppAppointmentMessage(row, 'cancelled', {
    bookingUrl: buildBookingUrl(),
    groupRows,
  })
}

export async function buildAppointmentVisitUpdatedMessage(
  row: AppointmentRow,
): Promise<string> {
  const groupRows = row.booking_group_id
    ? filterWhatsAppBookingGroupRows(
        (await getAppointmentsByBookingGroup(row.booking_group_id)).filter(
          (apt) => apt.status === 'confirmed',
        ),
      )
    : undefined
  return buildWhatsAppAppointmentMessage(row, 'updated', {
    manageUrl: buildManageUrl(row),
    groupRows,
  })
}

export function buildAppointmentNoShowMessage(row: AppointmentRow): string {
  return buildWhatsAppAppointmentMessage(row, 'no_show', {
    bookingUrl: buildBookingUrl(),
  })
}

export async function notifyAppointmentCreated(
  row: AppointmentRow,
  options?: { forStaffPortal?: boolean },
): Promise<void> {
  const config = getOpenWaConfig()
  if (!config) return

  if (config.notifyPublicOnly && options?.forStaffPortal) return
  if (row.status === 'cancelled' || row.status === 'no_show') return

  const chatId = phoneToWhatsAppChatId(row.customer_phone)
  const text = await buildAppointmentConfirmationMessage(row)
  const messageId = await openWaSendText(chatId, text)
  console.log(
    `Superpelu WhatsApp: confirmación enviada a ${row.customer_phone}${messageId ? ` (${messageId})` : ''}`,
  )
}

/** Confirmación tras reprogramar una cita (cliente o agenda). */
export async function notifyAppointmentRescheduled(row: AppointmentRow): Promise<void> {
  const config = getOpenWaConfig()
  if (!config) return
  if (row.status === 'cancelled' || row.status === 'no_show') return
  // El lavado enlazado se gestiona en agenda; el cliente solo recibe aviso si cambia la coloración.
  if (isColorGroupWashRow(row.color_group_role)) return

  const chatId = phoneToWhatsAppChatId(row.customer_phone)
  const text = buildAppointmentRescheduledMessage(row)
  const messageId = await openWaSendText(chatId, text)
  console.log(
    `Superpelu WhatsApp: reprogramación confirmada a ${row.customer_phone}${messageId ? ` (${messageId})` : ''}`,
  )
}

/** Envía el recordatorio de 24h. Devuelve true si se envió (para marcar la cita). */
export async function sendAppointmentReminder(row: AppointmentRow): Promise<boolean> {
  const config = getOpenWaConfig()
  if (!config) return false
  if (row.status === 'cancelled' || row.status === 'no_show') return false

  const chatId = phoneToWhatsAppChatId(row.customer_phone)
  const text = buildAppointmentReminderMessage(row)
  const messageId = await openWaSendText(chatId, text)
  console.log(
    `Superpelu WhatsApp: recordatorio enviado a ${row.customer_phone}${messageId ? ` (${messageId})` : ''}`,
  )
  return true
}

/** Seguimiento tras marcar inasistencia desde la agenda. */
export async function notifyAppointmentNoShow(row: AppointmentRow): Promise<void> {
  const config = getOpenWaConfig()
  if (!config) return
  if (isColorGroupWashRow(row.color_group_role)) return

  const chatId = phoneToWhatsAppChatId(row.customer_phone)
  const text = buildAppointmentNoShowMessage(row)
  const messageId = await sendWhatsAppWithLogoHeader(chatId, text, appointmentLocale(row))
  console.log(
    `Superpelu WhatsApp: inasistencia enviada a ${row.customer_phone}${messageId ? ` (${messageId})` : ''}`,
  )
}

/** Confirmación tras cancelar una cita (cliente desde enlace público). */
export async function notifyAppointmentCancelled(
  row: AppointmentRow,
  groupRows?: AppointmentRow[],
): Promise<void> {
  const config = getOpenWaConfig()
  if (!config) return

  const resolvedGroupRows =
    groupRows ??
    (row.booking_group_id
      ? filterWhatsAppBookingGroupRows(await getAppointmentsByBookingGroup(row.booking_group_id))
      : undefined)

  const chatId = phoneToWhatsAppChatId(row.customer_phone)
  const text = buildAppointmentCancelledMessage(row, resolvedGroupRows)
  const messageId = await openWaSendText(chatId, text)
  console.log(
    `Superpelu WhatsApp: cancelación confirmada a ${row.customer_phone}${messageId ? ` (${messageId})` : ''}`,
  )
}

/** Resumen de visita multi-tratamiento tras guardar cambios (cliente). */
export async function notifyCustomerBookingVisitFinished(linkId: string): Promise<void> {
  const config = getOpenWaConfig()
  if (!config) return

  const anchor = await getAppointmentById(linkId)
  if (!anchor) return

  if (!anchor.booking_group_id) {
    if (anchor.status === 'confirmed') {
      const text = await buildAppointmentVisitUpdatedMessage(anchor)
      const chatId = phoneToWhatsAppChatId(anchor.customer_phone)
      await openWaSendText(chatId, text)
    } else if (anchor.status === 'cancelled') {
      await notifyAppointmentCancelled(anchor)
    }
    return
  }

  const allRows = await getAppointmentsByBookingGroup(anchor.booking_group_id)
  const activeRows = filterWhatsAppBookingGroupRows(
    allRows.filter((row) => row.status === 'confirmed'),
  )

  const chatId = phoneToWhatsAppChatId(anchor.customer_phone)

  if (activeRows.length === 0) {
    const visibleRows = filterWhatsAppBookingGroupRows(allRows)
    await notifyAppointmentCancelled(anchor, visibleRows)
    return
  }

  const text = await buildAppointmentVisitUpdatedMessage(activeRows[0]!)
  const messageId = await openWaSendText(chatId, text)
  console.log(
    `Superpelu WhatsApp: visita actualizada a ${anchor.customer_phone}${messageId ? ` (${messageId})` : ''}`,
  )
}
