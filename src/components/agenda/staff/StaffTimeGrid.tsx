import { useMemo } from 'react'
import { salonSchedule } from '@/data/schedule'
import { buildStaffDayGrid, type TimeGridCell } from '@/lib/agenda/timeGrid'
import { useSlotRangeDrag } from '@/hooks/agenda/useSlotRangeDrag'
import { WashPhaseIcon } from '@/components/agenda/WashPhaseIcon'
import {
  agendaColorLegend,
  agendaColorLegendSwatch,
  appointmentEventClass,
  blockEventClass,
} from '@/lib/catalog/serviceCategoryColors'
import { isColorGroupWashRow } from '@/lib/booking/occupancy'
import type { DayScheduleAppointment, DayScheduleBlock, StaffDaySchedule } from '@/types/booking'
import { typography } from '@/styles/typography'

type Props = {
  date: string
  schedule: StaffDaySchedule
  selectedTimes: ReadonlySet<string>
  formSlotTime: string | null
  onToggleSlot: (time: string) => void
  onPaintSlots: (times: Set<string>) => void
  onSelectAppointment: (apt: DayScheduleAppointment) => void
  onOpenBlock: (block: DayScheduleBlock) => void
}

const statusStyles: Record<Exclude<TimeGridCell['status'], 'appointment'>, string> = {
  free: 'border-gold/35 bg-cream/25 backdrop-blur-[1px] hover:border-gold hover:bg-gold/15 cursor-pointer',
  block: `${blockEventClass()} hover:border-charcoal/40 cursor-pointer`,
  past: 'border-charcoal/10 bg-charcoal/5 text-charcoal-muted/70 cursor-not-allowed',
  closed: 'border-charcoal/15 bg-charcoal/[0.14] text-charcoal-muted/75 cursor-not-allowed',
}

function appointmentCellClass(cell: TimeGridCell): string {
  return `${appointmentEventClass(cell.categoryId, cell.serviceId, cell.colorGroupRole, cell.appointmentStatus)} cursor-pointer hover:brightness-[0.97]`
}

function findAppointment(schedule: StaffDaySchedule, id: string) {
  return schedule.appointments.find((a) => a.id === id)
}

function IconPencil() {
  return (
    <svg className="size-3" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path d="M13.586 3.586a2 2 0 112.828 2.828l-8.5 8.5a1 1 0 01-.434.263l-3 1a1 1 0 01-1.263-1.263l1-3a1 1 0 01.263-.434l8.5-8.5z" />
    </svg>
  )
}

