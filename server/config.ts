export const bookableServices = [
  { id: 'color', name: 'Coloración profesional', durationMinutes: 120 },
  { id: 'balayage', name: 'Balayage y mechas', durationMinutes: 150 },
  { id: 'corte', name: 'Corte y styling', durationMinutes: 45 },
  { id: 'tratamiento', name: 'Tratamientos capilares', durationMinutes: 60 },
] as const

export type ServiceId = (typeof bookableServices)[number]['id']

export const schedule = {
  slotMinutes: 30,
  /** 0 = domingo … 6 = sábado */
  openDays: [2, 3, 4, 5, 6],
  openTime: '10:00',
  closeTime: '20:00',
  maxDaysAhead: 60,
} as const

export function getService(id: string) {
  return bookableServices.find((s) => s.id === id)
}
