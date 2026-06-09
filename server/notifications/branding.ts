import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { publicBaseUrl, WHATSAPP_LOGO_IMAGE_PATH } from '@server/appointments/links.js'
import { getOpenWaConfig, openWaSendImage, openWaSendText } from '@server/notifications/openwa.js'
import { getTranslation } from '@/i18n/translations'
import type { Locale } from '@/i18n/types'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

let cachedLogoBase64: string | null = null

async function readWhatsAppLogoBase64(): Promise<string> {
  if (cachedLogoBase64) return cachedLogoBase64
  const relative = WHATSAPP_LOGO_IMAGE_PATH.replace(/^\//, '')
  const filePath = path.join(REPO_ROOT, 'public', relative)
  const buf = await readFile(filePath)
  cachedLogoBase64 = `data:image/jpeg;base64,${buf.toString('base64')}`
  return cachedLogoBase64
}

function whatsappLogoImageUrl(): string | null {
  const base = publicBaseUrl()
  if (!base) return null
  return `${base}${WHATSAPP_LOGO_IMAGE_PATH}`
}

async function sendLogoHeader(chatId: string, locale: Locale): Promise<void> {
  const caption = getTranslation(locale).whatsappAppointment.logoCaption
  const base64 = await readWhatsAppLogoBase64()
  try {
    await openWaSendImage(chatId, { base64 }, caption)
    return
  } catch (err) {
    const url = whatsappLogoImageUrl()
    if (!url) throw err
    await openWaSendImage(chatId, { url }, caption)
  }
}

/** Logo del salón como cabecera y después el cuerpo del mensaje (valoración, inasistencia, etc.). */
export async function sendWhatsAppWithLogoHeader(
  chatId: string,
  text: string,
  locale: Locale,
): Promise<string | undefined> {
  const config = getOpenWaConfig()
  if (!config) return undefined

  await sendLogoHeader(chatId, locale)
  return openWaSendText(chatId, text)
}
