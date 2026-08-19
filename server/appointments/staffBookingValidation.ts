export function staffPortalBookingHasCustomer(body: {
  customerPhone?: string
  guestCustomer?: boolean
  customerFirstName?: string
  customerName?: string
}): boolean {
  const hasName = Boolean(body.customerName?.trim() || body.customerFirstName?.trim())
  if (!hasName) return false
  if (body.guestCustomer) return true
  return Boolean(body.customerPhone?.trim())
}
