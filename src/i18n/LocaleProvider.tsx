import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { getTranslation } from './translations'
import {
  DEFAULT_LOCALE,
  LOCALE_STORAGE_KEY,
  detectBrowserLocale,
  isLocale,
  type Locale,
} from './types'

type LocaleContextValue = {
  locale: Locale
  setLocale: (locale: Locale) => void
}

const LocaleContext = createContext<LocaleContextValue | null>(null)

function readStoredLocale(): Locale {
  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY)
    if (stored && isLocale(stored)) return stored
  } catch {
    /* private browsing */
  }
  return detectBrowserLocale()
}

function applyDocumentLocale(locale: Locale) {
  document.documentElement.lang = locale
  const t = getTranslation(locale)
  document.title = t.meta.title
  const description = document.querySelector('meta[name="description"]')
  description?.setAttribute('content', t.meta.description)
  const ogTitle = document.querySelector('meta[property="og:title"]')
  ogTitle?.setAttribute('content', t.meta.title)
  const ogDescription = document.querySelector('meta[property="og:description"]')
  ogDescription?.setAttribute('content', t.meta.description)
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => readStoredLocale())

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next)
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, next)
    } catch {
      /* private browsing */
    }
  }, [])

  useEffect(() => {
    applyDocumentLocale(locale)
  }, [locale])

  const value = useMemo(() => ({ locale, setLocale }), [locale, setLocale])

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
}

export function useLocaleContext(): LocaleContextValue {
  const ctx = useContext(LocaleContext)
  if (!ctx) {
    return {
      locale: DEFAULT_LOCALE,
      setLocale: () => {},
    }
  }
  return ctx
}
