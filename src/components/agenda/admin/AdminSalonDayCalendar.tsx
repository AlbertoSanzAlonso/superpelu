import { useCallback, useMemo, useRef } from 'react'
import {
  blockDurationMinutes,
  CALENDAR_SLOT_HEIGHT_PX,
  currentTimeLineTopPx,
  eventHeightPx,
  eventTopPx,
  resolveCalendarDayRange,
  type CalendarDayRange,
} from '@/lib/adminCalendar'
import { blockEventClass } from '@/lib/serviceCategoryColors'
import { buildStaffDayGrid, type TimeGridCell } from '@/lib/timeGrid'
import type { AdminColumnSelection } from '@/hooks/useAdminAgenda'
import {
  DraggableAppointmentBlock,
  type AppointmentDragEndPayload,
} from '@/components/agenda/admin/DraggableAppointmentBlock'
import {
  getPendingVisualForAppointment,
  type PendingMoveSummary,
} from '@/lib/pendingAppointmentMoves'
import type { DayScheduleAppointment, DayScheduleBlock, StaffDaySchedule } from '@/types/booking'
import { typography } from '@/styles/typography'

type Props = {
  date: string
  schedules: StaffDaySchedule[]
  selection: AdminColumnSelection | null
  formSlotTime: string | null
  formStaffId: string | null
  pendingMoveSummary: PendingMoveSummary
  moveBusy: boolean
  onToggleSlot: (staffId: string, staffName: string, time: string) => void
  onEditAppointment: (staffId: string, apt: DayScheduleAppointment) => void
  onOpenBlock: (staffId: string, block: DayScheduleBlock) => void
  onProposeAppointmentMove: (payload: AppointmentDragEndPayload) => void
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

function TimeGutter({ range }: { range: CalendarDayRange }) {
  return (
    <div
      className="w-[4.5rem] min-w-[4.5rem] shrink-0 border-r border-gold/20"
      style={{ height: range.totalHeightPx }}
    >
      {range.timeLabels.map((time) => (
        <div
          key={time}
          className={`${typography.caption} flex items-start justify-end overflow-visible whitespace-nowrap border-b border-gold/10 pr-2 pt-0.5 tabular-nums`}
          style={{ height: CALENDAR_SLOT_HEIGHT_PX }}
        >
          {time}
        </div>
      ))}
    </div>
  )
}

function ColumnGrid({ range }: { range: CalendarDayRange }) {
  return (
    <>
      {range.timeLabels.map((time) => (
        <div
          key={time}
          className="border-b border-gold/10 bg-[repeating-linear-gradient(-45deg,transparent,transparent_4px,rgba(201,169,98,0.04)_4px,rgba(201,169,98,0.04)_8px)]"
          style={{ height: CALENDAR_SLOT_HEIGHT_PX }}
        />
      ))}
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
  onCellClick,
}: {
  schedule: StaffDaySchedule
  date: string
  range: CalendarDayRange
  selection: AdminColumnSelection | null
  formSlotTime: string | null
  formStaffId: string | null
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

        if (cell.status === 'past') {
          return (
            <div
              key={cell.time}
              className="absolute inset-x-0 bg-charcoal/[0.03]"
              style={{
                top: eventTopPx(cell.time, range),
                height: CALENDAR_SLOT_HEIGHT_PX,
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
              cell.status === 'free' ? 'cursor-pointer hover:bg-gold/10' : 'cursor-pointer',
              isSelected ? 'bg-gold/20 ring-2 ring-inset ring-gold' : '',
              isFormSlot ? 'ring-2 ring-inset ring-gold/50' : '',
            ].join(' ')}
            style={{
              top: eventTopPx(cell.time, range),
              height: CALENDAR_SLOT_HEIGHT_PX,
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
  onOpen,
}: {
  block: DayScheduleBlock
  range: CalendarDayRange
  onOpen: () => void
}) {
  const duration = blockDurationMinutes(block.startTime, block.endTime)
  const top = eventTopPx(block.startTime, range)
  const height = eventHeightPx(duration, range)

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onOpen()
      }}
      className={`absolute inset-x-1 z-20 overflow-hidden border border-dashed px-2 py-1 text-left text-xs transition-colors hover:border-charcoal/40 ${blockEventClass()}`}
      style={{ top, height: Math.max(height - 2, 22) }}
      title={block.note ? `Bloqueado — ${block.note}` : 'Bloqueado — ver observaciones'}
    >
      <span className="font-medium">Bloqueado</span>
      {block.note && <span className="mt-0.5 block truncate opacity-80">{block.note}</span>}
    </button>
  )
}

const STAFF_HEADER_HEIGHT_CLASS = 'h-[3.25rem]'

function StaffColumnHeader({ schedule }: { schedule: StaffDaySchedule }) {
  return (
    <div
      className={`sticky top-0 z-30 flex ${STAFF_HEADER_HEIGHT_CLASS} shrink-0 items-center gap-2 border-b border-gold/20 bg-cream px-3`}
    >
      <StaffInitial name={schedule.staffName} />
      {schedule.working && schedule.window ? (
        <div className="min-w-0">
          <p className={`${typography.label} truncate`}>{schedule.staffName}</p>
          <p className="text-[10px] tabular-nums text-charcoal-muted">
            {schedule.window.startTime}–{schedule.window.endTime}
          </p>
        </div>
      ) : (
        <span className={`${typography.label} truncate`}>{schedule.staffName}</span>
      )}
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
  dragEnabled,
  columnRef,
  resolveStaffIdAtPoint,
  columnTopFromClientY,
  onToggleSlot,
  onEditAppointment,
  onOpenBlock,
  onProposeAppointmentMove,
}: {
  schedule: StaffDaySchedule
  date: string
  range: CalendarDayRange
  nowLineTop: number | null
  selection: AdminColumnSelection | null
  formSlotTime: string | null
  formStaffId: string | null
  pendingMoveSummary: PendingMoveSummary
  dragEnabled: boolean
  columnRef: (el: HTMLDivElement | null) => void
  resolveStaffIdAtPoint: (clientX: number) => string | null
  columnTopFromClientY: (clientY: number, staffId: string) => number | null
  onToggleSlot: (staffId: string, staffName: string, time: string) => void
  onEditAppointment: (staffId: string, apt: DayScheduleAppointment) => void
  onOpenBlock: (staffId: string, block: DayScheduleBlock) => void
  onProposeAppointmentMove: (payload: AppointmentDragEndPayload) => void
}) {
  function handleCellClick(cell: TimeGridCell, shiftKey: boolean) {
    if (cell.status === 'past') return
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

  if (!schedule.working || !schedule.window) {
    return (
      <div className="min-w-[11rem] flex-1 border-l border-gold/20">
        <StaffColumnHeader schedule={schedule} />
        <div className="flex items-center justify-center bg-charcoal/[0.03] p-8">
          <p className={typography.caption}>No trabaja</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-w-[11rem] flex-1 border-l border-gold/20">
      <StaffColumnHeader schedule={schedule} />

      <div
        ref={columnRef}
        data-staff-column-id={schedule.staffId}
        className="relative"
        style={{ height: range.totalHeightPx }}
      >
        <ColumnGrid range={range} />
        <SlotLayer
          schedule={schedule}
          date={date}
          range={range}
          selection={selection}
          formSlotTime={formSlotTime}
          formStaffId={formStaffId}
          onCellClick={handleCellClick}
        />

        {schedule.appointments.map((apt) => (
          <DraggableAppointmentBlock
            key={apt.id}
            apt={apt}
            staffId={schedule.staffId}
            range={range}
            pendingVisual={getPendingVisualForAppointment(pendingMoveSummary, apt.id)}
            dragEnabled={dragEnabled}
            resolveStaffIdAtPoint={resolveStaffIdAtPoint}
            columnTopFromClientY={columnTopFromClientY}
            onDragEnd={onProposeAppointmentMove}
            onClick={() => onEditAppointment(schedule.staffId, apt)}
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
              resolveStaffIdAtPoint={resolveStaffIdAtPoint}
              columnTopFromClientY={columnTopFromClientY}
              onDragEnd={onProposeAppointmentMove}
              onClick={() => onEditAppointment(schedule.staffId, latest.appointment)}
            />
          )
        })}

        {schedule.blocks.map((block) => (
          <BlockEvent
            key={block.id}
            block={block}
            range={range}
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
  selection,
  formSlotTime,
  formStaffId,
  pendingMoveSummary,
  moveBusy,
  onToggleSlot,
  onEditAppointment,
  onOpenBlock,
  onProposeAppointmentMove,
}: Props) {
  const range = useMemo(() => resolveCalendarDayRange(schedules), [schedules])
  const nowLineTop = useMemo(() => currentTimeLineTopPx(date, range), [date, range])
  const columnRefs = useRef(new Map<string, HTMLDivElement>())

  const setColumnRef = useCallback((staffId: string, el: HTMLDivElement | null) => {
    if (el) columnRefs.current.set(staffId, el)
    else columnRefs.current.delete(staffId)
  }, [])

  const resolveStaffIdAtPoint = useCallback((clientX: number): string | null => {
    for (const [staffId, el] of columnRefs.current) {
      const rect = el.getBoundingClientRect()
      if (clientX >= rect.left && clientX <= rect.right) return staffId
    }
    return null
  }, [])

  const columnTopFromClientY = useCallback((clientY: number, staffId: string): number | null => {
    const el = columnRefs.current.get(staffId)
    if (!el) return null
    const rect = el.getBoundingClientRect()
    return clientY - rect.top
  }, [])

  const dragEnabled = !moveBusy

  if (schedules.length === 0) {
    return <p className={`${typography.caption} text-center`}>No hay personal activo.</p>
  }

  return (
    <div className="h-full min-h-0 overflow-auto border border-gold/25 bg-cream">
      <div className="flex min-w-max">
        <div className="sticky left-0 z-20 shrink-0 bg-cream">
          <div
            className={`sticky top-0 z-40 ${STAFF_HEADER_HEIGHT_CLASS} shrink-0 border-b border-r border-gold/20 bg-cream`}
            aria-hidden
          />
          <TimeGutter range={range} />
        </div>

        <div className="flex flex-1">
          {schedules.map((schedule) => (
            <StaffColumn
              key={schedule.staffId}
              schedule={schedule}
              date={date}
              range={range}
              nowLineTop={nowLineTop}
              selection={selection}
              formSlotTime={formSlotTime}
              formStaffId={formStaffId}
              pendingMoveSummary={pendingMoveSummary}
              dragEnabled={dragEnabled}
              columnRef={(el) => setColumnRef(schedule.staffId, el)}
              resolveStaffIdAtPoint={resolveStaffIdAtPoint}
              columnTopFromClientY={columnTopFromClientY}
              onToggleSlot={onToggleSlot}
              onEditAppointment={onEditAppointment}
              onOpenBlock={onOpenBlock}
              onProposeAppointmentMove={onProposeAppointmentMove}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