export function StaffTimeGrid({
  date,
  schedule,
  selectedTimes,
  formSlotTime,
  onToggleSlot,
  onPaintSlots,
  onSelectAppointment,
  onOpenBlock,
}: Props) {
  const cells = useMemo(
    () => buildStaffDayGrid(schedule, date, salonSchedule.slotMinutes, 'fullDisplay'),
    [schedule, date],
  )
  const selectableTimes = useMemo(
    () => cells.filter((c) => c.status === 'free').map((c) => c.time),
    [cells],
  )
  const drag = useSlotRangeDrag({
    selectableTimes,
    selectedTimes,
    scope: schedule.staffId,
    enabled: true,
    onPaint: onPaintSlots,
  })

  function handleCellClick(cell: TimeGridCell, shiftKey: boolean) {
    if (cell.status === 'past' || cell.status === 'closed') return

    if (cell.status === 'appointment' && cell.appointmentId) {
      const apt = findAppointment(schedule, cell.appointmentId)
      if (apt) onSelectAppointment(apt)
      return
    }

    if (cell.status === 'block' && cell.blockId && !shiftKey) {
      const block = schedule.blocks.find((b) => b.id === cell.blockId)
      if (block) onOpenBlock(block)
      return
    }

    if (cell.status === 'free' || cell.status === 'block') {
      onToggleSlot(cell.time)
    }
  }

  return (
    <section className="space-y-3">
      <div className={`${typography.caption} hidden flex-wrap gap-3 lg:flex`}>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 border border-gold/35 bg-cream" />
          Libre
        </span>
        {agendaColorLegend.map(({ key, label }) => (
          <span key={key} className="flex items-center gap-1.5">
            <span
              className={`inline-block h-3 w-3 border border-l-2 ${agendaColorLegendSwatch(key)}`}
            />
            {label}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 border border-charcoal/15 bg-charcoal/[0.14]" />
          Fuera de horario
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 border border-dashed border-charcoal/25 bg-charcoal/5" />
          Bloqueo
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 ring-2 ring-gold ring-offset-1" />
          Selección
        </span>
      </div>

      <div className="grid select-none grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
        {cells.map((cell) => {
          const isMultiSelected = selectedTimes.has(cell.time)
          const isFormSlot = cell.status === 'free' && cell.time === formSlotTime && !isMultiSelected
          const isFree = cell.status === 'free'
          const isBlockStart = cell.status === 'block' && Boolean(cell.title)
          return (
            <button
              key={cell.time}
              type="button"
              disabled={cell.status === 'past' || cell.status === 'closed'}
              data-slot-time={cell.time}
              data-slot-scope={schedule.staffId}
              data-slot-selectable={isFree ? '1' : undefined}
              title={
                cell.appointmentNotes
                  ? `${cell.title ?? ''} — ${cell.subtitle ?? ''}\n${cell.appointmentNotes}`
                  : cell.title
                    ? `${cell.title}${cell.subtitle ? ` — ${cell.subtitle}` : ''}`
                    : undefined
              }
              onPointerDown={
                isFree ? (e) => drag.onFreeSlotPointerDown(e, cell.time) : undefined
              }
              onClick={(e) => {
                if (isFree && drag.shouldSuppressClick()) return
                handleCellClick(cell, e.shiftKey)
              }}
              aria-pressed={isMultiSelected}
              className={[
                'relative min-h-[4.5rem] border px-2 py-2 text-left text-sm transition-colors',
                cell.status === 'appointment'
                  ? appointmentCellClass(cell)
                  : statusStyles[cell.status],
                isMultiSelected ? 'ring-2 ring-gold ring-offset-1 ring-offset-cream' : '',
                isFormSlot ? 'ring-2 ring-gold/60 ring-offset-1 ring-offset-cream' : '',
              ].join(' ')}
            >
              <span className="block font-medium tabular-nums">{cell.time}</span>
              {cell.title && (
                <span className="mt-1 block truncate text-xs leading-tight">{cell.title}</span>
              )}
              {cell.subtitle && (
                <span className="flex items-center gap-1 truncate text-[10px] leading-tight opacity-80">
                  {isColorGroupWashRow(cell.colorGroupRole) && (
                    <WashPhaseIcon className="h-3 w-3 shrink-0 opacity-90" title="Lavado" />
                  )}
                  <span className="truncate">{cell.subtitle}</span>
                </span>
              )}
              {isBlockStart && cell.blockId && (
                <span
                  role="button"
                  tabIndex={0}
                  className="absolute top-1.5 right-1.5 rounded border border-charcoal/20 bg-cream/90 p-0.5 text-charcoal transition-colors hover:border-charcoal/40 hover:bg-cream"
                  title="Editar bloqueo"
                  aria-label="Editar bloqueo"
                  onClick={(e) => {
                    e.stopPropagation()
                    const block = schedule.blocks.find((b) => b.id === cell.blockId)
                    if (block) onOpenBlock(block)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      e.stopPropagation()
                      const block = schedule.blocks.find((b) => b.id === cell.blockId)
                      if (block) onOpenBlock(block)
                    }
                  }}
                >
                  <IconPencil />
                </span>
              )}
            </button>
          )
        })}
      </div>
    </section>
  )
}
