/** E.164: + y 7–15 dígitos (código de país sin 0 inicial). */
const E164_RE = /^\+[1-9]\d{6,14}$/
/** Móvil español: +34 + 9 dígitos empezando por 6–9. */
const ES_MOBILE_RE = /^\+34[6789]\d{8}$/

/**
 * Normaliza a E.164.
 * Sin prefijo internacional (`+` / `00`), asume móvil español (+34).
 */
export function normalizePhone(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''

  const hadPlus = trimmed.startsWith('+')
  let digits = trimmed.replace(/\D/g, '')
  if (!digits) return ''

  if (digits.startsWith('00')) {
    digits = digits.slice(2)
  }

  // Código de país presente: +…, 00…, o 34 + 9 dígitos nacionales
  if (
    hadPlus ||
    (digits.startsWith('34') && digits.length >= 11) ||
    digits.length > 9
  ) {
    return `+${digits}`
  }

  // 9 dígitos (u otros cortos) → España
  return `+34${digits}`
}

/** Móvil español en E.164. */
export function isValidSpanishPhone(raw: string): boolean {
  return ES_MOBILE_RE.test(normalizePhone(raw))
}

/**
 * Teléfono válido para citas/clientes: móvil ES o cualquier E.164 internacional.
 * Los números españoles sin `+`/`00` siguen siendo solo móviles (6–9).
 */
export function isValidPhone(raw: string): boolean {
  const normalized = normalizePhone(raw)
  if (!normalized) return false
  if (ES_MOBILE_RE.test(normalized)) return true
  if (normalized.startsWith('+34')) return false
  return E164_RE.test(normalized)
}

export function formatPhoneDisplay(phone: string): string {
  const n = normalizePhone(phone)
  const m = n.match(/^\+34(\d{3})(\d{2})(\d{2})(\d{2})$/)
  if (m) return `+34 ${m[1]} ${m[2]} ${m[3]} ${m[4]}`
  if (E164_RE.test(n)) return n
  return phone
}
