import { isGuestCustomerPhone } from '@/lib/customer/guestPhone'
import { isValidPhone } from '@/lib/customer/phone'

/** Agenda: nombre indicado y sin móvil → conviene confirmar cliente sin ficha. */
export function shouldAskGuestCustomer(
  phone: string,
  firstName: string,
  options?: { editingExistingGuest?: boolean },
): boolean {
  if (options?.editingExistingGuest) return false
  return Boolean(firstName.trim()) && !phone.trim()
}

export function isEditingGuestAppointment(phone: string): boolean {
  return isGuestCustomerPhone(phone)
}

export type GuestCustomerPromptOptions = {
  phone: string
  firstName: string
  editingPhone?: string
}

export function shouldPromptGuestCustomer({
  phone,
  firstName,
  editingPhone,
}: GuestCustomerPromptOptions): boolean {
  if (editingPhone && isGuestCustomerPhone(editingPhone)) return false
  return shouldAskGuestCustomer(phone, firstName)
}

/** Cita invitada a la que se le añade móvil → crear ficha en clientes. */
export function shouldPromptGuestToCustomerConversion(
  existingGuestPhone: string | null,
  newPhone: string,
): boolean {
  if (!existingGuestPhone || !isGuestCustomerPhone(existingGuestPhone)) return false
  return isValidPhone(newPhone)
}
