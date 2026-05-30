import type { BookableService } from '@/types/booking'
import { normalizeLocale, type Locale } from './types'

/** Helpers i18n sin assets Vite — seguros para importar desde `server/`. */
export function serviceDisplayName(
  service: Pick<BookableService, 'nameEs' | 'nameEn'>,
  locale: Locale,
): string {
  return locale === 'en' ? service.nameEn : service.nameEs
}

export function appointmentLocale(row: { locale?: string | null }): Locale {
  return normalizeLocale(row.locale)
}
