import { getAppointmentById } from '@server/appointments/index.js'
import { getCustomer, markCustomerReviewRequestSent } from '@server/customers/index.js'
import { buildGoogleReviewRequestMessage } from '@/i18n/whatsappAppointment'
import { appointmentLocale } from '@/i18n/localeHelpers'
import { normalizeLocale, type Locale } from '@/i18n/types'
import {
  getOpenWaConfig,
  openWaEnsureStarted,
  phoneToWhatsAppChatId,
} from '@server/notifications/openwa.js'
import { sendWhatsAppWithLogoHeader } from '@server/notifications/branding.js'

export async function sendCustomerReviewRequest(
  phone: string,
  options?: { appointmentId?: string },
): Promise<{ reviewRequestSentAt: string }> {
  const customer = await getCustomer(phone)
  if (!customer) throw new Error('CLIENTE_NO_ENCONTRADO')

  const config = getOpenWaConfig()
  if (!config) throw new Error('WHATSAPP_NO_CONFIGURADO')

  let locale: Locale = normalizeLocale(customer.locale)
  if (options?.appointmentId) {
    const apt = await getAppointmentById(options.appointmentId)
    if (apt && apt.customer_phone === phone) {
      locale = appointmentLocale(apt)
    }
  }

  const firstName = customer.first_name.trim() || 'Cliente'
  const chatId = phoneToWhatsAppChatId(phone)
  const text = buildGoogleReviewRequestMessage(locale, firstName || 'Cliente')
  await openWaEnsureStarted()
  const messageId = await sendWhatsAppWithLogoHeader(chatId, text, locale)
  console.log(
    `Superpelu WhatsApp: solicitud valoración a ${phone}${messageId ? ` (${messageId})` : ''}`,
  )

  const sentAt = await markCustomerReviewRequestSent(phone)
  return { reviewRequestSentAt: sentAt }
}
