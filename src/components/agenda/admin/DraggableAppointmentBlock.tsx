import { useCallback } from 'react'
import {
  eventHeightPx,
  eventTopPx,
  timeToMinutes,
  type CalendarDayRange,
} from '@/lib/agenda/adminCalendar'
import { WashPhaseIcon } from '@/components/agenda/WashPhaseIcon'
import { isColorGroupWashRow } from '@/lib/booking/occupancy'
import { appointmentEventClass } from '@/lib/catalog/serviceCategoryColors'
import {
  appointmentOccupiedSlots,
  formatAppointmentTimeRange,
} from '@/lib/booking/occupancy'
import { useAppointmentDrag } from '@/components/agenda/admin/AppointmentDragContext'
import type { PendingMoveVisual } from '@/lib/agenda/pendingMoves'
import type { DayScheduleAppointment } from '@/types/booking'

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
  previewOnly?: boolean
  columnTopFromClientY: (clientY: number, staffId: string) => number | null
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

export function DraggableAppointmentBlock({
  apt,
  staffId,
  range,
  pendingVisual,
  dragEnabled,
  previewOnly = false,
  columnTopFromClientY,
}: Props) {
  const { activeDrag, startDrag, startResize } = useAppointmentDrag()
  const isDraggingThis = activeDrag?.appointment.id === apt.id

  const isPendingSource =
    pendingVisual != null && pendingVisual.originStaffId === staffId
  const isPendingTarget =
    pendingVisual != null && pendingVisual.targetStaffId === staffId
  const isRelocated = isPendingSource && !isPendingTarget && pendingVisual != null

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

  const showAtOrigin =
    !previewOnly &&
    !isDraggingThis &&
    (!isRelocated || isPendingSource) &&
    (!isPendingTarget || isPendingSource)

  const handlePointerDown = useCallback(
    (e: React.PointerEvent, blockTop: number) => {
      if (!dragEnabled || e.button !== 0 || activeDrag) return
      e.preventDefault()
      e.stopPropagation()
      const yInColumn = columnTopFromClientY(e.clientY, staffId)
      if (yInColumn === null) return
      startDrag({
        appointment: apt,
        fromStaffId: staffId,
        pointerId: e.pointerId,
        clientX: e.clientX,
        clientY: e.clientY,
        grabOffsetY: yInColumn - blockTop,
        height: bounds.height,
      })
    },
    [dragEnabled, activeDrag, columnTopFromClientY, staffId, startDrag, apt, bounds.height],
  )

  const handleResizePointerDown = useCallback(
    (edge: 'top' | 'bottom', e: React.PointerEvent, blockTop: number) => {
      if (!dragEnabled || e.button !== 0 || activeDrag) return
      e.preventDefault()
      e.stopPropagation()
      startResize({
        appointment: apt,
        fromStaffId: staffId,
        pointerId: e.pointerId,
        clientX: e.clientX,
        clientY: e.clientY,
        grabOffsetY: e.clientY - blockTop,
        height: bounds.height,
        resizeEdge: edge,
      })
    },
    [dragEnabled, activeDrag, startResize, apt, bounds.height, staffId],
  )

  const renderBlock = (
    key: string,
    top: number,
    height: number,
    startTime: string,
    className: string,
    pointerHandlers?: React.HTMLAttributes<HTMLDivElement>,
  ) => (
    <div
      key={key}
      className={`agenda-appointment-block absolute inset-x-1 z-30 overflow-hidden border px-2 py-1 text-left text-xs leading-tight shadow-sm ${appointmentEventClass(apt.categoryId, apt.serviceId, apt.colorGroupRole, apt.status)} ${className}`}
      style={{ top, height: Math.max(height - 2, 22) }}
      title={
        apt.notes?.trim()
          ? `${apt.customerName} — ${apt.serviceName}\n${apt.notes.trim()}`
          : `${apt.customerName} — ${apt.serviceName}`
      }
      {...pointerHandlers}
    >
      {/* Resize handle - top edge */}
      {!previewOnly && dragEnabled && !isColorGroupWashRow(apt.colorGroupRole) && (
        <div
          className="absolute inset-x-0 top-0 z-10 h-1.5 cursor-ns-resize hover:bg-gold/30"
          onPointerDown={(e) => handleResizePointerDown('top', e, top)}
        />
      )}
      
      {/* Resize handle - bottom edge */}
      {!previewOnly && dragEnabled && !isColorGroupWashRow(apt.colorGroupRole) && (
        <div
          className="absolute inset-x-0 bottom-0 z-10 h-1.5 cursor-ns-resize hover:bg-gold/30"
          onPointerDown={(e) => handleResizePointerDown('bottom', e, top)}
        />
      )}
      
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
      {apt.notes?.trim() && height >= 44 && (
        <span className="mt-0.5 block truncate opacity-75 italic">{apt.notes.trim()}</span>
      )}
    </div>
  )

  return (
    <>
      {showAtOrigin &&
        renderBlock(
          `${apt.id}-origin`,
          originBounds.top,
          originBounds.height,
          originStartTime,
          [
            'agenda-appointment-block--origin',
            isPendingSource ? 'opacity-35' : '',
            dragEnabled ? 'cursor-grab active:cursor-grabbing' : '',
          ]
            .filter(Boolean)
            .join(' '),
          dragEnabled
            ? { onPointerDown: (e) => handlePointerDown(e, originBounds.top) }
            : undefined,
        )}

      {(isPendingTarget || previewOnly) &&
        !isDraggingThis &&
        renderBlock(
          `${apt.id}-pending`,
          displayBounds.top,
          displayBounds.height,
          displayStartTime,
          [
            'agenda-appointment-block--pending z-40 border-2 border-dashed border-gold ring-2 ring-gold/40',
            isPendingTarget && !previewOnly && dragEnabled
              ? 'cursor-grab active:cursor-grabbing'
              : '',
          ]
            .filter(Boolean)
            .join(' '),
          previewOnly || !dragEnabled
            ? undefined
            : { onPointerDown: (e) => handlePointerDown(e, displayBounds.top) },
        )}
    </>
  )
}
