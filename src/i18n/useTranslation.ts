import { useMemo } from 'react'
import { useLocaleContext } from './LocaleProvider'
import { getTranslation, type Translation } from './translations'
import type { Locale } from './types'

export function useTranslation(): {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: Translation
} {
  const { locale, setLocale } = useLocaleContext()
  const t = useMemo(() => getTranslation(locale), [locale])
  return { locale, setLocale, t }
}
