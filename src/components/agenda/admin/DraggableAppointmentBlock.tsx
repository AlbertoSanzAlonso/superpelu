import { useCallback, useRef, useState } from 'react'
import {
  CALENDAR_SLOT_HEIGHT_PX,
  eventHeightPx,
  eventTopPx,
  minutesToTime,
  timeToMinutes,
  type CalendarDayRange,
} from '@/lib/adminCalendar'
import { WashPhaseIcon } from '@/components/agenda/WashPhaseIcon'
import { isColorGroupWashRow } from '@/lib/bookingOccupancy'
import { appointmentEventClass } from '@/lib/serviceCategoryColors'
import {
  appointmentOccupiedSlots,
  formatAppointmentTimeRange,
} from '@/lib/bookingOccupancy'
import type { PendingMoveVisual } from '@/lib/pendingAppointmentMoves'
import type { DayScheduleAppointment } from '@/types/booking'

const DRAG_THRESHOLD_PX = 6

export type AppointmentDragEndPayload = {
  appointment: DayScheduleAppointment
  fromStaffId: string
  toStaffId: string
  toStartTime: string
}

type Props = {
  apt: DayScheduleAppointment
  staffId: string
  range: CalendarDayRange
  pendingVisual: PendingMoveVisual | null
  dragEnabled: boolean
  /** Solo vista previa en columna destino (cambio de profesional). */
  previewOnly?: boolean
  resolveStaffIdAtPoint: (clientX: number) => string | null
  columnTopFromClientY: (clientY: number, staffId: string) => number | null
  onDragEnd: (payload: AppointmentDragEndPayload) => void
  onClick: () => void
}

function appointmentVisualBounds(
  apt: DayScheduleAppointment,
  range: CalendarDayRange,
  startTimeOverride?: string,
) {
  const startTime = startTimeOverride ?? apt.startTime
  const slots =
    startTimeOverride != null
      ? appointmentOccupiedSlots(apt.serviceId, startTime, apt.durationMinutes, {
          colorGroupRole: apt.colorGroupRole,
        })
      : apt.occupiedSlots.length > 0
        ? apt.occupiedSlots
        : [{ startTime: apt.startTime, endTime: apt.endTime }]

  const tops = slots.map((s) => eventTopPx(s.startTime, range))
  const bottoms = slots.map((s) => {
    const duration = timeToMinutes(s.endTime) - timeToMinutes(s.startTime)
    return eventTopPx(s.startTime, range) + eventHeightPx(duration, range)
  })

  const top = Math.min(...tops)
  const bottom = Math.max(...bottoms)
  return { top, height: bottom - top, slots }
}

function snapStartTimeFromTop(topPx: number, range: CalendarDayRange): string {
  const slotIndex = Math.max(
    0,
    Math.min(range.slotCount - 1, Math.round(topPx / CALENDAR_SLOT_HEIGHT_PX)),
  )
  return minutesToTime(range.startMinutes + slotIndex * range.slotMinutes)
}

