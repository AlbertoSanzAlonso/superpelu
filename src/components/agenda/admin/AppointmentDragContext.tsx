import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react'
import {
  eventHeightPx,
  eventTopPx,
  minutesToTime,
  type CalendarDayRange,
} from '@/lib/agenda/adminCalendar'
import { WashPhaseIcon } from '@/components/agenda/WashPhaseIcon'
import { isColorGroupWashRow } from '@/lib/booking/occupancy'
import { appointmentEventClass } from '@/lib/catalog/serviceCategoryColors'
import { formatAppointmentTimeRange } from '@/lib/booking/occupancy'
import type { AppointmentDragEndPayload } from '@/components/agenda/admin/DraggableAppointmentBlock'
import {
  pointerYInStaffGrid,
  resolveStaffIdAtPointer,
  STAFF_COLUMN_HEADER_PX,
} from '@/components/agenda/admin/staffColumnHitTest'
import {
  assignOverlapLanes,
  FULL_WIDTH_LANE,
  type OverlapLaneLayout,
} from '@/lib/agenda/overlapLanes'
import type { DayScheduleAppointment, StaffDaySchedule } from '@/types/booking'

const DRAG_THRESHOLD_PX = 5

export type ResizeEdge = 'top' | 'bottom'

export type ActiveAppointmentDrag = {
  appointment: DayScheduleAppointment
  fromStaffId: string
  pointerId: number
  grabOffsetY: number
  clientX: number
  clientY: number
  targetStaffId: string
  targetStaffName: string
  snappedStartTime: string
  snappedTopPx: number
  height: number
  laneLayout: OverlapLaneLayout
  /** Si es un resize, qué borde se está arrastrando */
  resizeEdge?: ResizeEdge
  /** Duración original antes del resize */
  originalDuration?: number
  /** Nueva duración calculada durante el resize */
  newDuration?: number
}

type DragStartInput = {
  appointment: DayScheduleAppointment
  fromStaffId: string
  pointerId: number
  clientX: number
  clientY: number
  grabOffsetY: number
  height: number
  laneLayout?: OverlapLaneLayout
  resizeEdge?: ResizeEdge
}

type ContextValue = {
  activeDrag: ActiveAppointmentDrag | null
  /** Desde pointerdown en una cita hasta soltar o cancelar el arrastre. */
  isDragSessionActive: boolean
  startDrag: (input: DragStartInput) => void
  startResize: (input: DragStartInput) => void
}

const AppointmentDragContext = createContext<ContextValue | null>(null)

function snapStartTimeFromTop(topPx: number, range: CalendarDayRange): string {
  const slotIndex = Math.max(
    0,
    Math.min(range.slotCount - 1, Math.round(topPx / range.slotHeightPx)),
  )
  return minutesToTime(range.startMinutes + slotIndex * range.slotMinutes)
}

type ProviderProps = {
  children: ReactNode
  range: CalendarDayRange
  dragEnabled: boolean
  schedules: StaffDaySchedule[]
  columnRefs: RefObject<Map<string, HTMLDivElement>>
  onDragEnd: (payload: AppointmentDragEndPayload) => void
  onClickWithoutDrag: (appointmentId: string) => void
}

