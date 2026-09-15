import {
  blockDurationMinutes,
  eventHeightPx,
  eventTopPx,
  type CalendarDayRange,
} from '@/lib/agenda/adminCalendar'
import { blockEventClass } from '@/lib/catalog/serviceCategoryColors'
import type { DayScheduleBlock } from '@/types/booking'

type Props = {
  block: DayScheduleBlock
  range: CalendarDayRange
  interactionsLocked: boolean
  onOpen: () => void
}

/** Bloqueo fijo en la grilla: clic para ver/editar nota o quitar; sin arrastre ni alargar. */
export function ResizableBlockEvent({ block, range, interactionsLocked, onOpen }: Props) {
  const duration = blockDurationMinutes(block.startTime, block.endTime)
  const top = eventTopPx(block.startTime, range)
  const height = eventHeightPx(duration, range)

  return (
    <div
      role="button"
      tabIndex={interactionsLocked ? -1 : 0}
      onClick={(e) => {
        e.stopPropagation()
        if (interactionsLocked) return
        onOpen()
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          if (!interactionsLocked) onOpen()
        }
      }}
      className={`absolute inset-x-0 z-20 overflow-hidden border border-dashed px-2 py-1 text-left text-xs transition-colors hover:border-charcoal/40 ${blockEventClass()} ${
        interactionsLocked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
      }`}
      style={{ top, height: Math.max(height, 22) }}
      title={
        block.note
          ? `Bloqueado ${block.startTime}–${block.endTime} — ${block.note}`
          : `Bloqueado ${block.startTime}–${block.endTime}`
      }
    >
      <span className="font-medium">Bloqueado</span>
      <span className="mt-0.5 block tabular-nums opacity-80">
        {block.startTime}–{block.endTime}
      </span>
      {block.note && <span className="mt-0.5 block truncate opacity-80">{block.note}</span>}
    </div>
  )
}
