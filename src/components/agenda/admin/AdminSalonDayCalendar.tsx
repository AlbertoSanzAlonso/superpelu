import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  clampCalendarSlotHeightPx,
  currentTimeLineTopPx,
  eventTopPx,
  readStoredCalendarSlotHeightPx,
  resolveCalendarDayRange,
  storeCalendarSlotHeightPx,
  type CalendarDayRange,
} from '@/lib/agenda/adminCalendar'
import { buildStaffDayGrid, type TimeGridCell } from '@/lib/agenda/timeGrid'
import { salonSchedule } from '@/data/schedule'
import type { AdminColumnSelection } from '@/hooks/useAdminAgenda'
import { useSlotRangeDrag } from '@/hooks/agenda/useSlotRangeDrag'
import {
  AppointmentDragProvider,
  AppointmentDragSnapSlot,
  useAppointmentDrag,
} from '@/components/agenda/admin/AppointmentDragContext'
import type { AppointmentDragEndPayload } from '@/components/agenda/admin/DraggableAppointmentBlock'
import { DraggableAppointmentBlock } from '@/components/agenda/admin/DraggableAppointmentBlock'
import { ResizableBlockEvent } from '@/components/agenda/admin/ResizableBlockEvent'
import {
  pointerYInStaffGrid,
} from '@/components/agenda/admin/staffColumnHitTest'
import {
  getPendingVisualForAppointment,
  type PendingMoveSummary,
} from '@/lib/agenda/pendingMoves'
import {
  assignOverlapLanes,
  FULL_WIDTH_LANE,
  type OverlapLaneAppointment,
} from '@/lib/agenda/overlapLanes'
import {
  agendaClosedSlotClassName,
  agendaOpenSlotClassName,
  formatWorkWindowsLabel,
  slotStartInWorkWindows,
  type WorkTimeWindow,
} from '@/lib/core/scheduleHours'
import type { DayScheduleAppointment, DayScheduleBlock, StaffDaySchedule } from '@/types/booking'
import { typography } from '@/styles/typography'

type Props = {
  date: string
  schedules: StaffDaySchedule[]
  salonWindows: WorkTimeWindow[]
  selection: AdminColumnSelection | null
  formSlotTime: string | null
  formStaffId: string | null
  pendingMoveSummary: PendingMoveSummary
  moveBusy: boolean
  /** Citas desplazadas sin guardar: no crear citas ni bloquear en la grilla. */
  gridInteractionsLocked: boolean
  onToggleSlot: (staffId: string, staffName: string, time: string) => void
  onPaintSlots: (staffId: string, staffName: string, times: Set<string>) => void
  onEditAppointment: (staffId: string, apt: DayScheduleAppointment) => void
  onOpenBlock: (staffId: string, block: DayScheduleBlock) => void
  onResizeBlock: (
    staffId: string,
    block: DayScheduleBlock,
    startTime: string,
    endTime: string,
  ) => void
  onProposeAppointmentMove: (payload: AppointmentDragEndPayload) => void
  onSelectStaff: (staffId: string, staffName: string) => void
}

function StaffInitial({ name }: { name: string }) {
  const letter = name.trim().charAt(0).toUpperCase() || '?'
  return (
    <span
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gold/40 bg-gold/10 font-serif text-sm text-gold"
      aria-hidden
    >
      {letter}
    </span>
  )
}

function TimeGutterColumn({
  range,
  windows,
  compact = false,
  stickyLeft = false,
}: {
  range: CalendarDayRange
  windows: WorkTimeWindow[]
  compact?: boolean
  stickyLeft?: boolean
}) {
  return (
    <div
      className={[
        'relative isolate flex shrink-0 flex-col bg-cream/40 backdrop-blur-[2px]',
        stickyLeft ? 'sticky left-0 z-40' : 'z-30',
      ].join(' ')}
    >
      <div
        className={`sticky top-0 z-40 ${STAFF_HEADER_HEIGHT_CLASS} shrink-0 border-b border-r border-gold/20 bg-cream`}
        aria-hidden
      />
      <TimeGutter range={range} windows={windows} compact={compact} />
    </div>
  )
}

