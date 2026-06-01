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
  CALENDAR_SLOT_HEIGHT_PX,
  eventTopPx,
  minutesToTime,
  type CalendarDayRange,
} from '@/lib/adminCalendar'
import { WashPhaseIcon } from '@/components/agenda/WashPhaseIcon'
import { isColorGroupWashRow } from '@/lib/bookingOccupancy'
import { appointmentEventClass } from '@/lib/serviceCategoryColors'
import { formatAppointmentTimeRange } from '@/lib/bookingOccupancy'
import type { AppointmentDragEndPayload } from '@/components/agenda/admin/DraggableAppointmentBlock'
import {
  pointerYInStaffGrid,
  resolveStaffIdAtPointer,
  STAFF_COLUMN_HEADER_PX,
} from '@/components/agenda/admin/staffColumnHitTest'
import type { DayScheduleAppointment, StaffDaySchedule } from '@/types/booking'

const DRAG_THRESHOLD_PX = 5

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
}

type DragStartInput = {
  appointment: DayScheduleAppointment
  fromStaffId: string
  pointerId: number
  clientX: number
  clientY: number
  grabOffsetY: number
  height: number
}

type ContextValue = {
  activeDrag: ActiveAppointmentDrag | null
  /** Desde pointerdown en una cita hasta soltar o cancelar el arrastre. */
  isDragSessionActive: boolean
  startDrag: (input: DragStartInput) => void
}

const AppointmentDragContext = createContext<ContextValue | null>(null)

function snapStartTimeFromTop(topPx: number, range: CalendarDayRange): string {
  const slotIndex = Math.max(
    0,
    Math.min(range.slotCount - 1, Math.round(topPx / CALENDAR_SLOT_HEIGHT_PX)),
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

      const yInGrid = pointerYInStaffGrid(clientY, targetStaffId, columns, gridHeightPx)
      if (yInGrid !== null) {
        const smoothTop = Math.max(0, Math.min(gridHeightPx - height, yInGrid - session.grabOffsetY))
        snappedStartTime = snapStartTimeFromTop(smoothTop, range)
        snappedTopPx = eventTopPx(snappedStartTime, range)
      }

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
      }
    },
    [columnRefs, range, staffName],
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
      }
      setIsDragSessionActive(true)

      const onPointerMove = (e: PointerEvent) => {
        const session = dragSessionRef.current
        if (!session || e.pointerId !== session.pointerId) return

        const dx = e.clientX - session.startX
        const dy = e.clientY - session.startY
        if (!session.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return

        session.moved = true
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

  return (
    <AppointmentDragContext.Provider value={{ activeDrag, isDragSessionActive, startDrag }}>
      {children}
      {activeDrag && (
        <AppointmentDragOverlay
          activeDrag={activeDrag}
          columnRefs={columnRefs}
          gridHeightPx={range.totalHeightPx}
        />
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
  gridHeightPx,
}: {
  activeDrag: ActiveAppointmentDrag
  columnRefs: RefObject<Map<string, HTMLDivElement>>
  gridHeightPx: number
}) {
  const apt = activeDrag.appointment
  const columnEl = columnRefs.current?.get(activeDrag.targetStaffId)
  if (!columnEl) return null

  const columnRect = columnEl.getBoundingClientRect()
  const height = Math.max(activeDrag.height - 2, 22)
  const yInGrid =
    pointerYInStaffGrid(
      activeDrag.clientY,
      activeDrag.targetStaffId,
      columnRefs.current ?? new Map(),
      gridHeightPx,
    ) ?? 0
  const smoothTop = Math.max(0, Math.min(gridHeightPx - activeDrag.height, yInGrid - activeDrag.grabOffsetY))
  const top = columnRect.top + STAFF_COLUMN_HEADER_PX + smoothTop
  const left = columnRect.left + 4
  const width = Math.max(columnRect.width - 8, 48)
  const crossStaff = activeDrag.targetStaffId !== activeDrag.fromStaffId

  return (
    <div
      className={`agenda-drag-ghost pointer-events-none fixed z-[60] overflow-hidden border-2 border-gold px-2 py-1 text-left text-xs leading-tight shadow-lg ${appointmentEventClass(apt.categoryId, apt.serviceId, apt.colorGroupRole)}`}
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

  return (
    <div
      className="agenda-drag-snap-indicator pointer-events-none absolute inset-x-1 z-[12] border-2 border-dashed border-gold/45 bg-gold/10"
      style={{
        top: activeDrag.snappedTopPx,
        height: Math.max(activeDrag.height - 2, 22),
      }}
      aria-hidden
    />
  )
}
