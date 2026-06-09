import type { SalonTimeRange } from '@/data/schedule'

export type WorkTimeWindow = { startTime: string; endTime: string }

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

export function rangesToWorkWindows(ranges: readonly SalonTimeRange[]): WorkTimeWindow[] {
  return ranges.map((r) => ({ startTime: r.start, endTime: r.end }))
}

export function formatWorkWindowsLabel(windows: WorkTimeWindow[]): string {
  return windows.map((w) => `${w.startTime}–${w.endTime}`).join(' · ')
}

/** Comprueba que un tramo [start, start+duration) cabe entero en alguna franja laboral. */
export function segmentFitsInWorkWindows(
  startMinutes: number,
  durationMinutes: number,
  windows: WorkTimeWindow[],
): boolean {
  const endMinutes = startMinutes + durationMinutes
  return windows.some((w) => {
    const wStart = timeToMinutes(w.startTime)
    const wEnd = timeToMinutes(w.endTime)
    return startMinutes >= wStart && endMinutes <= wEnd
  })
}

/** Inicio de franja de slot (p. ej. 14:00–14:30) dentro del horario de trabajo. */
export function slotStartInWorkWindows(
  time: string,
  slotMinutes: number,
  windows: WorkTimeWindow[],
): boolean {
  return segmentFitsInWorkWindows(timeToMinutes(time), slotMinutes, windows)
}

/** Fondo de celdas fuera de horario en la agenda (comida, tarde sábado, domingo). */
export const agendaClosedSlotClassName =
  'border-b border-charcoal/15 bg-charcoal/[0.14]'

/** Fondo de celdas laborables en la rejilla del calendario admin. */
export const agendaOpenSlotClassName =
  'border-b border-gold/10 bg-[repeating-linear-gradient(-45deg,transparent,transparent_4px,rgba(201,169,98,0.04)_4px,rgba(201,169,98,0.04)_8px)]'
