import { useMemo } from 'react'
import { buildStaffDayGrid, type TimeGridCell } from '@/lib/timeGrid'
import {
  agendaColorLegend,
  agendaColorLegendSwatch,
  appointmentEventClass,
  blockEventClass,
} from '@/lib/serviceCategoryColors'
import type { DayScheduleAppointment, DayScheduleBlock, StaffDaySchedule } from '@/types/booking'
import { typography } from '@/styles/typography'

type Props = {
  date: string
  schedule: StaffDaySchedule
  selectedTimes: ReadonlySet<string>
  formSlotTime: string | null
  onToggleSlot: (time: string) => void
  onSelectAppointment: (apt: DayScheduleAppointment) => void
  onOpenBlock: (block: DayScheduleBlock) => void
}

const statusStyles: Record<Exclude<TimeGridCell['status'], 'appointment'>, string> = {
  free: 'border-gold/35 bg-cream hover:border-gold hover:bg-gold/10 cursor-pointer',
  block: `${blockEventClass()} hover:border-charcoal/40 cursor-pointer`,
  past: 'border-charcoal/10 bg-charcoal/5 text-charcoal-muted/70 cursor-not-allowed',
}

function appointmentCellClass(cell: TimeGridCell): string {
  return `${appointmentEventClass(cell.categoryId, cell.serviceId)} cursor-pointer hover:brightness-[0.97]`
}

function findAppointment(schedule: StaffDaySchedule, id: string) {
  return schedule.appointments.find((a) => a.id === id)
}

export function StaffTimeGrid({
  date,
  schedule,
  selectedTimes,
  formSlotTime,
  onToggleSlot,
  onSelectAppointment,
  onOpenBlock,
}: Props) {
  const cells = useMemo(() => buildStaffDayGrid(schedule, date), [schedule, date])
  function handleCellClick(cell: TimeGridCell, shiftKey: boolean) {
    if (cell.status === 'past') return

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

  if (cells.length === 0) return null

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
          <span className="inline-block h-3 w-3 border border-dashed border-charcoal/25 bg-charcoal/5" />
          Bloqueo
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 ring-2 ring-gold ring-offset-1" />
          Selección
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
        {cells.map((cell) => {
          const isMultiSelected = selectedTimes.has(cell.time)
          const isFormSlot = cell.status === 'free' && cell.time === formSlotTime && !isMultiSelected
          return (
            <button
              key={cell.time}
              type="button"
              disabled={cell.status === 'past'}
              onClick={(e) => handleCellClick(cell, e.shiftKey)}
              aria-pressed={isMultiSelected}
              className={[
                'min-h-[4.5rem] border px-2 py-2 text-left text-sm transition-colors',
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
                <span className="block truncate text-[10px] leading-tight opacity-80">
                  {cell.subtitle}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </section>
  )
}
