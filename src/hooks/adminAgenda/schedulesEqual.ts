import type { StaffDaySchedule } from '@/types/booking'

/** Evita re-render del calendario si el polling devuelve los mismos datos. */
export function schedulesEqual(a: StaffDaySchedule[], b: StaffDaySchedule[]): boolean {
  if (a === b) return true
  if (a.length !== b.length) return false
  return JSON.stringify(a) === JSON.stringify(b)
}
