import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  blockDurationMinutes,
  clampCalendarSlotHeightPx,
  currentTimeLineTopPx,
  eventHeightPx,
  eventTopPx,
  readStoredCalendarSlotHeightPx,
  resolveCalendarDayRange,
  storeCalendarSlotHeightPx,
  type CalendarDayRange,
} from '@/lib/agenda/adminCalendar'
import { blockEventClass } from '@/lib/catalog/serviceCategoryColors'
import { buildStaffDayGrid, type TimeGridCell } from '@/lib/agenda/timeGrid'
import type { AdminColumnSelection } from '@/hooks/useAdminAgenda'
import {
  AppointmentDragProvider,
  AppointmentDragSnapSlot,
  useAppointmentDrag,
} from '@/components/agenda/admin/AppointmentDragContext'
import type { AppointmentDragEndPayload } from '@/components/agenda/admin/DraggableAppointmentBlock'
import { DraggableAppointmentBlock } from '@/components/agenda/admin/DraggableAppointmentBlock'
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
  onEditAppointment: (staffId: string, apt: DayScheduleAppointment) => void
  onOpenBlock: (staffId: string, block: DayScheduleBlock) => void
  onProposeAppointmentMove: (payload: AppointmentDragEndPayload) => void
  activeStaffId?: string | null
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
      className={`relative z-10 shrink-0 border-r border-gold/20 bg-cream/40 backdrop-blur-[2px] ${
        compact ? 'w-[2.75rem] min-w-[2.75rem]' : 'w-[4.5rem] min-w-[4.5rem]'
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
              compact ? 'justify-center px-0.5 text-[10px]' : 'justify-end pr-2',
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
}: {
  schedule: StaffDaySchedule
  date: string
  range: CalendarDayRange
  selection: AdminColumnSelection | null
  formSlotTime: string | null
  formStaffId: string | null
  pointerPassthrough?: boolean
  onCellClick: (cell: TimeGridCell, shiftKey: boolean) => void
}) {
  const cells = useMemo(() => buildStaffDayGrid(schedule, date), [schedule, date])

  return (
    <>
      {cells.map((cell) => {
        const isSelected =
          selection?.staffId === schedule.staffId && selection.times.has(cell.time)
        const isFormSlot =
          formStaffId === schedule.staffId &&
          formSlotTime === cell.time &&
          cell.status === 'free' &&
          !isSelected

        if (cell.status === 'closed') {
          return null
        }

        if (cell.status === 'past') {
          return (
            <div
              key={cell.time}
              className="pointer-events-none absolute inset-x-0 z-[14] bg-charcoal/[0.06]"
              style={{
                top: eventTopPx(cell.time, range),
                height: range.slotHeightPx,
              }}
            />
          )
        }

        return (
          <button
            key={cell.time}
            type="button"
            aria-pressed={isSelected}
            onClick={(e) => onCellClick(cell, e.shiftKey)}
            className={[
              'absolute inset-x-0 z-[15] border border-transparent transition-colors',
              pointerPassthrough ? 'pointer-events-none' : '',
              cell.status === 'free' ? 'cursor-pointer hover:bg-gold/10' : 'cursor-pointer',
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

function BlockEvent({
  block,
  range,
  interactionsLocked,
  onOpen,
}: {
  block: DayScheduleBlock
  range: CalendarDayRange
  interactionsLocked: boolean
  onOpen: () => void
}) {
  const duration = blockDurationMinutes(block.startTime, block.endTime)
  const top = eventTopPx(block.startTime, range)
  const height = eventHeightPx(duration, range)

  return (
    <button
      type="button"
      disabled={interactionsLocked}
      onClick={(e) => {
        e.stopPropagation()
        if (interactionsLocked) return
        onOpen()
      }}
      className={`absolute inset-x-1 z-20 cursor-pointer overflow-hidden border border-dashed px-2 py-1 text-left text-xs transition-colors hover:border-charcoal/40 disabled:cursor-not-allowed disabled:opacity-60 ${blockEventClass()}`}
      style={{ top, height: Math.max(height - 2, 22) }}
      title={block.note ? `Bloqueado — ${block.note}` : 'Bloqueado — ver observaciones'}
    >
      <span className="font-medium">Bloqueado</span>
      {block.note && <span className="mt-0.5 block truncate opacity-80">{block.note}</span>}
    </button>
  )
}

const STAFF_HEADER_HEIGHT_CLASS = 'h-[3.25rem]'

function StaffColumnHeader({
  schedule,
  selected,
  onSelectStaff,
}: {
  schedule: StaffDaySchedule
  selected: boolean
  onSelectStaff: (staffId: string, staffName: string) => void
}) {
  return (
    <div
      className={`sticky top-0 z-40 flex ${STAFF_HEADER_HEIGHT_CLASS} shrink-0 items-center gap-2 border-b border-gold/20 px-3 backdrop-blur-none ${
        selected ? 'bg-gold/15' : 'bg-cream'
      }`}
    >
      <StaffInitial name={schedule.staffName} />
      <button
        type="button"
        onClick={() => onSelectStaff(schedule.staffId, schedule.staffName)}
        className="min-w-0 cursor-pointer text-left transition-colors hover:text-gold"
        aria-label={`Seleccionar ${schedule.staffName}`}
        aria-pressed={selected}
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
  onEditAppointment,
  onOpenBlock,
  activeStaffId,
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
  onEditAppointment: (staffId: string, apt: DayScheduleAppointment) => void
  onOpenBlock: (staffId: string, block: DayScheduleBlock) => void
  activeStaffId: string | null
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
    if (cell.status === 'past') return
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
    if (cell.status === 'free' || cell.status === 'block') {
      onToggleSlot(schedule.staffId, schedule.staffName, cell.time)
    }
  }

  const columnWindows =
    schedule.working && schedule.windows.length > 0 ? schedule.windows : []

  return (
    <div
      ref={columnRef}
      data-staff-column-id={schedule.staffId}
      data-staff-column-working={columnWindows.length > 0 ? 'true' : 'false'}
      className={[
        'min-w-[11rem] flex-1 border-l border-gold/20 transition-colors duration-150',
        isDropTarget ? 'bg-gold/[0.06] ring-2 ring-inset ring-gold/25' : '',
      ].join(' ')}
    >
      <StaffColumnHeader
        schedule={schedule}
        selected={activeStaffId === schedule.staffId}
        onSelectStaff={onSelectStaff}
      />

      <div className="relative" style={{ height: range.totalHeightPx }}>
        <ColumnGrid range={range} windows={columnWindows} />
        <AppointmentDragSnapSlot staffId={schedule.staffId} activeDrag={activeDrag} />
        {columnWindows.length > 0 ? (
        <SlotLayer
          schedule={schedule}
          date={date}
          range={range}
          selection={selection}
          formSlotTime={formSlotTime}
          formStaffId={formStaffId}
          pointerPassthrough={slotsLocked}
          onCellClick={handleCellClick}
        />
        ) : null}

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
          <BlockEvent
            key={block.id}
            block={block}
            range={range}
            interactionsLocked={slotsLocked}
            onOpen={() => onOpenBlock(schedule.staffId, block)}
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
  onEditAppointment,
  onOpenBlock,
  onProposeAppointmentMove,
  activeStaffId = null,
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
        <div className="flex min-w-max">
          <div className="sticky left-0 z-40 isolate shrink-0 bg-cream/40 backdrop-blur-[2px]">
            <div
              className={`sticky top-0 z-50 ${STAFF_HEADER_HEIGHT_CLASS} shrink-0 border-b border-r border-gold/20 bg-cream`}
              aria-hidden
            />
            <TimeGutter range={range} windows={gutterWindows} />
          </div>

          <div className="flex flex-1">
            {schedules.map((schedule, index) => (
              <div key={schedule.staffId} className="flex">
                {index > 0 && (
                  <div className="flex flex-col">
                    <div
                      className={`sticky top-0 z-40 ${STAFF_HEADER_HEIGHT_CLASS} shrink-0 border-b border-r border-gold/20 bg-cream`}
                      aria-hidden
                    />
                    <TimeGutter range={range} windows={gutterWindows} compact />
                  </div>
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
                  onEditAppointment={onEditAppointment}
                  onOpenBlock={onOpenBlock}
                  activeStaffId={activeStaffId}
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
