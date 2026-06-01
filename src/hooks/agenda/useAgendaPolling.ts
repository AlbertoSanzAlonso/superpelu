import { useEffect, useRef } from 'react'

const DEFAULT_INTERVAL_MS = 15_000

type Options = {
  /** Si false, no se programa ningún intervalo. */
  enabled: boolean
  /** Si true, se detiene el intervalo (modales, edición, etc.). */
  paused?: boolean
  intervalMs?: number
}

/**
 * Recarga la agenda en segundo plano mientras la pestaña está visible.
 * Al volver a la pestaña dispara una recarga inmediata.
 */
export function useAgendaPolling(
  reload: (opts?: { silent?: boolean }) => void | Promise<void>,
  { enabled, paused = false, intervalMs = DEFAULT_INTERVAL_MS }: Options,
) {
  const reloadRef = useRef(reload)
  reloadRef.current = reload

  const pausedRef = useRef(paused)
  pausedRef.current = paused

  useEffect(() => {
    if (!enabled) return

    const tick = () => {
      if (document.hidden || pausedRef.current) return
      void reloadRef.current({ silent: true })
    }

    const onVisibility = () => {
      if (document.hidden || pausedRef.current) return
      void reloadRef.current({ silent: true })
    }

    const id = window.setInterval(tick, intervalMs)
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [enabled, intervalMs])
}
