/** Horario del salón — compartido entre cliente y servidor */
export const salonSchedule = {
  slotMinutes: 30,
  /** 0 = domingo … 6 = sábado */
  openDays: [2, 3, 4, 5, 6],
  openTime: '10:00',
  closeTime: '20:00',
  maxDaysAhead: 60,
  timezone: 'Europe/Madrid',
} as const
