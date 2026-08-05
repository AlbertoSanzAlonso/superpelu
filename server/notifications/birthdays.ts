import {
  listCustomersWithBirthdayToday,
  markBirthdayWishSent,
} from '@server/customers/index.js'
import { buildBirthdayWishText } from '@server/customers/birthdayMessage.js'
import { normalizeLocale } from '@/i18n/types'
import { nowSalonMinutes, todaySalon } from '@/lib/core/dates'
import {
  isOpenWaConfigured,
  openWaEnsureStarted,
  phoneToWhatsAppChatId,
} from '@server/notifications/openwa.js'
import { sendWhatsAppWithLogoHeader } from '@server/notifications/branding.js'

const BIRTHDAY_SEND_AFTER_MINUTES = 10 * 60 // 10:00 Europe/Madrid
const POLL_MINUTES = 10

function envFlag(name: string, fallback: boolean): boolean {
  const raw = (process.env[name] ?? '').trim().toLowerCase()
  if (!raw) return fallback
  return raw === '1' || raw === 'true' || raw === 'yes'
}

let running = false

export async function processDueBirthdayWishes(): Promise<number> {
  if (running) return 0
  if (nowSalonMinutes() < BIRTHDAY_SEND_AFTER_MINUTES) return 0

  running = true
  let sent = 0
  try {
    const year = Number(todaySalon().slice(0, 4))
    const customers = await listCustomersWithBirthdayToday()
    for (const customer of customers) {
      try {
        await openWaEnsureStarted()
        const locale = normalizeLocale(customer.locale)
        const text = await buildBirthdayWishText(customer.first_name, locale)
        const chatId = phoneToWhatsAppChatId(customer.phone)
        await sendWhatsAppWithLogoHeader(chatId, text, locale)
        await markBirthdayWishSent(customer.phone, year)
        sent += 1
        console.log(`Superpelu cumpleaños: felicitación enviada a ${customer.phone}`)
      } catch (err) {
        console.error(`Superpelu cumpleaños: fallo con ${customer.phone}:`, err)
      }
    }
  } catch (err) {
    console.error('Superpelu cumpleaños: error al procesar:', err)
  } finally {
    running = false
  }
  return sent
}

export function startBirthdayWishScheduler(): void {
  if (!envFlag('BIRTHDAY_WISHES_ENABLED', true)) {
    console.log('Superpelu cumpleaños: desactivado (BIRTHDAY_WISHES_ENABLED=false)')
    return
  }
  if (!isOpenWaConfigured()) {
    console.log('Superpelu cumpleaños: OpenWA no configurado; scheduler inactivo')
    return
  }

  console.log(
    `Superpelu cumpleaños: activo (cada ${POLL_MINUTES} min, desde las 10:00 Europe/Madrid)`,
  )

  setTimeout(() => void processDueBirthdayWishes(), 45_000)
  setInterval(() => void processDueBirthdayWishes(), POLL_MINUTES * 60_000)
}
