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
