export type Locale = 'es' | 'en'

export const LOCALES: Locale[] = ['es', 'en']

export const DEFAULT_LOCALE: Locale = 'es'

export const LOCALE_STORAGE_KEY = 'superpelu-locale'

export function isLocale(value: string): value is Locale {
  return value === 'es' || value === 'en'
}

export function detectBrowserLocale(): Locale {
  if (typeof navigator === 'undefined') return DEFAULT_LOCALE
  const lang = navigator.language.toLowerCase()
  if (lang.startsWith('en')) return 'en'
  return DEFAULT_LOCALE
}

export function localeToBcp47(locale: Locale): string {
  return locale === 'en' ? 'en-GB' : 'es-ES'
}

export function normalizeLocale(value: unknown): Locale {
  return value === 'en' ? 'en' : 'es'
}
