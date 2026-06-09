import { StaffGridSelectionActions } from '@/components/agenda/staff/StaffGridSelectionActions'
import { addDaysToDateString, formatDisplayDate, todaySalon } from '@/lib/core/dates'
import type { GridSelectionSummary } from '@/lib/agenda/timeGrid'
import type { StaffSession } from '@/lib/api/staff'
import { Button } from '@/components/ui/Button'
import { typography } from '@/styles/typography'

const dayNavButtonClass =
  'flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center border border-gold/30 text-gold hover:border-gold hover:bg-gold/10'

const dateInputClass =
  'h-8 cursor-pointer border border-gold/30 bg-cream px-2 text-xs outline-none focus:border-gold'

type Props = {
  staff: StaffSession
  date: string
  onDateChange: (date: string) => void
  appointmentCount: number
  onNewAppointment: () => void
  onLogout: () => void
  selectionCount?: number
  selectionSummary?: GridSelectionSummary
  onBlockSelection?: () => void
  onUnblockSelection?: () => void
  onCreateAppointmentFromSelection?: () => void
  onClearSelection?: () => void
  selectionBusy?: boolean
}

function NavChevron({ direction }: { direction: 'prev' | 'next' }) {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      {direction === 'prev' ? (
        <path
          fillRule="evenodd"
          d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z"
          clipRule="evenodd"
        />
      ) : (
        <path
          fillRule="evenodd"
          d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.25 4.5a.75.75 0 010 1.08l-4.25 4.5a.75.75 0 01-1.06-.02z"
          clipRule="evenodd"
        />
      )}
    </svg>
  )
}

export function StaffAgendaControlBar({
  staff,
  date,
  onDateChange,
  appointmentCount,
  onNewAppointment,
  onLogout,
  selectionCount = 0,
  selectionSummary,
  onBlockSelection,
  onUnblockSelection,
  onCreateAppointmentFromSelection,
  onClearSelection,
  selectionBusy = false,
}: Props) {
  const isToday = date === todaySalon()
  const hasSelection = selectionCount > 0 && selectionSummary != null

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-gold/15 bg-cream/55 px-3 py-2 backdrop-blur-[2px]">
      <p className={`${typography.label} shrink-0 text-gold`}>
        Hola, {staff.name}
        {staff.role ? (
          <span className="ml-1.5 font-normal text-charcoal-muted">· {staff.role}</span>
        ) : null}
      </p>

      <span className="hidden h-4 w-px bg-gold/25 sm:block" aria-hidden />

      <div className="flex items-center gap-1">
        <button
          type="button"
          className={dayNavButtonClass}
          aria-label="Día anterior"
          onClick={() => onDateChange(addDaysToDateString(date, -1))}
        >
          <NavChevron direction="prev" />
        </button>
        <button
          type="button"
          className={dayNavButtonClass}
          aria-label="Día siguiente"
          onClick={() => onDateChange(addDaysToDateString(date, 1))}
        >
          <NavChevron direction="next" />
        </button>
      </div>

      <p className={`${typography.label} shrink-0 capitalize tabular-nums text-gold`}>
        {formatDisplayDate(date)}
      </p>

      <button
        type="button"
        disabled={isToday}
        onClick={() => onDateChange(todaySalon())}
        className="cursor-pointer border border-gold/30 px-2 py-1 text-xs text-charcoal-muted hover:border-gold disabled:cursor-not-allowed disabled:opacity-40"
      >
        Hoy
      </button>

      <input
        type="date"
        value={date}
        onChange={(e) => onDateChange(e.target.value)}
        className={dateInputClass}
        aria-label="Fecha"
      />

      <span className="hidden h-4 w-px bg-gold/25 sm:block" aria-hidden />

      <span className={`${typography.caption} shrink-0 tabular-nums`}>
        {appointmentCount} {appointmentCount === 1 ? 'cita' : 'citas'}
      </span>

      {hasSelection && selectionSummary ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium tabular-nums text-charcoal">
            {selectionCount} franja{selectionCount === 1 ? '' : 's'}
          </span>
          <StaffGridSelectionActions
            toolbar
            summary={selectionSummary}
            onBlock={onBlockSelection!}
            onUnblock={onUnblockSelection!}
            onCreateAppointment={onCreateAppointmentFromSelection!}
            onClearSelection={onClearSelection!}
            busy={selectionBusy}
          />
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 px-2 text-xs"
          onClick={onNewAppointment}
        >
          + Cita
        </Button>
      )}

      <div className="ml-auto">
        <Button type="button" variant="outline" size="sm" className="h-8 px-2 text-xs" onClick={onLogout}>
          Salir
        </Button>
      </div>
    </div>
  )
}
