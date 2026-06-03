import { salonSchedule, salonWindowsForDayOfWeek, type SalonTimeRange } from './schedule'

export type SalonStaffMember = {
  id: string
  name: string
  role: string
  phone: string
  email: string
  sortOrder: number
  /** Contraseña inicial (se guarda hasheada en SQLite). Cambiar en producción. */
  password: string
  weeklyHours?: Partial<Record<number, readonly SalonTimeRange[]>>
}

/** Personal del salón — orden de la web (Susana → … → Sol). */
export const salonStaffMembers: SalonStaffMember[] = [
  {
    id: 'susana',
    name: 'Susana',
    role: 'Profesional',
    phone: '',
    email: '',
    sortOrder: 0,
    password: 'Superpelu2026',
  },
  {
    id: 'monica',
    name: 'Mónica',
    role: 'Profesional',
    phone: '',
    email: '',
    sortOrder: 1,
    password: 'Superpelu2026',
  },
  {
    id: 'andrea',
    name: 'Andrea',
    role: 'Profesional',
    phone: '',
    email: '',
    sortOrder: 2,
    password: 'Superpelu2026',
  },
  {
    id: 'olga',
    name: 'Olga',
    role: 'Profesional',
    phone: '',
    email: '',
    sortOrder: 3,
    password: 'Superpelu2026',
  },
  {
    id: 'sol',
    name: 'Sol',
    role: 'Profesional',
    phone: '',
    email: '',
    sortOrder: 4,
    password: 'Superpelu2026',
  },
]

/** IDs del personal de prueba anterior (se desactivan al sincronizar). */
export const legacyMockStaffIds = ['maria-garcia', 'lucia-ruiz', 'paula-mendez'] as const

export function defaultWeeklyHoursForStaff(): Partial<Record<number, readonly SalonTimeRange[]>> {
  const hours: Partial<Record<number, readonly SalonTimeRange[]>> = {}
  for (const day of salonSchedule.openDays) {
    const ranges = salonWindowsForDayOfWeek(day)
    if (ranges.length > 0) hours[day] = ranges
  }
  return hours
}
