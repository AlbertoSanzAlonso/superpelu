import { salonSchedule, salonWindowsForDayOfWeek, type SalonTimeRange } from './schedule'

export type SalonStaffMember = {
  id: string
  name: string
  role: string
  phone: string
  email: string
  sortOrder: number
  /**
   * Horario semanal por defecto (solo primer seed / restauración puntual).
   * Tras editar en `/horarios`, la BD es la fuente de verdad y el arranque no la pisa.
   * 0 = domingo … 6 = sábado. Días omitidos = descanso.
   */
  weeklyHours?: Partial<Record<number, readonly SalonTimeRange[]>>
}

/** Personal del salón — orden de la web (Susana → … → Inma). */
export const salonStaffMembers: SalonStaffMember[] = [
  {
    id: 'susana',
    name: 'Susana',
    role: 'Profesional',
    phone: '',
    email: '',
    sortOrder: 0,
    weeklyHours: {
      1: [{ start: '10:00', end: '15:00' }],
      2: [{ start: '10:00', end: '15:00' }],
      3: [{ start: '10:00', end: '15:00' }],
      4: [{ start: '10:00', end: '15:00' }],
      5: [{ start: '10:00', end: '15:00' }],
    },
  },
  {
    id: 'monica',
    name: 'Mónica',
    role: 'Profesional',
    phone: '',
    email: '',
    sortOrder: 1,
    weeklyHours: {
      1: [{ start: '10:00', end: '14:00' }],
      2: [{ start: '10:00', end: '14:00' }],
      3: [{ start: '10:00', end: '14:00' }],
      4: [{ start: '10:00', end: '14:00' }],
      5: [{ start: '10:00', end: '14:00' }],
      6: [{ start: '10:00', end: '14:00' }],
    },
  },
  {
    id: 'andrea',
    name: 'Andrea',
    role: 'Profesional',
    phone: '',
    email: '',
    sortOrder: 2,
    // Lunes descanso
    weeklyHours: {
      2: [{ start: '10:00', end: '20:00' }],
      3: [{ start: '10:00', end: '20:00' }],
      4: [{ start: '10:00', end: '20:00' }],
      5: [{ start: '10:00', end: '20:00' }],
      6: [{ start: '10:00', end: '14:00' }],
    },
  },
  {
    id: 'olga',
    name: 'Olga',
    role: 'Profesional',
    phone: '',
    email: '',
    sortOrder: 3,
    // Martes descanso
    weeklyHours: {
      1: [{ start: '16:00', end: '20:00' }],
      3: [{ start: '16:00', end: '20:00' }],
      4: [{ start: '16:00', end: '20:00' }],
      5: [{ start: '16:00', end: '20:00' }],
      6: [{ start: '10:00', end: '14:00' }],
    },
  },
  {
    id: 'inma',
    name: 'Inma',
    role: 'Profesional',
    phone: '',
    email: '',
    sortOrder: 4,
  },
]

/** IDs del personal anterior (se desactivan al sincronizar). */
export const legacyMockStaffIds = ['maria-garcia', 'lucia-ruiz', 'paula-mendez', 'sol'] as const

export function defaultWeeklyHoursForStaff(): Partial<Record<number, readonly SalonTimeRange[]>> {
  const hours: Partial<Record<number, readonly SalonTimeRange[]>> = {}
  for (const day of salonSchedule.openDays) {
    const ranges = salonWindowsForDayOfWeek(day)
    if (ranges.length > 0) hours[day] = ranges
  }
  return hours
}
