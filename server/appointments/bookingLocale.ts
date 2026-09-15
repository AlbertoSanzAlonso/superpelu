import { normalizeLocale, type Locale } from '@/i18n/types'
import { normalizePhone } from '@/lib/customer/phone'
import type { CreateAppointmentInput } from '@server/appointments/types.js'

function isSpanishStoredPhone(phone: string | null | undefined): boolean {
  if (!phone) return false
  return normalizePhone(phone).startsWith('+34')
}

/**
 * Idioma de la cita (WhatsApp, recordatorios, enlaces).
 * - Móvil +34: siempre español (no se puede colar English por la web o un flag erróneo).
 * - Resto: confirmación explícita, ficha del cliente o idioma de la web.
 */
export function resolveAppointmentLocaleForCreate(
  input: Pick<
    CreateAppointmentInput,
    | 'forStaffPortal'
    | 'returningCustomer'
    | 'updateCustomerLocale'
    | 'locale'
    | 'customerLocale'
    | 'customerPhone'
  >,
  profile: { locale?: string | null; phone?: string | null } | null | undefined,
): Locale {
  const phone = profile?.phone ?? input.customerPhone

  if (isSpanishStoredPhone(phone)) {
    return 'es'
  }

  if (input.updateCustomerLocale === true) {
    if (input.forStaffPortal) {
      return normalizeLocale(input.customerLocale ?? profile?.locale)
    }
    return normalizeLocale(input.locale)
  }

  if (input.forStaffPortal) {
    return normalizeLocale(profile?.locale ?? input.customerLocale)
  }

  if (input.returningCustomer && profile) {
    return normalizeLocale(profile.locale)
  }

  return normalizeLocale(input.locale)
}
