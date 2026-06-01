import { useCallback, useEffect, useState } from 'react'

/** Selección de celdas horarias en una sola columna (agenda profesional). */
export function useAgendaGridTimes(resetKey?: string) {
  const [times, setTimes] = useState<Set<string>>(() => new Set())

  useEffect(() => {
    setTimes(new Set())
  }, [resetKey])

  const clear = useCallback(() => setTimes(new Set()), [])

  const toggle = useCallback((time: string) => {
    setTimes((prev) => {
      const next = new Set(prev)
      if (next.has(time)) next.delete(time)
      else next.add(time)
      return next
    })
  }, [])

  const reset = useCallback(() => setTimes(new Set()), [])

  return { times, setTimes, clear, toggle, reset }
}
