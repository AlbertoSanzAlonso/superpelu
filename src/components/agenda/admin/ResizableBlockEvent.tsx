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

function IconPencil() {
  return (
    <svg className="size-3" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path d="M13.586 3.586a2 2 0 112.828 2.828l-8.5 8.5a1 1 0 01-.434.263l-3 1a1 1 0 01-1.263-1.263l1-3a1 1 0 01.263-.434l8.5-8.5z" />
    </svg>
  )
}

/** Bloqueo fijo en la grilla: clic o botón editar para ver/editar horario y nota; sin arrastre. */
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
      <div className="flex items-start justify-between gap-1">
        <div className="min-w-0 flex-1">
          <span className="font-medium">Bloqueado</span>
          <span className="mt-0.5 block tabular-nums opacity-80">
            {block.startTime}–{block.endTime}
          </span>
          {block.note && <span className="mt-0.5 block truncate opacity-80">{block.note}</span>}
        </div>
        {!interactionsLocked && (
          <span
            role="button"
            tabIndex={0}
            className="shrink-0 rounded border border-charcoal/20 bg-cream/80 p-0.5 text-charcoal transition-colors hover:border-charcoal/40 hover:bg-cream"
            title="Editar bloqueo"
            aria-label="Editar bloqueo"
            onClick={(e) => {
              e.stopPropagation()
              onOpen()
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                e.stopPropagation()
                onOpen()
              }
            }}
          >
            <IconPencil />
          </span>
        )}
      </div>
    </div>
  )
}
