import type { OccupiedSegment } from '@/lib/booking/occupancy'

export type TrailingWhenReplaced = 'discard' | 'afterReplacement'

export type ServiceBookingWorkStep = {
  type: 'work'
  minutes: number
  nameEs?: string
  nameEn?: string
  /** Si true, este tramo no se crea cuando hay otro tratamiento de peluquería después. */
  replaceableByNext?: boolean
  /**
   * Qué hacer con los tramos de trabajo posteriores si este se sustituye.
   * Solo aplica si hay más work después del sustituible.
   */
  trailingWhenReplaced?: TrailingWhenReplaced
}

export type ServiceBookingBreakStep = {
  type: 'break'
  minutes: number
}

export type ServiceBookingStep = ServiceBookingWorkStep | ServiceBookingBreakStep

export type ServiceBookingPattern = ServiceBookingStep[]

function optionalTrimmedString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed ? trimmed : undefined
}

/** Deshace booking_pattern guardado como string JSONB (bug antiguo del PATCH admin). */
function coerceBookingPatternRaw(raw: unknown): unknown {
  let value = raw
  for (let i = 0; i < 3; i++) {
    if (Array.isArray(value)) return value
    if (typeof value !== 'string') return value
    const trimmed = value.trim()
    if (!trimmed) return value
    try {
      value = JSON.parse(trimmed)
    } catch {
      return value
    }
  }
  return value
}

export function parseBookingPattern(raw: unknown): ServiceBookingPattern | null {
  const coerced = coerceBookingPatternRaw(raw)
  if (!Array.isArray(coerced) || coerced.length === 0) return null
  const steps: ServiceBookingStep[] = []
  for (const item of coerced) {
    if (!item || typeof item !== 'object') return null
    const type = (item as { type?: string }).type
    const minutes = Number((item as { minutes?: unknown }).minutes)
    if ((type !== 'work' && type !== 'break') || !Number.isFinite(minutes) || minutes < 1) {
      return null
    }
    if (type === 'break') {
      steps.push({ type: 'break', minutes: Math.round(minutes) })
      continue
    }
    const step: ServiceBookingWorkStep = {
      type: 'work',
      minutes: Math.round(minutes),
    }
    const nameEs = optionalTrimmedString((item as { nameEs?: unknown }).nameEs)
    const nameEn = optionalTrimmedString((item as { nameEn?: unknown }).nameEn)
    if (nameEs) step.nameEs = nameEs
    if (nameEn) step.nameEn = nameEn
    if ((item as { replaceableByNext?: unknown }).replaceableByNext === true) {
      step.replaceableByNext = true
      const trailing = (item as { trailingWhenReplaced?: unknown }).trailingWhenReplaced
      if (trailing === 'discard' || trailing === 'afterReplacement') {
        step.trailingWhenReplaced = trailing
      }
    }
    steps.push(step)
  }
  const err = validateBookingPattern(steps)
  return err ? null : steps
}

/** Patrón con pausas entre tramos (no un solo bloque continuo). */
export function isSegmentedPattern(pattern: ServiceBookingPattern | null | undefined): boolean {
  if (!pattern || pattern.length === 0) return false
  return pattern.some((step) => step.type === 'break')
}

export function patternWorkSteps(pattern: ServiceBookingPattern): ServiceBookingWorkStep[] {
  return pattern.filter((step): step is ServiceBookingWorkStep => step.type === 'work')
}

/** Índice en el array del patrón del tramo work marcado como sustituible, o -1. */
export function findReplaceableWorkStepIndex(
  pattern: ServiceBookingPattern | null | undefined,
): number {
  if (!pattern) return -1
  return pattern.findIndex(
    (step) => step.type === 'work' && step.replaceableByNext === true,
  )
}

export function patternHasReplaceableWork(
  pattern: ServiceBookingPattern | null | undefined,
): boolean {
  return findReplaceableWorkStepIndex(pattern) >= 0
}

/** Hay tramos de trabajo después del índice (en el array del patrón). */
export function hasWorkStepsAfterPatternIndex(
  pattern: ServiceBookingPattern,
  stepIndex: number,
): boolean {
  for (let i = stepIndex + 1; i < pattern.length; i++) {
    if (pattern[i]!.type === 'work') return true
  }
  return false
}

export function getReplaceableTrailingPolicy(
  pattern: ServiceBookingPattern | null | undefined,
): TrailingWhenReplaced | null {
  const index = findReplaceableWorkStepIndex(pattern)
  if (index < 0 || !pattern) return null
  const step = pattern[index]
  if (!step || step.type !== 'work') return null
  if (!hasWorkStepsAfterPatternIndex(pattern, index)) return null
  return step.trailingWhenReplaced ?? 'discard'
}

/** Subpatrón desde el tramo sustituible (incluido) hasta el final. */
export function patternFromReplaceableInclusive(
  pattern: ServiceBookingPattern,
): ServiceBookingPattern | null {
  const index = findReplaceableWorkStepIndex(pattern)
  if (index < 0) return null
  return pattern.slice(index)
}

/** Solo tramos posteriores al sustituible (sin incluirlo). */
export function patternAfterReplaceable(
  pattern: ServiceBookingPattern,
): ServiceBookingPattern {
  const index = findReplaceableWorkStepIndex(pattern)
  if (index < 0) return []
  return pattern.slice(index + 1)
}

/** ≥2 tramos de trabajo con pausa (p. ej. color + aclarado). */
export function patternHasLinkedWorkSegments(
  pattern: ServiceBookingPattern | null | undefined,
): boolean {
  if (!pattern || !isSegmentedPattern(pattern)) return false
  return patternWorkSteps(pattern).length >= 2
}

