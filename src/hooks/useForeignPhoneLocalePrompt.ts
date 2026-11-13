import type { Locale } from '@/i18n/types'
import { isForeignPhoneLocalePromptSuppressed } from '@/lib/agenda/foreignPhoneLocalePrompt'
import { isInternationalPhone } from '@/lib/customer/phone'

/** Número extranjero y contexto aún en español → conviene preguntar idioma de avisos. */
export function shouldAskForeignPhoneLocale(phone: string, locale: Locale): boolean {
  return isInternationalPhone(phone) && locale !== 'en'
}

/** Igual que arriba, pero respeta «No volver a preguntar» de la agenda. */
export function shouldAskForeignPhoneLocaleInAgenda(phone: string, locale: Locale): boolean {
  if (isForeignPhoneLocalePromptSuppressed()) return false
  return shouldAskForeignPhoneLocale(phone, locale)
}