function TimeGutter({
  range,
  windows,
  compact = false,
}: {
  range: CalendarDayRange
  windows: WorkTimeWindow[]
  compact?: boolean
}) {
  return (
    <div
      className={`relative shrink-0 border-r border-gold/20 bg-cream/40 backdrop-blur-[2px] ${
        compact ? 'w-[4rem] min-w-[4rem]' : 'w-[4.5rem] min-w-[4.5rem]'
      }`}
      style={{ height: range.totalHeightPx }}
    >
      {range.timeLabels.map((time) => {
        const closed = !slotStartInWorkWindows(time, range.slotMinutes, windows)
        return (
          <div
            key={time}
            className={[
              `${typography.caption} flex items-start overflow-hidden whitespace-nowrap pt-0.5 tabular-nums backdrop-blur-[1px]`,
              compact ? 'justify-center px-2' : 'justify-end px-2',
              closed ? `${agendaClosedSlotClassName} text-charcoal-muted/80` : 'border-b border-gold/10 bg-cream/25',
            ].join(' ')}
            style={{ height: range.slotHeightPx }}
          >
            {compact ? time.slice(0, 5) : time}
          </div>
        )
      })}
    </div>
  )
}

function ColumnGrid({
  range,
  windows,
}: {
  range: CalendarDayRange
  windows: WorkTimeWindow[]
}) {
  return (
    <>
      {range.timeLabels.map((time) => {
        const closed = !slotStartInWorkWindows(time, range.slotMinutes, windows)
        return (
          <div
            key={time}
            className={closed ? agendaClosedSlotClassName : agendaOpenSlotClassName}
            style={{ height: range.slotHeightPx }}
          />
        )
      })}
    </>
  )
}

function SlotLayer({
  schedule,
  date,
  range,
  selection,
  formSlotTime,
  formStaffId,
  pointerPassthrough,
  onCellClick,
  onPaintSlots,
}: {
  schedule: StaffDaySchedule
  date: string
  range: CalendarDayRange
  selection: AdminColumnSelection | null
  formSlotTime: string | null
  formStaffId: string | null
  pointerPassthrough?: boolean
  onCellClick: (cell: TimeGridCell, shiftKey: boolean) => void
  onPaintSlots: (times: Set<string>) => void
}) {
  const cells = useMemo(
    () => buildStaffDayGrid(schedule, date, salonSchedule.slotMinutes, 'fullDisplay'),
    [schedule, date],
  )
  const selectableTimes = useMemo(
    () =>
      cells
        .filter((c) => c.status === 'free' || c.status === 'closed' || c.status === 'past')
        .map((c) => c.time),
    [cells],
  )
  const selectedTimes =
    selection?.staffId === schedule.staffId ? selection.times : EMPTY_TIMES
  const drag = useSlotRangeDrag({
    selectableTimes,
    selectedTimes,
    scope: schedule.staffId,
    enabled: !pointerPassthrough,
    onPaint: onPaintSlots,
  })

  return (
    <>
      {cells.map((cell) => {
        const isSelected =
          selection?.staffId === schedule.staffId && selection.times.has(cell.time)
        const isBookable =
          cell.status === 'free' || cell.status === 'closed' || cell.status === 'past'
        const isFormSlot =
          formStaffId === schedule.staffId &&
          formSlotTime === cell.time &&
          isBookable &&
          !isSelected

        if (cell.status === 'appointment') {
          return (
            <button
              key={cell.time}
              type="button"
              data-slot-time={cell.time}
              data-slot-scope={schedule.staffId}
              onClick={(e) => onCellClick(cell, e.shiftKey)}
              className={[
                'absolute inset-x-0 z-[15] border border-transparent',
                pointerPassthrough ? 'pointer-events-none' : 'cursor-pointer',
              ].join(' ')}
              style={{
                top: eventTopPx(cell.time, range),
                height: range.slotHeightPx,
              }}
            />
          )
        }

        if (!isBookable && cell.status !== 'block') {
          return null
        }

        return (
          <button
            key={cell.time}
            type="button"
            aria-pressed={isSelected}
            data-slot-time={cell.time}
            data-slot-scope={schedule.staffId}
            data-slot-selectable={isBookable ? '1' : undefined}
            onPointerDown={
              isBookable ? (e) => drag.onFreeSlotPointerDown(e, cell.time) : undefined
            }
            onClick={(e) => {
              if (isBookable && drag.shouldSuppressClick()) return
              onCellClick(cell, e.shiftKey)
            }}
            className={[
              'absolute inset-x-0 z-[15] border border-transparent transition-colors',
              pointerPassthrough ? 'pointer-events-none' : '',
              'cursor-pointer hover:bg-gold/10',
              isSelected ? 'bg-gold/20 ring-2 ring-inset ring-gold' : '',
              isFormSlot ? 'ring-2 ring-inset ring-gold/50' : '',
            ].join(' ')}
            style={{
              top: eventTopPx(cell.time, range),
              height: range.slotHeightPx,
            }}
          />
        )
      })}
    </>
  )
}

