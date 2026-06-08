import { getTranslation } from './translations'
import { normalizeLocale, type Locale } from './types'

/** Mensajes de error de reserva/gestión pública por código (ES/EN). */
export function publicAppointmentErrorMessage(code: string, locale: Locale): string | undefined {
  const t = getTranslation(normalizeLocale(locale))
  const combined: Record<string, string> = {
    ...t.customerPages.errors,
    ...t.booking.apiErrors,
  }
  return combined[code]
}

export function publicAppointmentErrorMessageOrFallback(
  code: string,
  locale: Locale,
): string {
  const t = getTranslation(normalizeLocale(locale))
  return publicAppointmentErrorMessage(code, locale) ?? t.booking.apiErrors.CREATE_FAILED
}
