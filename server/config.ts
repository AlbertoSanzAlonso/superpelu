import { bookableServices } from '../src/data/bookableServices.ts'

export { bookableServices }

export const schedule = {
  slotMinutes: 30,
  /** 0 = domingo … 6 = sábado */
  openDays: [2, 3, 4, 5, 6],
  openTime: '10:00',
  closeTime: '20:00',
  maxDaysAhead: 60,
} as const

export function getService(id: string) {
  return bookableServices.find((s) => s.id === id)
}
