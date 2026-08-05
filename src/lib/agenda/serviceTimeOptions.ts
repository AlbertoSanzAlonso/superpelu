/** Slots de 30 min entre 8:00 y 21:00 (selector de hora en agenda). */
export const ALL_DAY_SLOTS = Array.from({ length: 27 }, (_, i) => {
  const totalMin = 8 * 60 + i * 30
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
})

export type EditableServiceTimeOptions = {
  freeOptions: string[]
  occupiedOptions: string[]
  extraCurrent: string[]
  isOccupied: boolean
}

/**
 * Opciones del selector de hora de un tratamiento adicional.
 * Ofrece toda la franja libre del especialista seleccionado ese día
 * (el orden de la visita puede invertirse).
 */
export function buildEditableServiceTimeOptions(input: {
  currentVal: string
  /** Slots libres del especialista de este tratamiento. */
  perServiceFree: readonly string[]
  /** Fallback si aún no hay slots por servicio (p. ej. slots del profesional activo). */
  fallbackFree: readonly string[]
  /** Horas de esta misma visita que no deben marcarse ocupadas. */
  ownTimes?: ReadonlySet<string> | readonly string[]
}): EditableServiceTimeOptions {
  const { currentVal, perServiceFree, fallbackFree } = input
  const ownTimes = input.ownTimes
    ? input.ownTimes instanceof Set
      ? input.ownTimes
      : new Set(input.ownTimes)
    : new Set<string>()

  const hasPerServiceSlots = perServiceFree.length > 0
  const sourceFree = hasPerServiceSlots ? perServiceFree : fallbackFree
  const freeSet = new Set(sourceFree)
  for (const time of ownTimes) {
    if (time) freeSet.add(time)
  }
  const freeOptions = [...freeSet].sort()

  const lastFree = freeOptions.length > 0 ? freeOptions[freeOptions.length - 1]! : null
  const firstFree = freeOptions.length > 0 ? freeOptions[0]! : null

  // Con slots del especialista: ocupados solo en su franja conocida.
  // Sin slots aún: todo el día seleccionable como ocupado (permite elegir cualquier hora).
  const occupiedOptions = ALL_DAY_SLOTS.filter((t) => {
    if (freeSet.has(t)) return false
    if (hasPerServiceSlots || fallbackFree.length > 0) {
      if (firstFree && t < firstFree) return false
      if (lastFree && t > lastFree) return false
    }
    return true
  })

  const isOccupied = currentVal !== '' && !freeSet.has(currentVal)
  const extraCurrent =
    currentVal !== '' &&
    !freeSet.has(currentVal) &&
    !occupiedOptions.includes(currentVal)
      ? [currentVal]
      : []

  return { freeOptions, occupiedOptions, extraCurrent, isOccupied }
}
