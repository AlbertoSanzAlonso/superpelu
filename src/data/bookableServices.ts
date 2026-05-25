/** Servicios reservables — espejo de server/config.ts para fallback en el cliente */
export const bookableServices = [
  { id: 'color', name: 'Coloración profesional', durationMinutes: 120 },
  { id: 'balayage', name: 'Balayage y mechas', durationMinutes: 150 },
  { id: 'corte', name: 'Corte y styling', durationMinutes: 45 },
  { id: 'tratamiento', name: 'Tratamientos capilares', durationMinutes: 60 },
] as const

export type BookableServiceId = (typeof bookableServices)[number]['id']
