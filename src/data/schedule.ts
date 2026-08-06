/** Horario del salón — compartido entre cliente y servidor */
export type SalonTimeRange = { start: string; end: string }

export const salonSchedule = {
  slotMinutes: 30,
  /** 0 = domingo … 6 = sábado (domingo cerrado) */
  openDays: [1, 2, 3, 4, 5, 6],
  /** Franja visual máxima (agenda admin) */
  openTime: '10:00',
  closeTime: '20:00',
  maxDaysAhead: 60,
  timezone: 'Europe/Madrid',
  /** Franjas laborables por día de la semana */
  weeklyWindows: {
    1: [
      { start: '10:00', end: '14:00' },
      { start: '16:00', end: '20:00' },
    ],
    2: [
      { start: '10:00', end: '14:30' },
      { start: '15:30', end: '20:00' },
    ],
    3: [
      { start: '10:00', end: '14:30' },
      { start: '15:30', end: '20:00' },
    ],
    4: [
      { start: '10:00', end: '14:30' },
      { start: '15:30', end: '20:00' },
    ],
    5: [
      { start: '10:00', end: '14:30' },
      { start: '15:30', end: '20:00' },
    ],
    6: [{ start: '10:00', end: '14:00' }],
  } as const satisfies Record<number, readonly SalonTimeRange[]>,
} as const

export function salonWindowsForDayOfWeek(dayOfWeek: number): readonly SalonTimeRange[] {
  return salonSchedule.weeklyWindows[dayOfWeek as keyof typeof salonSchedule.weeklyWindows] ?? []
}
