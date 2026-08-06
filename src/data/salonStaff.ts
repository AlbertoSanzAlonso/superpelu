import { salonSchedule, salonWindowsForDayOfWeek, type SalonTimeRange } from './schedule'

export type SalonStaffMember = {
  id: string
  name: string
  role: string
  phone: string
  email: string
  sortOrder: number
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
  },
  {
    id: 'monica',
    name: 'Mónica',
    role: 'Profesional',
    phone: '',
    email: '',
    sortOrder: 1,
  },
  {
    id: 'andrea',
    name: 'Andrea',
    role: 'Profesional',
    phone: '',
    email: '',
    sortOrder: 2,
  },
  {
    id: 'olga',
    name: 'Olga',
    role: 'Profesional',
    phone: '',
    email: '',
    sortOrder: 3,
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

/** Solo para sembrar `staff_availability` si está vacía (instalación nueva). Luego manda `/horarios` → BD. */
export function defaultWeeklyHoursForStaff(): Partial<Record<number, readonly SalonTimeRange[]>> {
  const hours: Partial<Record<number, readonly SalonTimeRange[]>> = {}
  for (const day of salonSchedule.openDays) {
    const ranges = salonWindowsForDayOfWeek(day)
    if (ranges.length > 0) hours[day] = ranges
  }
  return hours
}
