import { useMemo } from 'react'
import {
  blockDurationMinutes,
  CALENDAR_SLOT_HEIGHT_PX,
  currentTimeLineTopPx,
  eventHeightPx,
  eventTopPx,
  resolveCalendarDayRange,
  type CalendarDayRange,
} from '@/lib/adminCalendar'
import { appointmentEventClass, blockEventClass } from '@/lib/serviceCategoryColors'
import { buildStaffDayGrid, type TimeGridCell } from '@/lib/timeGrid'
import { formatAppointmentTimeRange } from '@/lib/bookingOccupancy'
import type { AdminColumnSelection } from '@/hooks/useAdminAgenda'
import type { DayScheduleAppointment, DayScheduleBlock, StaffDaySchedule } from '@/types/booking'
import { typography } from '@/styles/typography'

type Props = {
  date: string
  schedules: StaffDaySchedule[]
  selection: AdminColumnSelection | null
  formSlotTime: string | null
  formStaffId: string | null
  onToggleSlot: (staffId: string, staffName: string, time: string) => void
  onEditAppointment: (staffId: string, apt: DayScheduleAppointment) => void
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
  onCellClick: (cell: TimeGridCell) => void
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
            onClick={() => onCellClick(cell)}
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

function AppointmentBlock({
  apt,
  range,
}: {
  apt: DayScheduleAppointment
  range: CalendarDayRange
}) {
  const slots =
    apt.occupiedSlots.length > 0
      ? apt.occupiedSlots
      : [{ startTime: apt.startTime, endTime: apt.endTime }]

  return (
    <>
      {slots.map((slot, index) => {
        const duration =
          timeToMinutes(slot.endTime) - timeToMinutes(slot.startTime)
        const top = eventTopPx(slot.startTime, range)
        const height = eventHeightPx(duration, range)

        return (
          <div
            key={`${apt.id}-${index}`}
            className={`pointer-events-none absolute inset-x-1 z-10 overflow-hidden border px-2 py-1 text-left text-xs leading-tight shadow-sm ${appointmentEventClass(apt.categoryId, apt.serviceId)}`}
            style={{ top, height: Math.max(height - 2, 22) }}
            title={`${apt.customerName} — ${apt.serviceName}`}
          >
            {index === 0 && (
              <>
                <span className="block font-medium">
                  {apt.customerName} — {apt.serviceName}
                </span>
                <span className="mt-0.5 block opacity-80 tabular-nums">
                  {formatAppointmentTimeRange(apt.serviceId, apt.startTime, apt.durationMinutes)}
                </span>
              </>
            )}
          </div>
        )
      })}
    </>
  )
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

function BlockEvent({ block, range }: { block: DayScheduleBlock; range: CalendarDayRange }) {
  const duration = blockDurationMinutes(block.startTime, block.endTime)
  const top = eventTopPx(block.startTime, range)
  const height = eventHeightPx(duration, range)

  return (
    <div
      className={`pointer-events-none absolute inset-x-1 z-10 overflow-hidden border border-dashed px-2 py-1 text-left text-xs ${blockEventClass()}`}
      style={{ top, height: Math.max(height - 2, 22) }}
    >
      <span className="font-medium">Bloqueado</span>
      {block.note && <span className="mt-0.5 block truncate opacity-80">{block.note}</span>}
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
  onToggleSlot,
  onEditAppointment,
}: {
  schedule: StaffDaySchedule
  date: string
  range: CalendarDayRange
  nowLineTop: number | null
  selection: AdminColumnSelection | null
  formSlotTime: string | null
  formStaffId: string | null
  onToggleSlot: (staffId: string, staffName: string, time: string) => void
  onEditAppointment: (staffId: string, apt: DayScheduleAppointment) => void
}) {
  function handleCellClick(cell: TimeGridCell) {
    if (cell.status === 'past') return
    if (cell.status === 'appointment' && cell.appointmentId) {
      const apt = schedule.appointments.find((a) => a.id === cell.appointmentId)
      if (apt) onEditAppointment(schedule.staffId, apt)
      return
    }
    if (cell.status === 'free' || cell.status === 'block') {
      onToggleSlot(schedule.staffId, schedule.staffName, cell.time)
    }
  }

  if (!schedule.working || !schedule.window) {
    return (
      <div className="min-w-[11rem] flex-1 border-l border-gold/20">
        <div className="sticky top-0 z-30 flex items-center gap-2 border-b border-gold/20 bg-cream px-3 py-3">
          <StaffInitial name={schedule.staffName} />
          <span className={`${typography.label} truncate`}>{schedule.staffName}</span>
        </div>
        <div className="flex items-center justify-center bg-charcoal/[0.03] p-8">
          <p className={typography.caption}>No trabaja</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-w-[11rem] flex-1 border-l border-gold/20">
      <div className="sticky top-0 z-30 flex items-center gap-2 border-b border-gold/20 bg-cream px-3 py-3">
        <StaffInitial name={schedule.staffName} />
        <div className="min-w-0">
          <p className={`${typography.label} truncate`}>{schedule.staffName}</p>
          <p className="text-[10px] tabular-nums text-charcoal-muted">
            {schedule.window.startTime}–{schedule.window.endTime}
          </p>
        </div>
      </div>

      <div className="relative" style={{ height: range.totalHeightPx }}>
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
          <AppointmentBlock key={apt.id} apt={apt} range={range} />
        ))}

        {schedule.blocks.map((block) => (
          <BlockEvent key={block.id} block={block} range={range} />
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
  onToggleSlot,
  onEditAppointment,
}: Props) {
  const range = useMemo(() => resolveCalendarDayRange(schedules), [schedules])
  const nowLineTop = useMemo(() => currentTimeLineTopPx(date, range), [date, range])

  if (schedules.length === 0) {
    return <p className={`${typography.caption} text-center`}>No hay personal activo.</p>
  }

  return (
    <div className="overflow-x-auto border border-gold/25 bg-cream">
        <div className="flex min-w-max">
          <div className="sticky left-0 z-30 shrink-0 bg-cream">
            <div className="h-[3.25rem] border-b border-gold/20" aria-hidden />
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
                onToggleSlot={onToggleSlot}
                onEditAppointment={onEditAppointment}
              />
            ))}
          </div>
        </div>
    </div>
  )
}
