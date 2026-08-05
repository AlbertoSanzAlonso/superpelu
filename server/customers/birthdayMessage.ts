import { sql } from '@server/db.js'
import type { Locale } from '@/i18n/types'
import { capitalizePersonName } from '@/lib/customer/name'

export const BIRTHDAY_MESSAGE_ES_KEY = 'birthday_whatsapp_message_es'
export const BIRTHDAY_MESSAGE_EN_KEY = 'birthday_whatsapp_message_en'

export const DEFAULT_BIRTHDAY_MESSAGE_ES =
  '¡Hola {nombre}! 🎂 Desde *Superpelu* te deseamos un feliz cumpleaños. ¡Que tengas un día maravilloso!'

export const DEFAULT_BIRTHDAY_MESSAGE_EN =
  'Hi {nombre}! 🎂 From *Superpelu* we wish you a very happy birthday. Have a wonderful day!'

export type BirthdayMessageTemplates = {
  es: string
  en: string
}

async function getSetting(key: string): Promise<string | null> {
  const rows = await sql<{ value: string }[]>`
    SELECT value FROM salon_settings WHERE key = ${key} LIMIT 1
  `
  return rows[0]?.value ?? null
}

async function setSetting(key: string, value: string): Promise<void> {
  await sql`
    INSERT INTO salon_settings (key, value, updated_at)
    VALUES (${key}, ${value}, now())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
  `
}

export async function getBirthdayMessageTemplates(): Promise<BirthdayMessageTemplates> {
  const [es, en] = await Promise.all([
    getSetting(BIRTHDAY_MESSAGE_ES_KEY),
    getSetting(BIRTHDAY_MESSAGE_EN_KEY),
  ])
  return {
    es: es?.trim() || DEFAULT_BIRTHDAY_MESSAGE_ES,
    en: en?.trim() || DEFAULT_BIRTHDAY_MESSAGE_EN,
  }
}

export async function setBirthdayMessageTemplates(
  input: Partial<BirthdayMessageTemplates>,
): Promise<BirthdayMessageTemplates> {
  const current = await getBirthdayMessageTemplates()
  const next: BirthdayMessageTemplates = {
    es: input.es?.trim() || current.es,
    en: input.en?.trim() || current.en,
  }
  if (!next.es.includes('{nombre}') || !next.en.includes('{nombre}')) {
    throw new Error('PLANTILLA_SIN_NOMBRE')
  }
  await Promise.all([
    setSetting(BIRTHDAY_MESSAGE_ES_KEY, next.es),
    setSetting(BIRTHDAY_MESSAGE_EN_KEY, next.en),
  ])
  return next
}

export function renderBirthdayMessage(
  template: string,
  firstName: string,
): string {
  const nombre = capitalizePersonName(firstName || 'amiga/o')
  return template.replaceAll('{nombre}', nombre)
}

export async function buildBirthdayWishText(
  firstName: string,
  locale: Locale,
): Promise<string> {
  const templates = await getBirthdayMessageTemplates()
  return renderBirthdayMessage(locale === 'en' ? templates.en : templates.es, firstName)
}
