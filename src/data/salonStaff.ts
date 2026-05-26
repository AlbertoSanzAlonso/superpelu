import { salonSchedule } from './schedule'

export type SalonStaffMember = {
  id: string
  name: string
  role: string
  phone: string
  email: string
  sortOrder: number
  /** Contraseña inicial (se guarda hasheada en SQLite). Cambiar en producción. */
  password: string
  weeklyHours?: Partial<Record<number, { start: string; end: string }>>
}

/** Personal del salón — orden de la web (Susana → Mónica → Andrea → Olga). */
export const salonStaffMembers: SalonStaffMember[] = [
  {
    id: 'susana',
    name: 'Susana',
    role: 'Profesional',
    phone: '',
    email: '',
    sortOrder: 0,
    password: 'Pelu-Susana26',
  },
  {
    id: 'monica',
    name: 'Mónica',
    role: 'Profesional',
    phone: '',
    email: '',
    sortOrder: 1,
    password: 'Pelu-Monica26',
  },
  {
    id: 'andrea',
    name: 'Andrea',
    role: 'Profesional',
    phone: '',
    email: '',
    sortOrder: 2,
    password: 'Pelu-Andrea26',
  },
  {
    id: 'olga',
    name: 'Olga',
    role: 'Profesional',
    phone: '',
    email: '',
    sortOrder: 3,
    password: 'Pelu-Olga26',
  },
]

/** IDs del personal de prueba anterior (se desactivan al sincronizar). */
export const legacyMockStaffIds = ['maria-garcia', 'lucia-ruiz', 'paula-mendez'] as const

export function defaultWeeklyHoursForStaff(): Partial<Record<number, { start: string; end: string }>> {
  const hours: Partial<Record<number, { start: string; end: string }>> = {}
  for (const day of salonSchedule.openDays) {
    hours[day] = { start: salonSchedule.openTime, end: salonSchedule.closeTime }
  }
  return hours
}
