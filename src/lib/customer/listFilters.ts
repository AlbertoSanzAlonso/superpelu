import { salonSchedule } from '@/data/schedule'
import { normalizeLocale, type Locale } from '@/i18n/types'
import { addDaysToDateString, todaySalon } from '@/lib/core/dates'
import { normalizePhone } from '@/lib/customer/phone'
import type { Customer } from '@/types/customers'

export type CustomerLocaleFilter = 'all' | Locale
export type CustomerPhoneRegionFilter = 'all' | 'es' | 'intl'
export type CustomerUpdatedFilter = 'all' | 'today' | '7d' | '30d'

export const CUSTOMER_LOCALE_FILTER_OPTIONS: {
  value: CustomerLocaleFilter
  label: string
}[] = [
  { value: 'all', label: 'Idioma: todos' },
  { value: 'es', label: 'Español' },
  { value: 'en', label: 'English' },
]

export const CUSTOMER_PHONE_REGION_FILTER_OPTIONS: {
  value: CustomerPhoneRegionFilter
  label: string
}[] = [
  { value: 'all', label: 'Teléfono: todos' },
  { value: 'es', label: 'Español (+34)' },
  { value: 'intl', label: 'Extranjero' },
]

export const CUSTOMER_UPDATED_FILTER_OPTIONS: {
  value: CustomerUpdatedFilter
  label: string
}[] = [
  { value: 'all', label: 'Actualización: todas' },
  { value: 'today', label: 'Actualizados hoy' },
  { value: '7d', label: 'Últimos 7 días' },
  { value: '30d', label: 'Últimos 30 días' },
]

/** Número español guardado (E.164 con +34), incl. fijos/invitados internos. */
export function isSpanishStoredPhone(phone: string): boolean {
  const normalized = normalizePhone(phone)
  return Boolean(normalized && normalized.startsWith('+34'))
}

/** Fecha de calendario (YYYY-MM-DD) de un ISO en zona del salón. */
export function salonDateFromIso(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: salonSchedule.timezone,
  }).format(new Date(iso))
}

function updatedFilterDays(filter: CustomerUpdatedFilter): number | null {
  if (filter === 'today') return 1
  if (filter === '7d') return 7
  if (filter === '30d') return 30
  return null
}

export function isCustomerUpdatedRecently(
  updatedAt: string,
  filter: CustomerUpdatedFilter,
): boolean {
  const days = updatedFilterDays(filter)
  if (days == null) return true
  const updatedDay = salonDateFromIso(updatedAt)
  const today = todaySalon()
  const oldest = addDaysToDateString(today, -(days - 1))
  return updatedDay >= oldest && updatedDay <= today
}

export function filterCustomerList(
  customers: Customer[],
  options: {
    locale?: CustomerLocaleFilter
    phoneRegion?: CustomerPhoneRegionFilter
    updated?: CustomerUpdatedFilter
  } = {},
): Customer[] {
  const locale = options.locale ?? 'all'
  const phoneRegion = options.phoneRegion ?? 'all'
  const updated = options.updated ?? 'all'

  return customers.filter((customer) => {
    if (locale !== 'all' && normalizeLocale(customer.locale) !== locale) {
      return false
    }
    if (phoneRegion === 'es' && !isSpanishStoredPhone(customer.phone)) {
      return false
    }
    if (phoneRegion === 'intl' && isSpanishStoredPhone(customer.phone)) {
      return false
    }
    if (updated !== 'all' && !isCustomerUpdatedRecently(customer.updatedAt, updated)) {
      return false
    }
    return true
  })
}
