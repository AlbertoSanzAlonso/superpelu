import { formatPhoneDisplay, normalizePhone } from '@/lib/customer/phone'

/** Prefijo interno para citas sin móvil real (no se guarda ficha en `customers`). */
export const GUEST_PHONE_PREFIX = '+349990'

export function isGuestCustomerPhone(phone: string): boolean {
  const normalized = normalizePhone(phone)
  return Boolean(normalized && normalized.startsWith(GUEST_PHONE_PREFIX))
}

export function guestPhoneDisplayLabel(): string {
  return 'Sin teléfono'
}

export function formatCustomerPhoneDisplay(phone: string): string {
  if (!phone.trim() || isGuestCustomerPhone(phone)) return guestPhoneDisplayLabel()
  return formatPhoneDisplay(phone)
}