export function AppointmentDragProvider({
  children,
  range,
  dragEnabled,
  schedules,
  columnRefs,
  onDragEnd,
  onClickWithoutDrag,
}: ProviderProps) {
  const [activeDrag, setActiveDrag] = useState<ActiveAppointmentDrag | null>(null)
  const [isDragSessionActive, setIsDragSessionActive] = useState(false)
  const activeDragRef = useRef<ActiveAppointmentDrag | null>(null)
  const dragSessionRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    moved: boolean
    fromStaffId: string
    appointment: DayScheduleAppointment
    grabOffsetY: number
    height: number
    laneLayout: OverlapLaneLayout
    resizeEdge?: ResizeEdge
  } | null>(null)
  const rafRef = useRef<number | null>(null)
  const pendingFrameRef = useRef<ActiveAppointmentDrag | null>(null)

  const flushFrame = useCallback(() => {
    rafRef.current = null
    if (pendingFrameRef.current) {
      activeDragRef.current = pendingFrameRef.current
      setActiveDrag(pendingFrameRef.current)
      pendingFrameRef.current = null
    }
  }, [])

  const scheduleDragUpdate = useCallback(
    (next: ActiveAppointmentDrag) => {
      pendingFrameRef.current = next
      if (rafRef.current === null) {
        rafRef.current = requestAnimationFrame(flushFrame)
      }
    },
    [flushFrame],
  )

  const staffName = useCallback(
    (staffId: string) => schedules.find((s) => s.staffId === staffId)?.staffName ?? '',
    [schedules],
  )

  const computeDrag = useCallback(
    (clientX: number, clientY: number, session: NonNullable<typeof dragSessionRef.current>): ActiveAppointmentDrag => {
      const columns = columnRefs.current
      const targetStaffId =
        resolveStaffIdAtPointer(clientX, clientY, columns) ?? session.fromStaffId
      const height = session.height
      const gridHeightPx = range.totalHeightPx

      let snappedTopPx = 0
      let snappedStartTime = session.appointment.startTime
      let newDuration = session.appointment.durationMinutes

      const yInGrid = pointerYInStaffGrid(clientY, targetStaffId, columns, gridHeightPx)
      if (yInGrid !== null) {
        if (session.resizeEdge) {
          // Resize mode: calculate new duration
          const smoothTop = Math.max(0, Math.min(gridHeightPx, yInGrid))
          const originalTop = eventTopPx(session.appointment.startTime, range)
          
          if (session.resizeEdge === 'bottom') {
            // Resizing from bottom: duration = new bottom - top
            const newDurationMinutes = Math.round((smoothTop - originalTop) / range.slotHeightPx * range.slotMinutes / 5) * 5
            newDuration = Math.max(5, newDurationMinutes)
            snappedTopPx = originalTop
            snappedStartTime = session.appointment.startTime
          } else {
            // Resizing from top: duration = original bottom - new top
            const originalBottom = originalTop + height
            const newDurationMinutes = Math.round((originalBottom - smoothTop) / range.slotHeightPx * range.slotMinutes / 5) * 5
            newDuration = Math.max(5, newDurationMinutes)
            snappedTopPx = smoothTop
            // Calculate new start time based on new top position
            const slotIndex = Math.max(
              0,
              Math.min(range.slotCount - 1, Math.round(smoothTop / range.slotHeightPx))
            )
            snappedStartTime = minutesToTime(range.startMinutes + slotIndex * range.slotMinutes)
          }
        } else {
          // Drag mode: move appointment
          const smoothTop = Math.max(0, Math.min(gridHeightPx - height, yInGrid - session.grabOffsetY))
          snappedStartTime = snapStartTimeFromTop(smoothTop, range)
          snappedTopPx = eventTopPx(snappedStartTime, range)
        }
      }

      const targetSchedule = schedules.find((s) => s.staffId === targetStaffId)
      const provisionalApts = (targetSchedule?.appointments ?? [])
        .filter((a) => a.id !== session.appointment.id)
        .map((a) => ({
          id: a.id,
          serviceId: a.serviceId,
          startTime: a.startTime,
          durationMinutes: a.durationMinutes,
          colorGroupRole: a.colorGroupRole,
          bookingPattern: a.bookingPattern,
        }))
      provisionalApts.push({
        id: session.appointment.id,
        serviceId: session.appointment.serviceId,
        startTime: snappedStartTime,
        durationMinutes: newDuration,
        colorGroupRole: session.appointment.colorGroupRole,
        bookingPattern: session.appointment.bookingPattern,
      })
      const provisionalLanes = assignOverlapLanes(provisionalApts)
      const laneLayout =
        provisionalLanes.get(session.appointment.id) ?? session.laneLayout ?? FULL_WIDTH_LANE

      return {
        appointment: session.appointment,
        fromStaffId: session.fromStaffId,
        pointerId: session.pointerId,
        grabOffsetY: session.grabOffsetY,
        clientX,
        clientY,
        targetStaffId,
        targetStaffName: staffName(targetStaffId),
        snappedStartTime,
        snappedTopPx,
        height,
        laneLayout,
        resizeEdge: session.resizeEdge,
        originalDuration: session.appointment.durationMinutes,
        newDuration,
      }
    },
    [columnRefs, range, staffName, schedules],
  )

  const endDragSession = useCallback(() => {
    dragSessionRef.current = null
    pendingFrameRef.current = null
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    activeDragRef.current = null
    setActiveDrag(null)
    setIsDragSessionActive(false)
  }, [])

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  useEffect(() => {
    if (!isDragSessionActive) return

    document.body.classList.add('select-none')
    const preventSelect = (e: Event) => e.preventDefault()
    document.addEventListener('selectstart', preventSelect)

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') endDragSession()
    }
    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.body.classList.remove('select-none')
      document.removeEventListener('selectstart', preventSelect)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [isDragSessionActive, endDragSession])

  const startDrag = useCallback(
    (input: DragStartInput) => {
      if (!dragEnabled) return

      dragSessionRef.current = {
        pointerId: input.pointerId,
        startX: input.clientX,
        startY: input.clientY,
        moved: false,
        fromStaffId: input.fromStaffId,
        appointment: input.appointment,
        grabOffsetY: input.grabOffsetY,
        height: input.height,
        laneLayout: input.laneLayout ?? FULL_WIDTH_LANE,
      }
      setIsDragSessionActive(true)

      const onPointerMove = (e: PointerEvent) => {
        const session = dragSessionRef.current
        if (!session || e.pointerId !== session.pointerId) return

        const dx = e.clientX - session.startX
        const dy = e.clientY - session.startY
        if (!session.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return

        if (!session.moved) {
          session.moved = true
          window.getSelection()?.removeAllRanges()
        }
        e.preventDefault()
        scheduleDragUpdate(computeDrag(e.clientX, e.clientY, session))
      }

      const onPointerUp = (e: PointerEvent) => {
        const session = dragSessionRef.current
        if (!session || e.pointerId !== session.pointerId) return

        window.removeEventListener('pointermove', onPointerMove)
        window.removeEventListener('pointerup', onPointerUp)
        window.removeEventListener('pointercancel', onPointerCancel)

        if (!session.moved) {
          endDragSession()
          onClickWithoutDrag(session.appointment.id)
          return
        }

        const final =
          activeDragRef.current ??
          computeDrag(e.clientX, e.clientY, session)

        endDragSession()

        onDragEnd({
          appointment: session.appointment,
          fromStaffId: session.fromStaffId,
          toStaffId: final.targetStaffId,
          toStartTime: final.snappedStartTime,
        })
      }

      const onPointerCancel = (e: PointerEvent) => {
        if (dragSessionRef.current?.pointerId !== e.pointerId) return
        window.removeEventListener('pointermove', onPointerMove)
        window.removeEventListener('pointerup', onPointerUp)
        window.removeEventListener('pointercancel', onPointerCancel)
        endDragSession()
      }

      window.addEventListener('pointermove', onPointerMove)
      window.addEventListener('pointerup', onPointerUp)
      window.addEventListener('pointercancel', onPointerCancel)
    },
    [
      dragEnabled,
      computeDrag,
      scheduleDragUpdate,
      endDragSession,
      onDragEnd,
      onClickWithoutDrag,
    ],
  )

  const startResize = useCallback(
    (input: DragStartInput) => {
      if (!dragEnabled) return

      dragSessionRef.current = {
        pointerId: input.pointerId,
        startX: input.clientX,
        startY: input.clientY,
        moved: false,
        fromStaffId: input.fromStaffId,
        appointment: input.appointment,
        grabOffsetY: input.grabOffsetY,
        height: input.height,
        laneLayout: input.laneLayout ?? FULL_WIDTH_LANE,
        resizeEdge: input.resizeEdge,
      }
      setIsDragSessionActive(true)

      const onPointerMove = (e: PointerEvent) => {
        const session = dragSessionRef.current
        if (!session || e.pointerId !== session.pointerId) return

        const dx = e.clientX - session.startX
        const dy = e.clientY - session.startY
        if (!session.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return

        if (!session.moved) {
          session.moved = true
          window.getSelection()?.removeAllRanges()
        }
        e.preventDefault()
        scheduleDragUpdate(computeDrag(e.clientX, e.clientY, session))
      }

      const onPointerUp = (e: PointerEvent) => {
        const session = dragSessionRef.current
        if (!session || e.pointerId !== session.pointerId) return

        window.removeEventListener('pointermove', onPointerMove)
        window.removeEventListener('pointerup', onPointerUp)
        window.removeEventListener('pointercancel', onPointerCancel)

        if (!session.moved) {
          endDragSession()
          return
        }

        const final =
          activeDragRef.current ??
          computeDrag(e.clientX, e.clientY, session)

        endDragSession()

        // Emit resize end with new duration
        if (final.newDuration && final.newDuration !== final.originalDuration) {
          onDragEnd({
            appointment: session.appointment,
            fromStaffId: session.fromStaffId,
            toStaffId: final.targetStaffId,
            toStartTime: final.snappedStartTime,
            newDuration: final.newDuration,
          })
        }
      }

      const onPointerCancel = (e: PointerEvent) => {
        if (dragSessionRef.current?.pointerId !== e.pointerId) return
        window.removeEventListener('pointermove', onPointerMove)
        window.removeEventListener('pointerup', onPointerUp)
        window.removeEventListener('pointercancel', onPointerCancel)
        endDragSession()
      }

      window.addEventListener('pointermove', onPointerMove)
      window.addEventListener('pointerup', onPointerUp)
      window.addEventListener('pointercancel', onPointerCancel)
    },
    [
      dragEnabled,
      computeDrag,
      scheduleDragUpdate,
      endDragSession,
      onDragEnd,
    ],
  )

  return (
    <AppointmentDragContext.Provider value={{ activeDrag, isDragSessionActive, startDrag, startResize }}>
      {children}
      {activeDrag && (
        <>
          <div
            className="fixed inset-0 z-[55]"
            onClick={endDragSession}
            aria-hidden
          />
          <AppointmentDragOverlay
            activeDrag={activeDrag}
            columnRefs={columnRefs}
            range={range}
          />
        </>
      )}
    </AppointmentDragContext.Provider>
  )
}

export function useAppointmentDrag() {
  const ctx = useContext(AppointmentDragContext)
  if (!ctx) throw new Error('useAppointmentDrag debe usarse dentro de AppointmentDragProvider')
  return ctx
}

function AppointmentDragOverlay({
  activeDrag,
  columnRefs,
  range,
}: {
  activeDrag: ActiveAppointmentDrag
  columnRefs: RefObject<Map<string, HTMLDivElement>>
  range: CalendarDayRange
}) {
  const apt = activeDrag.appointment
  const columnEl = columnRefs.current?.get(activeDrag.targetStaffId)
  if (!columnEl) return null

  const columnRect = columnEl.getBoundingClientRect()
  const gridHeightPx = range.totalHeightPx
  const yInGrid =
    pointerYInStaffGrid(
      activeDrag.clientY,
      activeDrag.targetStaffId,
      columnRefs.current ?? new Map(),
      gridHeightPx,
    ) ?? 0
  const lane = activeDrag.laneLayout ?? FULL_WIDTH_LANE
  const left = columnRect.left + (columnRect.width * lane.leftPercent) / 100
  const width = Math.max((columnRect.width * lane.widthPercent) / 100, 36)
  const crossStaff = activeDrag.targetStaffId !== activeDrag.fromStaffId

  // Resize overlay: different positioning than drag
  let top: number
  let height: number
  if (activeDrag.resizeEdge && activeDrag.newDuration) {
    const newHeightPx = Math.max(eventHeightPx(activeDrag.newDuration, range), 22)
    if (activeDrag.resizeEdge === 'bottom') {
      top = columnRect.top + STAFF_COLUMN_HEADER_PX + activeDrag.snappedTopPx
      height = newHeightPx
    } else {
      top = columnRect.top + STAFF_COLUMN_HEADER_PX + activeDrag.snappedTopPx
      height = newHeightPx
    }
  } else {
    height = Math.max(activeDrag.height, 22)
    const smoothTop = Math.max(0, Math.min(gridHeightPx - activeDrag.height, yInGrid - activeDrag.grabOffsetY))
    top = columnRect.top + STAFF_COLUMN_HEADER_PX + smoothTop
  }

  return (
    <div
      className={`agenda-drag-ghost pointer-events-none fixed z-[60] overflow-hidden border-2 border-gold px-1.5 py-1 text-left text-xs leading-tight shadow-lg ${appointmentEventClass(apt.categoryId, apt.serviceId, apt.colorGroupRole)}`}
      style={{ top, left, width, height }}
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
      {crossStaff && (
        <span className="mt-0.5 block truncate text-[10px] font-medium text-gold">
          → {activeDrag.targetStaffName}
        </span>
      )}
      <span className="mt-0.5 block font-medium text-gold tabular-nums">
        {activeDrag.snappedStartTime}
      </span>
      <span className="block opacity-70 tabular-nums">
        {formatAppointmentTimeRange(apt.serviceId, activeDrag.snappedStartTime, apt.durationMinutes, 'es', {
          colorGroupRole: apt.colorGroupRole,
        })}
      </span>
      {activeDrag.resizeEdge && activeDrag.newDuration && (
        <span className="mt-0.5 block text-[10px] font-medium text-gold">
          {activeDrag.newDuration} min
        </span>
      )}
    </div>
  )
}

/** Indicador de hueco en columna durante el arrastre. */
export function AppointmentDragSnapSlot({
  staffId,
  activeDrag,
}: {
  staffId: string
  activeDrag: ActiveAppointmentDrag | null
}) {
  if (!activeDrag || activeDrag.targetStaffId !== staffId) return null

  const lane = activeDrag.laneLayout ?? FULL_WIDTH_LANE
  return (
    <div
      className="agenda-drag-snap-indicator pointer-events-none absolute z-[12] border-2 border-dashed border-gold/45 bg-gold/10"
      style={{
        top: activeDrag.snappedTopPx,
        height: Math.max(activeDrag.height, 22),
        left: `${lane.leftPercent}%`,
        width: `${lane.widthPercent}%`,
      }}
      aria-hidden
    />
  )
}