export function DraggableAppointmentBlock({
  apt,
  staffId,
  range,
  pendingVisual,
  dragEnabled,
  previewOnly = false,
  resolveStaffIdAtPoint,
  columnTopFromClientY,
  onDragEnd,
  onClick,
}: Props) {
  const isPendingSource =
    pendingVisual != null && pendingVisual.originStaffId === staffId
  const isPendingTarget =
    pendingVisual != null && pendingVisual.targetStaffId === staffId
  const isRelocated = isPendingSource && isPendingTarget === false && pendingVisual != null

  const originStartTime = pendingVisual?.originStartTime ?? apt.startTime
  const displayStartTime = isPendingTarget ? pendingVisual!.targetStartTime : apt.startTime

  const bounds = appointmentVisualBounds(apt, range)
  const originBounds =
    isPendingSource && pendingVisual
      ? appointmentVisualBounds(apt, range, originStartTime)
      : bounds
  const displayBounds = isPendingTarget
    ? appointmentVisualBounds(apt, range, displayStartTime)
    : bounds

  const [liveDrag, setLiveDrag] = useState<{
    staffId: string
    startTime: string
    top: number
    height: number
  } | null>(null)

  const dragRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    grabOffsetY: number
    moved: boolean
    fromStaffId: string
  } | null>(null)

  const showAtOrigin =
    !previewOnly &&
    (!isRelocated || isPendingSource) &&
    (!isPendingTarget || isPendingSource) &&
    (!isPendingSource || !liveDrag || liveDrag.staffId === staffId)
  const originTop = originBounds.top
  const originHeight = originBounds.height

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!dragEnabled || e.button !== 0) return
      e.stopPropagation()
      const yInColumn = columnTopFromClientY(e.clientY, staffId)
      if (yInColumn === null) return
      e.currentTarget.setPointerCapture(e.pointerId)
      dragRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        grabOffsetY: yInColumn - (isPendingTarget ? displayBounds.top : originTop),
        moved: false,
        fromStaffId: staffId,
      }
    },
    [dragEnabled, displayBounds.top, isPendingTarget, originTop, staffId, columnTopFromClientY],
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const drag = dragRef.current
      if (!drag || drag.pointerId !== e.pointerId) return

      const dx = e.clientX - drag.startX
      const dy = e.clientY - drag.startY
      if (!drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return

      drag.moved = true
      const targetStaffId = resolveStaffIdAtPoint(e.clientX) ?? drag.fromStaffId
      const yInColumn = columnTopFromClientY(e.clientY, targetStaffId)
      if (yInColumn === null) return

      const nextTop = Math.max(
        0,
        Math.min(range.totalHeightPx - bounds.height, yInColumn - drag.grabOffsetY),
      )
      const startTime = snapStartTimeFromTop(nextTop, range)
      const snappedTop = eventTopPx(startTime, range)

      setLiveDrag({
        staffId: targetStaffId,
        startTime,
        top: snappedTop,
        height: bounds.height,
      })
    },
    [bounds.height, columnTopFromClientY, range, resolveStaffIdAtPoint],
  )

  const finishDrag = useCallback(
    (e: React.PointerEvent) => {
      const drag = dragRef.current
      if (!drag || drag.pointerId !== e.pointerId) return

      dragRef.current = null
      e.currentTarget.releasePointerCapture(e.pointerId)

      if (!drag.moved) {
        setLiveDrag(null)
        onClick()
        return
      }

      const targetStaffId = liveDrag?.staffId ?? drag.fromStaffId
      const toStartTime = liveDrag?.startTime ?? apt.startTime
      setLiveDrag(null)

      onDragEnd({
        appointment: apt,
        fromStaffId: drag.fromStaffId,
        toStaffId: targetStaffId,
        toStartTime,
      })
    },
    [apt, liveDrag, onClick, onDragEnd],
  )

  const handlePointerCancel = useCallback((e: React.PointerEvent) => {
    if (dragRef.current?.pointerId !== e.pointerId) return
    dragRef.current = null
    setLiveDrag(null)
  }, [])

  const renderBlock = (
    key: string,
    top: number,
    height: number,
    startTime: string,
    className: string,
    style: React.CSSProperties,
    pointerHandlers?: React.HTMLAttributes<HTMLDivElement>,
  ) => (
    <div
      key={key}
      className={`absolute inset-x-1 z-30 overflow-hidden border px-2 py-1 text-left text-xs leading-tight shadow-sm ${appointmentEventClass(apt.categoryId, apt.serviceId, apt.colorGroupRole)} ${className}`}
      style={{ top, height: Math.max(height - 2, 22), ...style }}
      title={`${apt.customerName} — ${apt.serviceName}`}
      {...pointerHandlers}
    >
      <span className="flex items-center gap-1 font-medium">
        {isColorGroupWashRow(apt.colorGroupRole) && (
          <WashPhaseIcon className="h-3 w-3 shrink-0 opacity-90" title="Lavado" />
        )}
        <span className="truncate">
          {apt.customerName} —{' '}
          {isColorGroupWashRow(apt.colorGroupRole) ? 'Lavar color' : apt.serviceName}
        </span>
      </span>
      <span className="mt-0.5 block opacity-80 tabular-nums">
        {formatAppointmentTimeRange(apt.serviceId, startTime, apt.durationMinutes, 'es', {
          colorGroupRole: apt.colorGroupRole,
        })}
      </span>
    </div>
  )

  const isLiveOnThisColumn = liveDrag?.staffId === staffId

  return (
    <>
      {showAtOrigin &&
        renderBlock(
          `${apt.id}-origin`,
          originTop,
          originHeight,
          originStartTime,
          [
            isPendingSource ? 'opacity-35' : '',
            isLiveOnThisColumn && liveDrag ? 'opacity-20' : 'cursor-grab active:cursor-grabbing',
          ]
            .filter(Boolean)
            .join(' '),
          {},
          dragEnabled
            ? {
                onPointerDown: handlePointerDown,
                onPointerMove: handlePointerMove,
                onPointerUp: finishDrag,
                onPointerCancel: handlePointerCancel,
              }
            : undefined,
        )}

      {(isPendingTarget || previewOnly) &&
        !liveDrag &&
        renderBlock(
          `${apt.id}-pending`,
          displayBounds.top,
          displayBounds.height,
          displayStartTime,
          [
            'z-40 border-2 border-dashed border-gold ring-2 ring-gold/40',
            isPendingTarget && !previewOnly ? 'cursor-grab active:cursor-grabbing' : '',
          ]
            .filter(Boolean)
            .join(' '),
          previewOnly ? { pointerEvents: 'none' } : {},
          isPendingTarget && !previewOnly && dragEnabled
            ? {
                onPointerDown: handlePointerDown,
                onPointerMove: handlePointerMove,
                onPointerUp: finishDrag,
                onPointerCancel: handlePointerCancel,
              }
            : undefined,
        )}

      {isLiveOnThisColumn &&
        liveDrag &&
        renderBlock(
          `${apt.id}-live`,
          liveDrag.top,
          liveDrag.height,
          liveDrag.startTime,
          'z-50 border-2 border-gold opacity-90 shadow-md',
          { pointerEvents: 'none' },
        )}
    </>
  )
}
