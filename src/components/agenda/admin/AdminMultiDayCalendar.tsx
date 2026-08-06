import { useEffect, useMemo, useRef, useState } from 'react'
import {
  clampCalendarSlotHeightPx,
  currentTimeLineTopPx,
  eventHeightPx,
  eventTopPx,
  readStoredCalendarSlotHeightPx,
  resolveCalendarDayRange,
  storeCalendarSlotHeightPx,
  type CalendarDayRange,
} from '@/lib/agenda/adminCalendar'
import type { ScheduleDayBundle } from '@/lib/api/admin'
import type { AdminColumnSelection } from '@/hooks/useAdminAgenda'
import { useSlotRangeDrag } from '@/hooks/agenda/useSlotRangeDrag'
import { ResizableBlockEvent } from '@/components/agenda/admin/ResizableBlockEvent'
import {
  agendaClosedSlotClassName,
  agendaOpenSlotClassName,
  slotStartInWorkWindows,
  type WorkTimeWindow,
} from '@/lib/core/scheduleHours'
import type { DayScheduleAppointment, DayScheduleBlock, StaffDaySchedule } from '@/types/booking'
import { typography } from '@/styles/typography'
import { buildStaffDayGrid, type TimeGridCell } from '@/lib/agenda/timeGrid'
import { appointmentEventClass } from '@/lib/catalog/serviceCategoryColors'
import { formatAppointmentTimeRange } from '@/lib/booking/occupancy'
import { WashPhaseIcon } from '@/components/agenda/WashPhaseIcon'
import { isColorGroupWashRow } from '@/lib/booking/occupancy'

const STAFF_HEADER_HEIGHT_CLASS = 'h-[3.25rem]'
const EMPTY_TIMES: ReadonlySet<string> = new Set()

type Props = {
  staffId: string
  staffName: string
  dayBundles: ScheduleDayBundle[]
  selection: AdminColumnSelection | null
  formSlotTime: string | null
  formStaffId: string | null
  gridInteractionsLocked: boolean
  onFocusDate: (date: string) => void
  onToggleSlot: (date: string, staffId: string, staffName: string, time: string) => void
  onPaintSlots: (date: string, staffId: string, staffName: string, times: Set<string>) => void
  onEditAppointment: (date: string, staffId: string, apt: DayScheduleAppointment) => void
  onOpenBlock: (date: string, staffId: string, block: DayScheduleBlock) => void
  onResizeBlock: (
    date: string,
    staffId: string,
    block: DayScheduleBlock,
    startTime: string,
    endTime: string,
  ) => void
}

function shortDayLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('es-ES', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
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
              `${typography.caption} flex items-start overflow-hidden whitespace-nowrap pt-0.5 tabular-nums`,
              compact ? 'justify-center px-0.5 text-[10px]' : 'justify-end pr-2',
              closed
                ? `${agendaClosedSlotClassName} text-charcoal-muted/80`
                : 'border-b border-gold/10 bg-cream/25',
            ].join(' ')}
            style={{ height: range.slotHeightPx }}
          >
            {time}
          </div>
        )
      })}
    </div>
  )
}

