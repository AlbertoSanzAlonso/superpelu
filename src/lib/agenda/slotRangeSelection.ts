/** Franjas entre dos horas según el orden del día (p. ej. labels de la grilla). */
export function orderedTimesBetween(
  orderedTimes: readonly string[],
  from: string,
  to: string,
): string[] {
  const i = orderedTimes.indexOf(from)
  const j = orderedTimes.indexOf(to)
  if (i < 0 && j < 0) return []
  if (i < 0) return j >= 0 ? [to] : []
  if (j < 0) return [from]
  const lo = Math.min(i, j)
  const hi = Math.max(i, j)
  return orderedTimes.slice(lo, hi + 1)
}

export type SlotPaintMode = 'add' | 'remove'

/** Aplica pintar/borrar un rango sobre una selección base (snapshot al iniciar el arrastre). */
export function paintSlotRange(
  base: ReadonlySet<string>,
  range: readonly string[],
  mode: SlotPaintMode,
): Set<string> {
  const next = new Set(base)
  for (const time of range) {
    if (mode === 'add') next.add(time)
    else next.delete(time)
  }
  return next
}