const EMPTY_TIMES: ReadonlySet<string> = new Set()

const STAFF_HEADER_HEIGHT_CLASS = 'h-[3.25rem]'

function StaffColumnHeader({
  schedule,
  onSelectStaff,
}: {
  schedule: StaffDaySchedule
  onSelectStaff: (staffId: string, staffName: string) => void
}) {
  return (
    <div
      className={`sticky top-0 z-40 flex ${STAFF_HEADER_HEIGHT_CLASS} shrink-0 items-center gap-2 border-b border-gold/20 bg-cream px-3 backdrop-blur-none`}
    >
      <StaffInitial name={schedule.staffName} />
      <button
        type="button"
        onClick={() => onSelectStaff(schedule.staffId, schedule.staffName)}
        className="min-w-0 cursor-pointer text-left transition-colors hover:text-gold"
        aria-label={`Seleccionar ${schedule.staffName}`}
      >
        {schedule.working && schedule.windows.length > 0 ? (
          <div className="min-w-0">
            <p className={`${typography.label} truncate`}>{schedule.staffName}</p>
            <p className="text-[10px] tabular-nums text-charcoal-muted">
              {formatWorkWindowsLabel(schedule.windows)}
            </p>
          </div>
        ) : (
          <span className={`${typography.label} truncate`}>{schedule.staffName}</span>
        )}
      </button>
    </div>
  )
}

