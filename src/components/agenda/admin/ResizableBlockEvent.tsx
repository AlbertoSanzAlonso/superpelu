import { useCallback, useRef, useState } from 'react'
import {
  blockDurationMinutes,
  eventHeightPx,
  eventTopPx,
  minutesToTime,
  timeToMinutes,
  type CalendarDayRange,
} from '@/lib/agenda/adminCalendar'
import { blockEventClass } from '@/lib/catalog/serviceCategoryColors'
import type { DayScheduleBlock } from '@/types/booking'

const DRAG_THRESHOLD_PX = 4

type ResizeEdge = 'top' | 'bottom'

type Props = {
  block: DayScheduleBlock
  range: CalendarDayRange
  interactionsLocked: boolean
  resizeEnabled: boolean
  staffId: string
  columnTopFromClientY: (clientY: number, staffId: string) => number | null
  onOpen: () => void
  onResizeEnd: (block: DayScheduleBlock, startTime: string, endTime: string) => void
}

function snapToSlot(minutes: number, range: CalendarDayRange): number {
  const relative = minutes - range.startMinutes
  const snapped =
    Math.round(relative / range.slotMinutes) * range.slotMinutes + range.startMinutes
  return Math.max(
    range.startMinutes,
    Math.min(range.endMinutes, snapped),
  )
}

export function ResizableBlockEvent({
  block,
  range,
  interactionsLocked,
  resizeEnabled,
  staffId,
  columnTopFromClientY,
  onOpen,
  onResizeEnd,
}: Props) {
  const [preview, setPreview] = useState<{ startTime: string; endTime: string } | null>(null)
  const suppressClickRef = useRef(false)
  const sessionRef = useRef<{
    edge: ResizeEdge
    pointerId: number
    startX: number
    startY: number
    moved: boolean
    originStart: string
    originEnd: string
  } | null>(null)

  const displayStart = preview?.startTime ?? block.startTime
  const displayEnd = preview?.endTime ?? block.endTime
  const duration = blockDurationMinutes(displayStart, displayEnd)
  const top = eventTopPx(displayStart, range)
  const height = eventHeightPx(duration, range)

  const computeTimes = useCallback(
    (edge: ResizeEdge, clientY: number, originStart: string, originEnd: string) => {
      const yInGrid = columnTopFromClientY(clientY, staffId)
      if (yInGrid === null) {
        return { startTime: originStart, endTime: originEnd }
      }
      const pointerMinutes = snapToSlot(
        range.startMinutes + (yInGrid / range.slotHeightPx) * range.slotMinutes,
        range,
      )
      const originStartM = timeToMinutes(originStart)
      const originEndM = timeToMinutes(originEnd)
      const minSpan = range.slotMinutes

      if (edge === 'bottom') {
        const endM = Math.max(originStartM + minSpan, Math.min(range.endMinutes, pointerMinutes))
        return {
          startTime: originStart,
          endTime: minutesToTime(endM),
        }
      }

      const startM = Math.min(originEndM - minSpan, Math.max(range.startMinutes, pointerMinutes))
      return {
        startTime: minutesToTime(startM),
        endTime: originEnd,
      }
    },
    [columnTopFromClientY, staffId, range],
  )

  const startResize = useCallback(
    (edge: ResizeEdge, e: React.PointerEvent) => {
      if (!resizeEnabled || interactionsLocked || e.button !== 0) return
      e.preventDefault()
      e.stopPropagation()

      sessionRef.current = {
        edge,
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        moved: false,
        originStart: block.startTime,
        originEnd: block.endTime,
      }

      const onMove = (ev: PointerEvent) => {
        const session = sessionRef.current
        if (!session || ev.pointerId !== session.pointerId) return
        const dx = ev.clientX - session.startX
        const dy = ev.clientY - session.startY
        if (!session.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return
        session.moved = true
        ev.preventDefault()
        setPreview(computeTimes(session.edge, ev.clientY, session.originStart, session.originEnd))
      }

      const onUp = (ev: PointerEvent) => {
        const session = sessionRef.current
        if (!session || ev.pointerId !== session.pointerId) return
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
        window.removeEventListener('pointercancel', onUp)

        const moved = session.moved
        const next = moved
          ? computeTimes(session.edge, ev.clientY, session.originStart, session.originEnd)
          : null
        sessionRef.current = null
        setPreview(null)
        if (moved) suppressClickRef.current = true

        if (
          moved &&
          next &&
          (next.startTime !== session.originStart || next.endTime !== session.originEnd)
        ) {
          onResizeEnd(block, next.startTime, next.endTime)
        }
      }

      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
      window.addEventListener('pointercancel', onUp)
    },
    [resizeEnabled, interactionsLocked, block, computeTimes, onResizeEnd],
  )

  return (
    <div
      role="button"
      tabIndex={interactionsLocked ? -1 : 0}
      onClick={(e) => {
        e.stopPropagation()
        if (suppressClickRef.current) {
          suppressClickRef.current = false
          return
        }
        if (interactionsLocked) return
        onOpen()
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          if (!interactionsLocked) onOpen()
        }
      }}
      className={`absolute inset-x-1 z-20 overflow-hidden border border-dashed px-2 py-1 text-left text-xs transition-colors hover:border-charcoal/40 ${blockEventClass()} ${
        interactionsLocked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
      } ${preview ? 'ring-2 ring-inset ring-gold/50' : ''}`}
      style={{ top, height: Math.max(height - 2, 22) }}
      title={
        block.note
          ? `Bloqueado ${displayStart}–${displayEnd} — ${block.note}`
          : `Bloqueado ${displayStart}–${displayEnd}`
      }
    >
      {resizeEnabled && !interactionsLocked && (
        <>
          <div
            className="absolute inset-x-0 top-0 z-10 h-2.5 cursor-ns-resize hover:bg-gold/30"
            onPointerDown={(e) => startResize('top', e)}
          />
          <div
            className="absolute inset-x-0 bottom-0 z-10 h-2.5 cursor-ns-resize hover:bg-gold/30"
            onPointerDown={(e) => startResize('bottom', e)}
          />
        </>
      )}
      <span className="font-medium">Bloqueado</span>
      <span className="mt-0.5 block tabular-nums opacity-80">
        {displayStart}–{displayEnd}
      </span>
      {block.note && <span className="mt-0.5 block truncate opacity-80">{block.note}</span>}
    </div>
  )
}