function DayColumn({
  date,
  schedule,
  range,
  salonWindows,
  nowLineTop,
  selection,
  formSlotTime,
  formStaffId,
  gridInteractionsLocked,
  staffId,
  staffName,
  onFocusDate,
  onToggleSlot,
  onPaintSlots,
  onEditAppointment,
  onOpenBlock,
  onResizeBlock,
}: {
  date: string
  schedule: StaffDaySchedule
  range: CalendarDayRange
  salonWindows: WorkTimeWindow[]
  nowLineTop: number | null
  selection: AdminColumnSelection | null
  formSlotTime: string | null
  formStaffId: string | null
  gridInteractionsLocked: boolean
  staffId: string
  staffName: string
  onFocusDate: (date: string) => void
  onToggleSlot: (date: string, staffId: string, staffName: string, time: string) => void
  onPaintSlots: (date: string, staffId: string, staffName: string, times: Set<string>) => void
  onEditAppointment: (date: string, staffId: string, apt: DayScheduleAppointment) => void
  onOpenBlock: (date: string, staffId: string, block: DayScheduleBlock) => void
  onResizeBlock: (
    date: string,
    staffId: string,
    block: DayScheduleBlock,
    startTime: string,
    endTime: string,
  ) => void
}) {
  const gridRef = useRef<HTMLDivElement>(null)
  const cells = useMemo(() => buildStaffDayGrid(schedule, date), [schedule, date])
  const selectableTimes = useMemo(
    () => cells.filter((c) => c.status === 'free').map((c) => c.time),
    [cells],
  )
  const selectedTimes = selection?.staffId === staffId ? selection.times : EMPTY_TIMES
  const drag = useSlotRangeDrag({
    selectableTimes,
    selectedTimes,
    scope: `${staffId}:${date}`,
    enabled: !gridInteractionsLocked,
    onPaint: (times) => {
      onFocusDate(date)
      onPaintSlots(date, staffId, staffName, times)
    },
  })

  function columnTopFromClientY(clientY: number): number | null {
    const el = gridRef.current
    if (!el) return null
    const rect = el.getBoundingClientRect()
    return Math.max(0, Math.min(range.totalHeightPx, clientY - rect.top))
  }

  function handleCellClick(cell: TimeGridCell) {
    onFocusDate(date)
    if (cell.status === 'past') return
    if (gridInteractionsLocked && cell.status !== 'appointment') return
    if (cell.status === 'appointment' && cell.appointmentId) {
      const apt = schedule.appointments.find((a) => a.id === cell.appointmentId)
      if (apt) onEditAppointment(date, staffId, apt)
      return
    }
    if (cell.status === 'block' && cell.blockId) {
      const block = schedule.blocks.find((b) => b.id === cell.blockId)
      if (block) onOpenBlock(date, staffId, block)
      return
    }
    if (cell.status === 'free' || cell.status === 'block') {
      onToggleSlot(date, staffId, staffName, cell.time)
    }
  }

  return (
    <div className="flex min-w-[9.5rem] flex-1 flex-col border-r border-gold/15 sm:min-w-[11rem]">
      <div
        className={`sticky top-0 z-40 flex ${STAFF_HEADER_HEIGHT_CLASS} shrink-0 items-center border-b border-gold/20 bg-cream px-2`}
      >
        <p className={`${typography.label} truncate capitalize text-gold`}>{shortDayLabel(date)}</p>
      </div>
      <div
        ref={gridRef}
        className="relative select-none"
        style={{ height: range.totalHeightPx }}
      >
        {range.timeLabels.map((time) => {
          const closed = !slotStartInWorkWindows(time, range.slotMinutes, salonWindows)
          return (
            <div
              key={time}
              className={closed ? agendaClosedSlotClassName : agendaOpenSlotClassName}
              style={{ height: range.slotHeightPx }}
            />
          )
        })}

        {cells.map((cell) => {
          if (cell.status === 'closed') return null
          const isSelected = selection?.staffId === staffId && selection.times.has(cell.time)
          const isFormSlot =
            formStaffId === staffId && formSlotTime === cell.time && cell.status === 'free'
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
          const isFree = cell.status === 'free'
          return (
            <button
              key={cell.time}
              type="button"
              data-slot-time={cell.time}
              data-slot-scope={`${staffId}:${date}`}
              data-slot-selectable={isFree ? '1' : undefined}
              onPointerDown={
                isFree ? (e) => drag.onFreeSlotPointerDown(e, cell.time) : undefined
              }
              onClick={() => {
                if (isFree && drag.shouldSuppressClick()) return
                handleCellClick(cell)
              }}
              className={[
                'absolute inset-x-0 z-[15] cursor-pointer border border-transparent transition-colors',
                isFree ? 'hover:bg-gold/10' : '',
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

        {schedule.blocks.map((block) => (
          <ResizableBlockEvent
            key={block.id}
            block={block}
            range={range}
            interactionsLocked={gridInteractionsLocked}
            resizeEnabled={!gridInteractionsLocked}
            staffId={staffId}
            columnTopFromClientY={(clientY) => columnTopFromClientY(clientY)}
            onOpen={() => {
              onFocusDate(date)
              onOpenBlock(date, staffId, block)
            }}
            onResizeEnd={(b, startTime, endTime) => {
              onFocusDate(date)
              onResizeBlock(date, staffId, b, startTime, endTime)
            }}
          />
        ))}

        {schedule.appointments.map((apt) => {
          const top = eventTopPx(apt.startTime, range)
          const height = eventHeightPx(apt.durationMinutes, range)
          return (
            <button
              key={apt.id}
              type="button"
              onClick={() => {
                onFocusDate(date)
                onEditAppointment(date, staffId, apt)
              }}
              className={`absolute inset-x-1 z-30 cursor-pointer overflow-hidden border px-1.5 py-1 text-left text-[10px] ${appointmentEventClass(apt.categoryId, apt.serviceId, apt.colorGroupRole, apt.status)}`}
              style={{ top, height: Math.max(height - 2, 22) }}
              title={`${apt.customerName} — ${formatAppointmentTimeRange(apt.serviceId, apt.startTime, apt.durationMinutes, 'es', { colorGroupRole: apt.colorGroupRole })}`}
            >
              <span className="block truncate font-medium">{apt.customerName}</span>
              <span className="flex items-center gap-0.5 truncate opacity-80">
                {isColorGroupWashRow(apt.colorGroupRole) && (
                  <WashPhaseIcon className="h-2.5 w-2.5 shrink-0" title="Lavado" />
                )}
                <span className="truncate">{apt.serviceName}</span>
              </span>
            </button>
          )
        })}

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

function emptySchedule(staffId: string, staffName: string): StaffDaySchedule {
  return {
    staffId,
    staffName,
    working: false,
    windows: [],
    appointments: [],
    blocks: [],
    freeSlots: [],
  }
}

export function AdminMultiDayCalendar({
  staffId,
  staffName,
  dayBundles,
  selection,
  formSlotTime,
  formStaffId,
  gridInteractionsLocked,
  onFocusDate,
  onToggleSlot,
  onPaintSlots,
  onEditAppointment,
  onOpenBlock,
  onResizeBlock,
}: Props) {
  const [slotHeightPx, setSlotHeightPx] = useState(readStoredCalendarSlotHeightPx)
  const scrollRef = useRef<HTMLDivElement>(null)
  const slotHeightRef = useRef(slotHeightPx)
  const rangeWindows = useMemo(() => {
    const all: WorkTimeWindow[] = []
    for (const bundle of dayBundles) {
      all.push(...bundle.salonWindows)
    }
    return all
  }, [dayBundles])
  const range = useMemo(
    () => resolveCalendarDayRange(undefined, slotHeightPx, rangeWindows),
    [slotHeightPx, rangeWindows],
  )

  useEffect(() => {
    slotHeightRef.current = slotHeightPx
    storeCalendarSlotHeightPx(slotHeightPx)
  }, [slotHeightPx])

  useEffect(() => {
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
  }, [dayBundles.length])

  const leftWindows = dayBundles[0]?.salonWindows ?? []

  if (dayBundles.length === 0) {
    return <p className={`${typography.caption} text-center`}>Sin días en el rango.</p>
  }

  return (
    <div
      ref={scrollRef}
      className="agenda-calendar-scroll h-full min-h-0 overflow-auto border border-gold/25 bg-cream/40 backdrop-blur-[2px]"
      title="Ctrl + rueda para zoom"
    >
      <div className="flex w-max min-w-full">
        <div className="sticky left-0 z-40 isolate shrink-0 bg-cream/40 backdrop-blur-[2px]">
          <div
            className={`sticky top-0 z-50 ${STAFF_HEADER_HEIGHT_CLASS} shrink-0 border-b border-r border-gold/20 bg-cream`}
            aria-hidden
          />
          <TimeGutter range={range} windows={leftWindows} />
        </div>

        <div className="flex min-w-0 flex-1">
          {dayBundles.map((bundle, index) => {
            const schedule =
              bundle.schedules.find((s) => s.staffId === staffId) ??
              emptySchedule(staffId, staffName)
            const nowLineTop = currentTimeLineTopPx(bundle.date, range)
            return (
              <div key={bundle.date} className="flex min-w-0 flex-1">
                {index > 0 && (
                  <div className="flex shrink-0 flex-col">
                    <div
                      className={`sticky top-0 z-40 ${STAFF_HEADER_HEIGHT_CLASS} shrink-0 border-b border-r border-gold/20 bg-cream`}
                      aria-hidden
                    />
                    <TimeGutter range={range} windows={bundle.salonWindows} compact />
                  </div>
                )}
                <DayColumn
                  date={bundle.date}
                  schedule={schedule}
                  range={range}
                  salonWindows={bundle.salonWindows}
                  nowLineTop={nowLineTop}
                  selection={selection}
                  formSlotTime={formSlotTime}
                  formStaffId={formStaffId}
                  gridInteractionsLocked={gridInteractionsLocked}
                  staffId={staffId}
                  staffName={staffName}
                  onFocusDate={onFocusDate}
                  onToggleSlot={onToggleSlot}
                  onPaintSlots={onPaintSlots}
                  onEditAppointment={onEditAppointment}
                  onOpenBlock={onOpenBlock}
                  onResizeBlock={onResizeBlock}
                />
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
