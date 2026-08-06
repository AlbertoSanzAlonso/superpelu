/** E.164: + y 7–15 dígitos (código de país sin 0 inicial). */
const E164_RE = /^\+[1-9]\d{6,14}$/
/** Móvil español: +34 + 9 dígitos empezando por 6–9. */
const ES_MOBILE_RE = /^\+34[6789]\d{8}$/

function parsePhoneDigits(raw: string): {
  digits: string
  /** Prefijo explícito `+` o `00`. Sin él se asume España. */
  hadIntlPrefix: boolean
} {
  const trimmed = raw.trim()
  if (!trimmed) return { digits: '', hadIntlPrefix: false }

  const hadPlus = trimmed.startsWith('+')
  let digits = trimmed.replace(/\D/g, '')
  if (!digits) return { digits: '', hadIntlPrefix: false }

  const had00 = digits.startsWith('00')
  if (had00) digits = digits.slice(2)

  return { digits, hadIntlPrefix: hadPlus || had00 }
}

/**
 * Normaliza a E.164.
 * Sin prefijo internacional (`+` / `00`), asume móvil español (+34).
 * Con `+` / `00`, el número ya incluye el código de país.
 * También acepta `34` + 9 dígitos nacionales sin `+`/`00` (español con código de país).
 */
export function normalizePhone(raw: string): string {
  const { digits, hadIntlPrefix } = parsePhoneDigits(raw)
  if (!digits) return ''

  if (hadIntlPrefix || (digits.startsWith('34') && digits.length >= 11)) {
    return `+${digits}`
  }

  return `+34${digits}`
}

/** Móvil español en E.164. */
export function isValidSpanishPhone(raw: string): boolean {
  return ES_MOBILE_RE.test(normalizePhone(raw))
}

/**
 * Teléfono válido para citas/clientes: móvil ES o cualquier E.164 internacional.
 * Los números sin `+`/`00` se tratan como españoles (solo móviles 6–9).
 * Internacional solo con prefijo explícito distinto de España.
 */
export function isValidPhone(raw: string): boolean {
  const normalized = normalizePhone(raw)
  if (!normalized) return false
  if (ES_MOBILE_RE.test(normalized)) return true
  if (normalized.startsWith('+34')) return false
  const { hadIntlPrefix } = parsePhoneDigits(raw)
  if (!hadIntlPrefix) return false
  return E164_RE.test(normalized)
}

/**
 * Número extranjero: prefijo explícito (`+` o `00`) con código de país distinto de 34.
 * Sin prefijo → se considera español (no pide cambio de idioma).
 */
export function isInternationalPhone(raw: string): boolean {
  const { hadIntlPrefix } = parsePhoneDigits(raw)
  if (!hadIntlPrefix) return false
  const normalized = normalizePhone(raw)
  if (!normalized || !isValidPhone(raw)) return false
  return !normalized.startsWith('+34')
}

export function formatPhoneDisplay(phone: string): string {
  const n = normalizePhone(phone)
  const m = n.match(/^\+34(\d{3})(\d{2})(\d{2})(\d{2})$/)
  if (m) return `+34 ${m[1]} ${m[2]} ${m[3]} ${m[4]}`
  if (E164_RE.test(n)) return n
  return phone
}
