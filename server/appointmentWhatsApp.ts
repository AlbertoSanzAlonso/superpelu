import type { AppointmentRow } from './db.js'
import { buildWhatsAppAppointmentMessage } from '@/i18n/whatsappAppointment'
import {
  getOpenWaConfig,
  openWaSendText,
  phoneToWhatsAppChatId,
} from './openwa.js'
import { buildBookingUrl, buildManageUrl } from './appointmentLinks.js'

export function buildAppointmentConfirmationMessage(row: AppointmentRow): string {
  return buildWhatsAppAppointmentMessage(row, 'confirmation', {
    manageUrl: buildManageUrl(row),
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

export function buildAppointmentCancelledMessage(row: AppointmentRow): string {
  return buildWhatsAppAppointmentMessage(row, 'cancelled', {
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
  if (row.status === 'cancelled') return

  const chatId = phoneToWhatsAppChatId(row.customer_phone)
  const text = buildAppointmentConfirmationMessage(row)
  const messageId = await openWaSendText(chatId, text)
  console.log(
    `Superpelu WhatsApp: confirmación enviada a ${row.customer_phone}${messageId ? ` (${messageId})` : ''}`,
  )
}

/** Confirmación tras reprogramar una cita (cliente o agenda). */
export async function notifyAppointmentRescheduled(row: AppointmentRow): Promise<void> {
  const config = getOpenWaConfig()
  if (!config) return
  if (row.status === 'cancelled') return

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
  if (row.status === 'cancelled') return false

  const chatId = phoneToWhatsAppChatId(row.customer_phone)
  const text = buildAppointmentReminderMessage(row)
  const messageId = await openWaSendText(chatId, text)
  console.log(
    `Superpelu WhatsApp: recordatorio enviado a ${row.customer_phone}${messageId ? ` (${messageId})` : ''}`,
  )
  return true
}

/** Confirmación tras cancelar una cita (cliente desde enlace público). */
export async function notifyAppointmentCancelled(row: AppointmentRow): Promise<void> {
  const config = getOpenWaConfig()
  if (!config) return

  const chatId = phoneToWhatsAppChatId(row.customer_phone)
  const text = buildAppointmentCancelledMessage(row)
  const messageId = await openWaSendText(chatId, text)
  console.log(
    `Superpelu WhatsApp: cancelación confirmada a ${row.customer_phone}${messageId ? ` (${messageId})` : ''}`,
  )
}