function StaffColumn({
  schedule,
  date,
  range,
  nowLineTop,
  selection,
  formSlotTime,
  formStaffId,
  pendingMoveSummary,
  gridInteractionsLocked,
  dragEnabled,
  columnRef,
  columnTopFromClientY,
  onToggleSlot,
  onPaintSlots,
  onEditAppointment,
  onOpenBlock,
  onResizeBlock,
  onSelectStaff,
}: {
  schedule: StaffDaySchedule
  date: string
  range: CalendarDayRange
  nowLineTop: number | null
  selection: AdminColumnSelection | null
  formSlotTime: string | null
  formStaffId: string | null
  pendingMoveSummary: PendingMoveSummary
  gridInteractionsLocked: boolean
  dragEnabled: boolean
  columnRef: (el: HTMLDivElement | null) => void
  columnTopFromClientY: (clientY: number, staffId: string) => number | null
  onToggleSlot: (staffId: string, staffName: string, time: string) => void
  onPaintSlots: (staffId: string, staffName: string, times: Set<string>) => void
  onEditAppointment: (staffId: string, apt: DayScheduleAppointment) => void
  onOpenBlock: (staffId: string, block: DayScheduleBlock) => void
  onResizeBlock: (
    staffId: string,
    block: DayScheduleBlock,
    startTime: string,
    endTime: string,
  ) => void
  onSelectStaff: (staffId: string, staffName: string) => void
}) {
  const { activeDrag, isDragSessionActive } = useAppointmentDrag()
  const isDropTarget = activeDrag?.targetStaffId === schedule.staffId
  const slotsLocked = gridInteractionsLocked || isDragSessionActive

  const laneLayouts = useMemo(() => {
    const inputs: OverlapLaneAppointment[] = []
    const seen = new Set<string>()

    for (const apt of schedule.appointments) {
      const visual = getPendingVisualForAppointment(pendingMoveSummary, apt.id)
      if (visual && visual.targetStaffId !== schedule.staffId) {
        inputs.push({
          id: apt.id,
          serviceId: apt.serviceId,
          startTime: visual.originStartTime,
          durationMinutes: apt.durationMinutes,
          colorGroupRole: apt.colorGroupRole,
          bookingPattern: apt.bookingPattern,
        })
        seen.add(apt.id)
        continue
      }
      inputs.push({
        id: apt.id,
        serviceId: apt.serviceId,
        startTime: visual ? visual.targetStartTime : apt.startTime,
        durationMinutes: apt.durationMinutes,
        colorGroupRole: apt.colorGroupRole,
        bookingPattern: apt.bookingPattern,
      })
      seen.add(apt.id)
    }

    for (const { latest } of pendingMoveSummary.byAppointmentId.values()) {
      const visual = getPendingVisualForAppointment(pendingMoveSummary, latest.appointment.id)
      if (!visual || visual.targetStaffId !== schedule.staffId) continue
      if (seen.has(latest.appointment.id)) continue
      inputs.push({
        id: latest.appointment.id,
        serviceId: latest.appointment.serviceId,
        startTime: visual.targetStartTime,
        durationMinutes: latest.appointment.durationMinutes,
        colorGroupRole: latest.appointment.colorGroupRole,
        bookingPattern: latest.appointment.bookingPattern,
      })
    }

    return assignOverlapLanes(inputs)
  }, [schedule, pendingMoveSummary])

  function handleCellClick(cell: TimeGridCell, shiftKey: boolean) {
    if (slotsLocked && cell.status !== 'appointment') return
    if (cell.status === 'appointment' && cell.appointmentId) {
      const apt = schedule.appointments.find((a) => a.id === cell.appointmentId)
      if (apt) onEditAppointment(schedule.staffId, apt)
      return
    }
    if (cell.status === 'block' && cell.blockId && !shiftKey) {
      const block = schedule.blocks.find((b) => b.id === cell.blockId)
      if (block) onOpenBlock(schedule.staffId, block)
      return
    }
    if (
      cell.status === 'free' ||
      cell.status === 'block' ||
      cell.status === 'closed' ||
      cell.status === 'past'
    ) {
      onToggleSlot(schedule.staffId, schedule.staffName, cell.time)
    }
  }

  function handlePaintSlots(times: Set<string>) {
    onPaintSlots(schedule.staffId, schedule.staffName, times)
  }

  const columnWindows =
    schedule.working && schedule.windows.length > 0 ? schedule.windows : []

  return (
    <div
      ref={columnRef}
      data-staff-column-id={schedule.staffId}
      data-staff-column-working={columnWindows.length > 0 ? 'true' : 'false'}
      className={[
        'min-w-[11rem] flex-1 overflow-hidden border-l border-gold/20 transition-colors duration-150',
        isDropTarget ? 'bg-gold/[0.06] ring-2 ring-inset ring-gold/25' : '',
      ].join(' ')}
    >
      <StaffColumnHeader schedule={schedule} onSelectStaff={onSelectStaff} />

      <div
        className="relative w-full min-w-0 select-none overflow-x-clip overflow-y-hidden"
        style={{ height: range.totalHeightPx }}
      >
        <ColumnGrid range={range} windows={columnWindows} />
        <AppointmentDragSnapSlot staffId={schedule.staffId} activeDrag={activeDrag} />
        <SlotLayer
          schedule={schedule}
          date={date}
          range={range}
          selection={selection}
          formSlotTime={formSlotTime}
          formStaffId={formStaffId}
          pointerPassthrough={slotsLocked}
          onCellClick={handleCellClick}
          onPaintSlots={handlePaintSlots}
        />

        {schedule.appointments.map((apt) => (
          <DraggableAppointmentBlock
            key={apt.id}
            apt={apt}
            staffId={schedule.staffId}
            range={range}
            pendingVisual={getPendingVisualForAppointment(pendingMoveSummary, apt.id)}
            dragEnabled={dragEnabled}
            laneLayout={laneLayouts.get(apt.id) ?? FULL_WIDTH_LANE}
            columnTopFromClientY={columnTopFromClientY}
          />
        ))}

        {[...pendingMoveSummary.byAppointmentId.values()].map(({ latest }) => {
          const visual = getPendingVisualForAppointment(
            pendingMoveSummary,
            latest.appointment.id,
          )
          if (!visual) return null
          if (visual.targetStaffId !== schedule.staffId) return null
          if (visual.originStaffId === schedule.staffId) return null
          if (schedule.appointments.some((a) => a.id === latest.appointment.id)) return null

          return (
            <DraggableAppointmentBlock
              key={`${latest.appointment.id}-relocated`}
              apt={latest.appointment}
              staffId={schedule.staffId}
              range={range}
              pendingVisual={visual}
              dragEnabled={dragEnabled}
              laneLayout={laneLayouts.get(latest.appointment.id) ?? FULL_WIDTH_LANE}
              columnTopFromClientY={columnTopFromClientY}
            />
          )
        })}

        {schedule.blocks.map((block) => (
          <ResizableBlockEvent
            key={block.id}
            block={block}
            range={range}
            interactionsLocked={slotsLocked}
            resizeEnabled={dragEnabled && !slotsLocked}
            staffId={schedule.staffId}
            columnTopFromClientY={columnTopFromClientY}
            onOpen={() => onOpenBlock(schedule.staffId, block)}
            onResizeEnd={(b, startTime, endTime) =>
              onResizeBlock(schedule.staffId, b, startTime, endTime)
            }
          />
        ))}

        {nowLineTop !== null && (
          <div
            className="pointer-events-none absolute right-0 left-0 z-20 border-t-2 border-red-500/80"
            style={{ top: nowLineTop }}
            aria-hidden
          />
        )}
      </div>
    </div>
  )
}

