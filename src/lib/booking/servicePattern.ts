import type { OccupiedSegment } from '@/lib/booking/occupancy'

export type ServiceBookingStep =
  | { type: 'work'; minutes: number }
  | { type: 'break'; minutes: number }

export type ServiceBookingPattern = ServiceBookingStep[]

export function parseBookingPattern(raw: unknown): ServiceBookingPattern | null {
  if (!Array.isArray(raw) || raw.length === 0) return null
  const steps: ServiceBookingStep[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') return null
    const type = (item as { type?: string }).type
    const minutes = Number((item as { minutes?: unknown }).minutes)
    if ((type !== 'work' && type !== 'break') || !Number.isFinite(minutes) || minutes < 1) {
      return null
    }
    steps.push({ type, minutes: Math.round(minutes) })
  }
  const err = validateBookingPattern(steps)
  return err ? null : steps
}

/** Patrón con pausas entre tramos (no un solo bloque continuo). */
export function isSegmentedPattern(pattern: ServiceBookingPattern | null | undefined): boolean {
  if (!pattern || pattern.length === 0) return false
  return pattern.some((step) => step.type === 'break')
}

export function patternTotalSpanMinutes(pattern: ServiceBookingPattern): number {
  return pattern.reduce((sum, step) => sum + step.minutes, 0)
}

export function patternWorkMinutes(pattern: ServiceBookingPattern): number {
  return pattern
    .filter((step): step is { type: 'work'; minutes: number } => step.type === 'work')
    .reduce((sum, step) => sum + step.minutes, 0)
}

export function patternToOccupiedSegments(
  pattern: ServiceBookingPattern,
  startMinutes: number,
): OccupiedSegment[] {
  const segments: OccupiedSegment[] = []
  let cursor = startMinutes
  for (const step of pattern) {
    if (step.type === 'work') {
      segments.push({ startMinutes: cursor, durationMinutes: step.minutes })
    }
    cursor += step.minutes
  }
  return segments
}

export function validateBookingPattern(pattern: ServiceBookingPattern): string | null {
  if (pattern.length === 0) return 'Añade al menos un tramo'
  if (pattern[0].type !== 'work') return 'El patrón debe empezar con un tramo'
  if (pattern[pattern.length - 1].type !== 'work') return 'El patrón debe terminar con un tramo'
  for (const step of pattern) {
    if (!Number.isFinite(step.minutes) || step.minutes < 1) return 'Cada tramo o descanso debe durar al menos 1 min'
  }
  for (let i = 1; i < pattern.length; i++) {
    if (pattern[i].type === pattern[i - 1].type) {
      return 'Alterna tramos de trabajo y descansos'
    }
  }
  return null
}

/** Guarda null si es un solo tramo sin pausas. */
export function normalizeBookingPattern(
  pattern: ServiceBookingPattern | null | undefined,
): ServiceBookingPattern | null {
  if (!pattern || pattern.length === 0) return null
  const err = validateBookingPattern(pattern)
  if (err) return null
  if (!isSegmentedPattern(pattern)) return null
  return pattern
}

export function formatPatternSummary(pattern: ServiceBookingPattern): string {
  const parts: string[] = []
  for (const step of pattern) {
    if (step.type === 'work') {
      parts.push(`${step.minutes} min`)
    } else {
      parts.push(`pausa ${step.minutes} min`)
    }
  }
  return parts.join(' + ')
}

export function defaultBookingPattern(durationMinutes = 30): ServiceBookingPattern {
  return [{ type: 'work', minutes: durationMinutes }]
}
