/** Normaliza teléfonos españoles a E.164 (+34…). */
export function normalizePhone(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''

  let digits = trimmed.replace(/\D/g, '')
  if (!digits) return ''

  if (digits.startsWith('0034')) {
    digits = digits.slice(2)
  }
  if (digits.startsWith('34') && digits.length >= 11) {
    return `+${digits}`
  }
  if (digits.length === 9 && /^[6789]/.test(digits)) {
    return `+34${digits}`
  }
  if (digits.length > 9) {
    return `+${digits}`
  }
  return `+34${digits}`
}

export function isValidSpanishPhone(raw: string): boolean {
  const normalized = normalizePhone(raw)
  return /^\+34[6789]\d{8}$/.test(normalized)
}

export function formatPhoneDisplay(phone: string): string {
  const n = normalizePhone(phone)
  const m = n.match(/^\+34(\d{3})(\d{2})(\d{2})(\d{2})$/)
  if (m) return `+34 ${m[1]} ${m[2]} ${m[3]} ${m[4]}`
  return phone
}