export function AdminSalonDayCalendar({
  date,
  schedules,
  salonWindows,
  selection,
  formSlotTime,
  formStaffId,
  pendingMoveSummary,
  moveBusy,
  gridInteractionsLocked,
  onToggleSlot,
  onPaintSlots,
  onEditAppointment,
  onOpenBlock,
  onResizeBlock,
  onProposeAppointmentMove,
  onSelectStaff,
}: Props) {
  const [slotHeightPx, setSlotHeightPx] = useState(readStoredCalendarSlotHeightPx)
  const scrollRef = useRef<HTMLDivElement>(null)
  const slotHeightRef = useRef(slotHeightPx)
  const range = useMemo(
    () => resolveCalendarDayRange(schedules, slotHeightPx, salonWindows),
    [schedules, slotHeightPx, salonWindows],
  )
  /** Sombreado de la franja de horas = horario general del salón (API), no schedule.ts. */
  const gutterWindows = salonWindows
  const nowLineTop = useMemo(() => currentTimeLineTopPx(date, range), [date, range])
  const columnRefs = useRef(new Map<string, HTMLDivElement>())

  useEffect(() => {
    slotHeightRef.current = slotHeightPx
    storeCalendarSlotHeightPx(slotHeightPx)
  }, [slotHeightPx])

  useEffect(() => {
    if (schedules.length === 0) return
    const el = scrollRef.current
    if (!el) return

    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()

      const currentHeight = slotHeightRef.current
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1
      const nextHeight = clampCalendarSlotHeightPx(currentHeight * factor)
      if (nextHeight === currentHeight) return

      const rect = el.getBoundingClientRect()
      const pointerY = e.clientY - rect.top
      const contentY = el.scrollTop + pointerY
      const scale = nextHeight / currentHeight

      slotHeightRef.current = nextHeight
      setSlotHeightPx(nextHeight)
      requestAnimationFrame(() => {
        el.scrollTop = contentY * scale - pointerY
      })
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [schedules.length])

  const setColumnRef = useCallback((staffId: string, el: HTMLDivElement | null) => {
    if (el) columnRefs.current.set(staffId, el)
    else columnRefs.current.delete(staffId)
  }, [])

  const columnTopFromClientY = useCallback(
    (clientY: number, staffId: string): number | null => {
      return pointerYInStaffGrid(clientY, staffId, columnRefs.current, range.totalHeightPx)
    },
    [range.totalHeightPx],
  )

  const dragEnabled = !moveBusy

  const handleClickWithoutDrag = useCallback(
    (appointmentId: string) => {
      for (const s of schedules) {
        const apt = s.appointments.find((a) => a.id === appointmentId)
        if (apt) {
          onEditAppointment(s.staffId, apt)
          return
        }
      }
      const entry = pendingMoveSummary.byAppointmentId.get(appointmentId)
      if (entry) {
        onEditAppointment(entry.latest.toStaffId, entry.latest.appointment)
      }
    },
    [schedules, pendingMoveSummary, onEditAppointment],
  )

  if (schedules.length === 0) {
    return <p className={`${typography.caption} text-center`}>No hay personal activo.</p>
  }

  return (
    <AppointmentDragProvider
      range={range}
      dragEnabled={dragEnabled}
      schedules={schedules}
      columnRefs={columnRefs}
      onDragEnd={onProposeAppointmentMove}
      onClickWithoutDrag={handleClickWithoutDrag}
    >
      <div
        ref={scrollRef}
        className="agenda-calendar-scroll h-full min-h-0 overflow-auto border border-gold/25 bg-cream/40 backdrop-blur-[2px]"
        title="Ctrl + rueda para zoom"
      >
        <div className="flex w-max min-w-full">
          <TimeGutterColumn range={range} windows={gutterWindows} stickyLeft />

          <div className="flex min-w-0 flex-1">
            {schedules.map((schedule, index) => (
              <div key={schedule.staffId} className="flex min-w-0 flex-1">
                {index > 0 && (
                  <TimeGutterColumn range={range} windows={gutterWindows} compact />
                )}
                <StaffColumn
                  schedule={schedule}
                  date={date}
                  range={range}
                  nowLineTop={nowLineTop}
                  selection={selection}
                  formSlotTime={formSlotTime}
                  formStaffId={formStaffId}
                  pendingMoveSummary={pendingMoveSummary}
                  gridInteractionsLocked={gridInteractionsLocked}
                  dragEnabled={dragEnabled}
                  columnRef={(el) => setColumnRef(schedule.staffId, el)}
                  columnTopFromClientY={columnTopFromClientY}
                  onToggleSlot={onToggleSlot}
                  onPaintSlots={onPaintSlots}
                  onEditAppointment={onEditAppointment}
                  onOpenBlock={onOpenBlock}
                  onResizeBlock={onResizeBlock}
                  onSelectStaff={onSelectStaff}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppointmentDragProvider>
  )
}
