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
 * El mínimo es `chainedMin` (fin del anterior), no la hora ya fijada.
 * Si aún no hay slots por especialista, igual se listan huecos desde ese mínimo
 * (libres conocidos + ocupados) para poder atrasar un aplazamiento.
 */
export function buildEditableServiceTimeOptions(input: {
  currentVal: string
  chainedMin: string
  /** Slots libres del especialista de este tratamiento. */
  perServiceFree: readonly string[]
  /** Fallback si aún no hay slots por servicio (p. ej. slots del profesional activo). */
  fallbackFree: readonly string[]
  /** Horas de esta misma visita que no deben marcarse ocupadas. */
  ownTimes?: ReadonlySet<string> | readonly string[]
}): EditableServiceTimeOptions {
  const { currentVal, chainedMin, perServiceFree, fallbackFree } = input
  const ownTimes = input.ownTimes
    ? input.ownTimes instanceof Set
      ? input.ownTimes
      : new Set(input.ownTimes)
    : new Set<string>()

  const sourceFree = perServiceFree.length > 0 ? perServiceFree : fallbackFree
  const freeSet = new Set(
    sourceFree.filter((t) => !chainedMin || t >= chainedMin),
  )
  for (const time of ownTimes) {
    if (time && (!chainedMin || time >= chainedMin)) freeSet.add(time)
  }
  const freeOptions = [...freeSet].sort()

  const lastFree = freeOptions.length > 0 ? freeOptions[freeOptions.length - 1]! : null
  const occupiedOptions = ALL_DAY_SLOTS.filter((t) => {
    if (chainedMin && t < chainedMin) return false
    // Si hay libres, no listar ocupados después del último libre del día.
    // Si no hay ninguno, ofrecer todo el día desde chainedMin (p. ej. slots aún cargando).
    if (lastFree && t > lastFree) return false
    return !freeSet.has(t)
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
