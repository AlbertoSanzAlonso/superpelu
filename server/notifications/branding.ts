import { access, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { publicBaseUrl, WHATSAPP_LOGO_IMAGE_PATH } from '@server/appointments/links.js'
import { getOpenWaConfig, openWaSendImage, openWaSendText } from '@server/notifications/openwa.js'
import { getTranslation } from '@/i18n/translations'
import type { Locale } from '@/i18n/types'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const LOGO_TIMEOUT_MS = 6_000

let cachedLogoBase64: string | null = null

async function resolveLogoFilePath(): Promise<string> {
  const relative = WHATSAPP_LOGO_IMAGE_PATH.replace(/^\//, '')
  const candidates = [
    path.join(REPO_ROOT, 'public', relative),
    path.join(process.cwd(), 'public', relative),
  ]
  for (const filePath of candidates) {
    try {
      await access(filePath)
      return filePath
    } catch {
      /* siguiente candidato */
    }
  }
  throw new Error(`Logo no encontrado (${candidates.join(' | ')})`)
}

async function readWhatsAppLogoBase64(): Promise<string> {
  if (cachedLogoBase64) return cachedLogoBase64
  const filePath = await resolveLogoFilePath()
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
  try {
    const base64 = await readWhatsAppLogoBase64()
    await openWaSendImage(chatId, { base64 }, caption)
    return
  } catch (err) {
    const url = whatsappLogoImageUrl()
    if (!url) {
      console.error('Superpelu WhatsApp: cabecera con logo omitida:', err)
      return
    }
    try {
      await openWaSendImage(chatId, { url }, caption)
    } catch (urlErr) {
      console.error('Superpelu WhatsApp: cabecera con logo omitida:', urlErr)
    }
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timeout (${ms}ms)`)), ms)
    promise
      .then((value) => {
        clearTimeout(timer)
        resolve(value)
      })
      .catch((err) => {
        clearTimeout(timer)
        reject(err)
      })
  })
}

/** Logo del salón como cabecera y después el cuerpo del mensaje (valoración, inasistencia, etc.). */
export async function sendWhatsAppWithLogoHeader(
  chatId: string,
  text: string,
  locale: Locale,
): Promise<string | undefined> {
  const config = getOpenWaConfig()
  if (!config) return undefined

  try {
    await withTimeout(sendLogoHeader(chatId, locale), LOGO_TIMEOUT_MS, 'WhatsApp logo')
  } catch (err) {
    console.warn('Superpelu WhatsApp: cabecera con logo omitida:', err)
  }

  return openWaSendText(chatId, text)
}
