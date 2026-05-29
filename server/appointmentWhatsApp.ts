import type { AppointmentRow } from './db.js'
import { formatDisplayDate } from '../src/lib/dates.ts'
import { formatAppointmentTimeRange } from '../src/lib/bookingOccupancy.ts'
import {
  getOpenWaConfig,
  openWaSendText,
  phoneToWhatsAppChatId,
} from './openwa.js'
import { buildCancelUrl } from './appointmentLinks.js'

const SALON_ADDRESS = 'Av. las Palmeras, 8, Local 18, 29630 Benalmádena'
const SALON_PHONE = '952 443 686'

export function buildAppointmentConfirmationMessage(row: AppointmentRow): string {
  const firstName = row.customer_name.trim().split(/\s+/)[0] || row.customer_name
  const dateLabel = formatDisplayDate(row.appointment_date)
  const timeRange = formatAppointmentTimeRange(
    row.service_id,
    row.start_time,
    row.duration_minutes,
  )

  const cancelUrl = buildCancelUrl(row)

  const actions: string[] = []
  if (cancelUrl) {
    actions.push('', '❌ Cancelar la cita:', cancelUrl)
  }

  return `Hola ${firstName}, 👋

Tu cita en *Superpelu* está confirmada:

📅 ${dateLabel}
🕐 ${timeRange}
💇 ${row.service_name}
👤 Con ${row.staff_name}

📍 ${SALON_ADDRESS}
📞 ${SALON_PHONE}
${actions.join('\n')}

¡Te esperamos!`
}

export function buildAppointmentReminderMessage(row: AppointmentRow): string {
  const firstName = row.customer_name.trim().split(/\s+/)[0] || row.customer_name
  const dateLabel = formatDisplayDate(row.appointment_date)
  const timeRange = formatAppointmentTimeRange(
    row.service_id,
    row.start_time,
    row.duration_minutes,
  )

  const cancelUrl = buildCancelUrl(row)

  const actions: string[] = []
  if (cancelUrl) {
    actions.push('', '❌ Si no puedes venir, cancela aquí:', cancelUrl)
  }

  return `Hola ${firstName}, 👋

Te recordamos tu cita de mañana en *Superpelu*:

📅 ${dateLabel}
🕐 ${timeRange}
💇 ${row.service_name}
👤 Con ${row.staff_name}

📍 ${SALON_ADDRESS}
📞 ${SALON_PHONE}
${actions.join('\n')}

¡Te esperamos!`
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
