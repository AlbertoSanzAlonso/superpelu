import type { SalonTimeRange } from '@/data/schedule'

/**
 * Horarios de partida (una sola escritura a BD). Después solo se editan en `/horarios`.
 * No usar para sync automático en arranques posteriores.
 */
export const staffWeeklyHoursRestoreV1: Record<
  string,
  Partial<Record<number, readonly SalonTimeRange[]>>
> = {
  susana: {
    1: [{ start: '10:00', end: '15:00' }],
    2: [{ start: '10:00', end: '15:00' }],
    3: [{ start: '10:00', end: '15:00' }],
    4: [{ start: '10:00', end: '15:00' }],
    5: [{ start: '10:00', end: '15:00' }],
  },
  monica: {
    1: [{ start: '10:00', end: '14:00' }],
    2: [{ start: '10:00', end: '14:00' }],
    3: [{ start: '10:00', end: '14:00' }],
    4: [{ start: '10:00', end: '14:00' }],
    5: [{ start: '10:00', end: '14:00' }],
    6: [{ start: '10:00', end: '14:00' }],
  },
  andrea: {
    // Lunes descanso
    2: [{ start: '10:00', end: '20:00' }],
    3: [{ start: '10:00', end: '20:00' }],
    4: [{ start: '10:00', end: '20:00' }],
    5: [{ start: '10:00', end: '20:00' }],
    6: [{ start: '10:00', end: '14:00' }],
  },
  olga: {
    // Martes descanso
    1: [{ start: '16:00', end: '20:00' }],
    3: [{ start: '16:00', end: '20:00' }],
    4: [{ start: '16:00', end: '20:00' }],
    5: [{ start: '16:00', end: '20:00' }],
    6: [{ start: '10:00', end: '14:00' }],
  },
}
