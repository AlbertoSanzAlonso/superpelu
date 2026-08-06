import { useCallback, useEffect, useRef } from 'react'
import {
  orderedTimesBetween,
  paintSlotRange,
  type SlotPaintMode,
} from '@/lib/agenda/slotRangeSelection'

/** Por debajo: se considera tap. Por encima en táctil: scroll (se cancela). */
const MOVE_THRESHOLD_PX = 10

type DragSession = {
  anchor: string
  mode: SlotPaintMode
  base: Set<string>
  /** Ya se empezó a pintar un rango (ratón). */
  painting: boolean
  /** Se canceló por scroll/gesto táctil. */
  aborted: boolean
  pointerId: number
  pointerType: string
  startX: number
  startY: number
}

/**
 * Arrastre con botón izquierdo sobre franjas libres: pinta o borra el rango
 * entre el ancla y la franja bajo el cursor.
 *
 * En táctil no se selecciona al apoyar el dedo: si hay desplazamiento se cancela
 * (para poder hacer scroll); el tap (soltar sin mover) aplica la franja.
 */
export function useSlotRangeDrag({
  selectableTimes,
  selectedTimes,
  scope,
  enabled,
  onPaint,
}: {
  /** Horas seleccionables en orden (solo libres). */
  selectableTimes: readonly string[]
  selectedTimes: ReadonlySet<string>
  /** Valor de `data-slot-scope` de esta columna/grilla (evita cruzar columnas). */
  scope: string
  enabled: boolean
  onPaint: (times: Set<string>) => void
}) {
  const sessionRef = useRef<DragSession | null>(null)
  const suppressClickRef = useRef(false)
  const selectableRef = useRef(selectableTimes)
  const selectedRef = useRef(selectedTimes)
  const onPaintRef = useRef(onPaint)
  const scopeRef = useRef(scope)

  selectableRef.current = selectableTimes
  selectedRef.current = selectedTimes
  onPaintRef.current = onPaint
  scopeRef.current = scope

  const paintTo = useCallback((time: string) => {
    const session = sessionRef.current
    if (!session || session.aborted) return
    const range = orderedTimesBetween(selectableRef.current, session.anchor, time)
    onPaintRef.current(paintSlotRange(session.base, range, session.mode))
  }, [])

  const endDrag = useCallback(() => {
    const session = sessionRef.current
    if (!session) return
    // Evita doble toggle vía onClick tras pointerup / paint.
    suppressClickRef.current = true
    sessionRef.current = null
  }, [])

  useEffect(() => {
    if (!enabled) return

    const onMove = (e: PointerEvent) => {
      const session = sessionRef.current
      if (!session || e.pointerId !== session.pointerId || session.aborted) return

      const dx = e.clientX - session.startX
      const dy = e.clientY - session.startY
      const dist = Math.hypot(dx, dy)

      if (!session.painting) {
        if (dist < MOVE_THRESHOLD_PX) return

        // En táctil el desplazamiento es scroll: no seleccionar.
        if (session.pointerType === 'touch') {
          session.aborted = true
          sessionRef.current = null
          return
        }

        session.painting = true
        e.preventDefault()
      } else {
        e.preventDefault()
      }

      const hit = document.elementFromPoint(e.clientX, e.clientY)
      const slot = hit instanceof Element ? hit.closest('[data-slot-time]') : null
      if (!(slot instanceof HTMLElement)) return
      if (slot.dataset.slotScope !== scopeRef.current) return
      if (slot.dataset.slotSelectable !== '1') return
      const time = slot.dataset.slotTime
      if (!time) return
      paintTo(time)
    }

    const onUp = (e: PointerEvent) => {
      const session = sessionRef.current
      if (!session || e.pointerId !== session.pointerId) return

      if (session.aborted) {
        sessionRef.current = null
        return
      }

      // Tap: soltar sin haber iniciado pintura de rango.
      if (!session.painting) {
        onPaintRef.current(paintSlotRange(session.base, [session.anchor], session.mode))
      }
      endDrag()
    }

    // El navegador cancela el pointer al empezar el scroll táctil: no seleccionar.
    const onCancel = (e: PointerEvent) => {
      const session = sessionRef.current
      if (!session || e.pointerId !== session.pointerId) return
      sessionRef.current = null
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
    }
  }, [enabled, endDrag, paintTo])

  const onFreeSlotPointerDown = useCallback(
    (e: React.PointerEvent, time: string) => {
      if (!enabled || e.button !== 0) return
      if (!selectableRef.current.includes(time)) return
      // No preventDefault aquí: en táctil bloquearía el scroll del calendario.
      const selected = selectedRef.current
      const mode: SlotPaintMode = selected.has(time) ? 'remove' : 'add'
      const base = new Set(selected)
      sessionRef.current = {
        anchor: time,
        mode,
        base,
        painting: false,
        aborted: false,
        pointerId: e.pointerId,
        pointerType: e.pointerType,
        startX: e.clientX,
        startY: e.clientY,
      }
    },
    [enabled],
  )

  /** true si el clic debe ignorarse (ya gestionado por el arrastre/paint). */
  const shouldSuppressClick = useCallback(() => {
    if (!suppressClickRef.current) return false
    suppressClickRef.current = false
    return true
  }, [])

  const isDragging = useCallback(() => sessionRef.current != null, [])

  return {
    onFreeSlotPointerDown,
    shouldSuppressClick,
    isDragging,
  }
}
