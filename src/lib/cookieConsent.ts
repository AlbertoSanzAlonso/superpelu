export type CookieConsentChoice = 'accepted' | 'necessary'

export type CookieConsentRecord = {
  choice: CookieConsentChoice
  /** ISO timestamp when the choice was saved */
  at: string
  version: 1
}

export const COOKIE_CONSENT_STORAGE_KEY = 'superpelu.cookieConsent'

/** Rutas donde el banner de cookies debe mostrarse (no en admin ni en la propia política). */
const COOKIE_BANNER_PATHS = ['/', '/salon', '/reservar'] as const

export function shouldShowCookieConsentBanner(pathname: string): boolean {
  return COOKIE_BANNER_PATHS.some(
    (path) => pathname === path || (path !== '/' && pathname.startsWith(`${path}/`)),
  )
}

export function readCookieConsent(): CookieConsentRecord | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<CookieConsentRecord>
    if (parsed.choice !== 'accepted' && parsed.choice !== 'necessary') return null
    if (parsed.version !== 1 || typeof parsed.at !== 'string') return null
    return { choice: parsed.choice, at: parsed.at, version: 1 }
  } catch {
    return null
  }
}

export function writeCookieConsent(choice: CookieConsentChoice): CookieConsentRecord {
  const record: CookieConsentRecord = {
    choice,
    at: new Date().toISOString(),
    version: 1,
  }
  try {
    localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, JSON.stringify(record))
  } catch {
    /* private browsing */
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('superpelu:cookie-consent', { detail: record }))
  }
  return record
}

export function hasAcceptedThirdPartyCookies(consent = readCookieConsent()): boolean {
  return consent?.choice === 'accepted'
}
