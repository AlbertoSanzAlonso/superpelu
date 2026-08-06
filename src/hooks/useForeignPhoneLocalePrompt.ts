import type { Locale } from '@/i18n/types'
import { isInternationalPhone } from '@/lib/customer/phone'

/** Número extranjero y contexto aún en español → conviene preguntar idioma de avisos. */
export function shouldAskForeignPhoneLocale(phone: string, locale: Locale): boolean {
  return isInternationalPhone(phone) && locale !== 'en'
}
