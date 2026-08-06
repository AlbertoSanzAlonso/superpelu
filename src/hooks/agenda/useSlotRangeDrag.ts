import { useCallback, useEffect, useRef } from 'react'
import {
  orderedTimesBetween,
  paintSlotRange,
  type SlotPaintMode,
} from '@/lib/agenda/slotRangeSelection'

type DragSession = {
  anchor: string
  mode: SlotPaintMode
  base: Set<string>
  moved: boolean
  pointerId: number
}

/**
 * Arrastre con botón izquierdo sobre franjas libres: pinta o borra el rango
 * entre el ancla y la franja bajo el cursor. El clic suelto (sin mover) queda
 * cubierto por el paint del pointerdown (añadir/quitar una franja).
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
    if (!session) return
    if (time !== session.anchor) session.moved = true
    const range = orderedTimesBetween(selectableRef.current, session.anchor, time)
    onPaintRef.current(paintSlotRange(session.base, range, session.mode))
  }, [])

  const endDrag = useCallback(() => {
    const session = sessionRef.current
    if (!session) return
    if (session.moved) suppressClickRef.current = true
    else suppressClickRef.current = true // el paint del down ya hizo el toggle
    sessionRef.current = null
  }, [])

  useEffect(() => {
    if (!enabled) return

    const onMove = (e: PointerEvent) => {
      const session = sessionRef.current
      if (!session || e.pointerId !== session.pointerId) return
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
      endDrag()
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [enabled, endDrag, paintTo])

  const onFreeSlotPointerDown = useCallback(
    (e: React.PointerEvent, time: string) => {
      if (!enabled || e.button !== 0) return
      if (!selectableRef.current.includes(time)) return
      e.preventDefault()
      const selected = selectedRef.current
      const mode: SlotPaintMode = selected.has(time) ? 'remove' : 'add'
      const base = new Set(selected)
      sessionRef.current = {
        anchor: time,
        mode,
        base,
        moved: false,
        pointerId: e.pointerId,
      }
      onPaintRef.current(paintSlotRange(base, [time], mode))
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
