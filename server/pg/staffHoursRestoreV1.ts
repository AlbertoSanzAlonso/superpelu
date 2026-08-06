import type { SalonTimeRange } from '@/data/schedule'

/**
 * Datos de recuperación puntual (v1) tras un sync erróneo que copió el horario
 * del salón a todo el personal. Se aplica una sola vez vía `salon_settings`.
 *
 * La fuente de verdad operativa es `staff_availability` (editable en `/horarios`).
 * No reutilizar este mapa para sync continuo.
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
