import { serviceDisplayName } from '@/i18n/localeHelpers'
import { normalizeLocale, type Locale } from '@/i18n/types'
import { isGuestCustomerPhone } from '@/lib/customer/guestPhone'
import { normalizePhone } from '@/lib/customer/phone'
import type { CreateAppointmentInput } from '@server/appointments/types.js'
import { getService } from '@server/catalog/services.js'
import { sql } from '@server/db.js'
import type { AppointmentRow } from '@server/pg/types.js'

function isSpanishStoredPhone(phone: string | null | undefined): boolean {
  if (!phone) return false
  return normalizePhone(phone).startsWith('+34')
}

/**
 * Idioma de WhatsApp, recordatorios y páginas /c /m: el de la ficha del cliente.
 * Si no hay ficha (invitado o teléfono huérfano), se usa el de la cita.
 */
export async function resolveCustomerFacingLocale(
  phone: string | null | undefined,
  fallback?: string | null,
): Promise<Locale> {
  if (phone && !isGuestCustomerPhone(phone)) {
    const normalized = normalizePhone(phone)
    if (normalized) {
      const rows = await sql<{ locale: string | null }[]>`
        SELECT locale FROM customers WHERE phone = ${normalized}
      `
      if (rows[0]) return normalizeLocale(rows[0].locale)
    }
  }
  return normalizeLocale(fallback)
}

/**
 * Copia las citas con `locale` y nombres de servicio en el idioma de la ficha.
 * Así un WhatsApp no se queda en inglés si la cita se creó mal y el cliente está en español.
 */
export async function localizeAppointmentsForCustomer(
  rows: AppointmentRow[],
  locale?: Locale,
): Promise<AppointmentRow[]> {
  if (rows.length === 0) return rows
  const resolved =
    locale ?? (await resolveCustomerFacingLocale(rows[0]!.customer_phone, rows[0]!.locale))
  return Promise.all(
    rows.map(async (row) => {
      const service = await getService(row.service_id, { onlineOnly: false })
      const serviceName = service ? serviceDisplayName(service, resolved) : row.service_name
      return { ...row, locale: resolved, service_name: serviceName }
    }),
  )
}

/**
 * Idioma de la cita al crear (snapshot).
 * - Móvil +34: siempre español (no se puede colar English por la web o un flag erróneo).
 * - Resto: confirmación explícita, ficha del cliente o idioma de la web.
 * WhatsApp no usa este snapshot: usa `resolveCustomerFacingLocale`.
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
