export function staffPortalBookingHasCustomer(body: {
  customerPhone?: string
  guestCustomer?: boolean
  customerFirstName?: string
  customerName?: string
}): boolean {
  return staffPortalBookingMissingCustomer(body).length === 0
}

export function staffPortalBookingMissingCustomer(body: {
  customerPhone?: string
  guestCustomer?: boolean
  customerFirstName?: string
  customerName?: string
}): string[] {
  const missing: string[] = []
  const hasName = Boolean(body.customerName?.trim() || body.customerFirstName?.trim())
  if (!hasName) missing.push('nombre del cliente')
  if (!body.guestCustomer && !body.customerPhone?.trim()) {
    missing.push('teléfono')
  }
  return missing
}

/** Campos que hacen fallar el POST/PATCH de cita en agenda con 400. */
export function staffPortalAppointmentMissingFields(body: {
  staffId?: string
  serviceIds?: string[]
  serviceId?: string
  date?: string
  startTime?: string
  customerPhone?: string
  guestCustomer?: boolean
  customerFirstName?: string
  customerName?: string
  /** Si false, no exige staffId (ruta /me donde el staff es la sesión). */
  requireStaffId?: boolean
}): string[] {
  const missing: string[] = []
  const ids = body.serviceIds?.length
    ? body.serviceIds
    : body.serviceId
      ? [body.serviceId]
      : []
  if (body.requireStaffId !== false && !body.staffId?.trim()) {
    missing.push('profesional')
  }
  if (ids.length === 0) missing.push('tratamiento')
  if (!body.date?.trim()) missing.push('fecha')
  if (!body.startTime?.trim()) missing.push('hora')
  missing.push(...staffPortalBookingMissingCustomer(body))
  return missing
}

export function incompleteStaffAppointmentError(missing: string[]): string {
  if (missing.length === 0) return 'Datos incompletos'
  if (missing.length === 1) return `Falta: ${missing[0]}`
  return `Falta: ${missing.join(', ')}`
}
