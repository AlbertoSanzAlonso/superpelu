import { randomInt } from 'node:crypto'
import { GUEST_PHONE_PREFIX } from '@/lib/customer/guestPhone'

/** Teléfono único solo para la cita; no se persiste en `customers`. */
export function generateGuestCustomerPhone(): string {
  const suffix = String(randomInt(0, 100_000_000)).padStart(8, '0')
  return `${GUEST_PHONE_PREFIX}${suffix}`
}
