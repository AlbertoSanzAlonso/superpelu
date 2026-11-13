/** Preferencia de agenda: no volver a preguntar idioma por número extranjero. */

const STORAGE_KEY = 'superpelu-agenda-skip-foreign-phone-locale'

export function isForeignPhoneLocalePromptSuppressed(): boolean {
  if (typeof localStorage === 'undefined') return false
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function suppressForeignPhoneLocalePrompt(): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, '1')
  } catch {
    /* ignore quota / private mode */
  }
}