export function patternTotalSpanMinutes(pattern: ServiceBookingPattern): number {
  return pattern.reduce((sum, step) => sum + step.minutes, 0)
}

export function patternWorkMinutes(pattern: ServiceBookingPattern): number {
  return patternWorkSteps(pattern).reduce((sum, step) => sum + step.minutes, 0)
}

/**
 * Span hasta (sin incluir) el tramo sustituible: aplicación + pausas previas.
 * Si no hay sustituible, el span completo.
 */
export function patternSpanBeforeReplaceable(pattern: ServiceBookingPattern): number {
  const replaceableIndex = findReplaceableWorkStepIndex(pattern)
  if (replaceableIndex < 0) return patternTotalSpanMinutes(pattern)
  let sum = 0
  for (let i = 0; i < replaceableIndex; i++) {
    sum += pattern[i]!.minutes
  }
  return sum
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

/** Solo tramos work anteriores al sustituible (p. ej. solo aplicación). */
export function patternToOccupiedSegmentsBeforeReplaceable(
  pattern: ServiceBookingPattern,
  startMinutes: number,
): OccupiedSegment[] {
  const replaceableIndex = findReplaceableWorkStepIndex(pattern)
  if (replaceableIndex < 0) {
    return patternToOccupiedSegments(pattern, startMinutes)
  }
  const segments: OccupiedSegment[] = []
  let cursor = startMinutes
  for (let i = 0; i < replaceableIndex; i++) {
    const step = pattern[i]!
    if (step.type === 'work') {
      segments.push({ startMinutes: cursor, durationMinutes: step.minutes })
    }
    cursor += step.minutes
  }
  return segments
}

export function workStepDisplayName(
  step: ServiceBookingWorkStep,
  locale: 'es' | 'en',
  fallback: string,
): string {
  if (locale === 'en') {
    return step.nameEn?.trim() || step.nameEs?.trim() || fallback
  }
  return step.nameEs?.trim() || step.nameEn?.trim() || fallback
}

export function validateBookingPattern(pattern: ServiceBookingPattern): string | null {
  if (pattern.length === 0) return 'Añade al menos un tramo'
  if (pattern[0].type !== 'work') return 'El patrón debe empezar con un tramo'
  if (pattern[pattern.length - 1].type !== 'work') return 'El patrón debe terminar con un tramo'
  let replaceableCount = 0
  for (const step of pattern) {
    if (!Number.isFinite(step.minutes) || step.minutes < 1) {
      return 'Cada tramo o descanso debe durar al menos 1 min'
    }
    if (step.type === 'work' && step.replaceableByNext) replaceableCount += 1
  }
  if (replaceableCount > 1) {
    return 'Solo un tramo puede ser sustituible por el siguiente tratamiento'
  }
  for (let i = 1; i < pattern.length; i++) {
    if (pattern[i].type === pattern[i - 1].type) {
      return 'Alterna tramos de trabajo y descansos'
    }
  }
  return null
}

/** Guarda null si es un solo tramo sin pausas. Limpia nombres vacíos. */
export function normalizeBookingPattern(
  pattern: ServiceBookingPattern | null | undefined,
): ServiceBookingPattern | null {
  if (!pattern || pattern.length === 0) return null
  const err = validateBookingPattern(pattern)
  if (err) return null
  if (!isSegmentedPattern(pattern)) return null
  return pattern.map((step) => {
    if (step.type === 'break') return { type: 'break' as const, minutes: step.minutes }
    const next: ServiceBookingWorkStep = { type: 'work', minutes: step.minutes }
    if (step.nameEs?.trim()) next.nameEs = step.nameEs.trim()
    if (step.nameEn?.trim()) next.nameEn = step.nameEn.trim()
    if (step.replaceableByNext) {
      next.replaceableByNext = true
      if (step.trailingWhenReplaced === 'discard' || step.trailingWhenReplaced === 'afterReplacement') {
        next.trailingWhenReplaced = step.trailingWhenReplaced
      }
    }
    return next
  })
}

export function formatPatternSummary(pattern: ServiceBookingPattern): string {
  const parts: string[] = []
  for (const step of pattern) {
    if (step.type === 'work') {
      const label = step.nameEs?.trim()
      parts.push(label ? `${label} ${step.minutes} min` : `${step.minutes} min`)
    } else {
      parts.push(`pausa ${step.minutes} min`)
    }
  }
  return parts.join(' + ')
}

export function defaultBookingPattern(durationMinutes = 30): ServiceBookingPattern {
  return [{ type: 'work', minutes: durationMinutes }]
}

/**
 * Nombre genérico del 1.er tramo del patrón de coloración por defecto.
 * En agenda debe usarse el nombre del tratamiento (p. ej. «Color en raíz»), no este label.
 */
export function isGenericColorApplicationLabel(name: string | undefined | null): boolean {
  if (!name?.trim()) return false
  const normalized = name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
  return normalized === 'aplicacion' || normalized === 'application'
}

/** Patrón por defecto de coloración (tramo color sin nombre + pausa + aclarado sustituible). */
export function defaultColorSplitPattern(): ServiceBookingPattern {
  return [
    // Sin nombre: al crear la cita se usa el nombre del servicio (Color en raíz, etc.).
    { type: 'work', minutes: 30 },
    { type: 'break', minutes: 30 },
    {
      type: 'work',
      minutes: 30,
      nameEs: 'Aclarado',
      nameEn: 'Rinse',
      replaceableByNext: true,
    },
  ]
}
