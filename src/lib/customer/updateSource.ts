/** Origen del último cambio en la ficha de cliente. */
export const CUSTOMER_UPDATE_SOURCES = {
  booking_page: 'booking_page',
  agenda: 'agenda',
  customers: 'customers',
  review_request: 'review_request',
  birthday: 'birthday',
} as const

export type CustomerUpdateSource =
  (typeof CUSTOMER_UPDATE_SOURCES)[keyof typeof CUSTOMER_UPDATE_SOURCES]

export function normalizeCustomerUpdateSource(
  value: unknown,
): CustomerUpdateSource | null {
  if (
    value === 'booking_page' ||
    value === 'agenda' ||
    value === 'customers' ||
    value === 'review_request' ||
    value === 'birthday'
  ) {
    return value
  }
  return null
}

export function customerUpdateSourceLabel(
  source: string | null | undefined,
): string {
  switch (normalizeCustomerUpdateSource(source)) {
    case 'booking_page':
      return 'Reserva web'
    case 'agenda':
      return 'Agenda'
    case 'customers':
      return 'Panel clientes'
    case 'review_request':
      return 'Valoración WhatsApp'
    case 'birthday':
      return 'Cumpleaños'
    default:
      return '—'
  }
}
