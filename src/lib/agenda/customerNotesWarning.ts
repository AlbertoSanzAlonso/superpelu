/** Acuse de observaciones de ficha durante el flujo de reserva en agenda (sesión en memoria). */

const acknowledgedByPhone = new Map<string, string>()

function keyFor(phone: string): string {
  return phone.trim()
}

export function markCustomerNotesAcknowledged(phone: string, notes: string): void {
  const key = keyFor(phone)
  const trimmed = notes.trim()
  if (!key || !trimmed) return
  acknowledgedByPhone.set(key, trimmed)
}

export function areCustomerNotesAcknowledged(phone: string, notes: string): boolean {
  const trimmed = notes.trim()
  if (!trimmed) return true
  const key = keyFor(phone)
  if (!key) return false
  return acknowledgedByPhone.get(key) === trimmed
}

export function clearCustomerNotesAcknowledgement(phone?: string): void {
  if (phone == null || phone === '') {
    acknowledgedByPhone.clear()
    return
  }
  acknowledgedByPhone.delete(keyFor(phone))
}

export function customerNotesNeedWarning(phone: string, notes: string): boolean {
  const trimmed = notes.trim()
  if (!trimmed) return false
  return !areCustomerNotesAcknowledged(phone, trimmed)
}
