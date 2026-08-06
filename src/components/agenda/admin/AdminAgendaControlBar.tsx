import { Link } from 'react-router-dom'
import { AdminAppointmentNotificationsBell } from '@/components/agenda/admin/AdminAppointmentNotificationsBell'
import { StaffGridSelectionActions } from '@/components/agenda/staff/StaffGridSelectionActions'
import type { AdminAppointmentNotificationItem } from '@/lib/agenda/adminNotifications'
import { addDaysToDateString, dayOfWeekFromDateString, todaySalon } from '@/lib/core/dates'
import type { GridSelectionSummary } from '@/lib/agenda/timeGrid'
import { Button } from '@/components/ui/Button'
import { typography } from '@/styles/typography'

const dayNavButtonClass =
  'flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center border border-gold/30 text-gold hover:border-gold hover:bg-gold/10'

const navLinkClass =
  'flex h-8 shrink-0 cursor-pointer items-center border border-gold/30 px-2 text-xs text-charcoal-muted hover:border-gold'

const DAY_ABBR = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'] as const

const MONTH_ABBR = [
  'ENE',
  'FEB',
  'MAR',
  'ABR',
  'MAY',
  'JUN',
  'JUL',
  'AGO',
  'SEP',
  'OCT',
  'NOV',
  'DIC',
] as const

type Props = {
  date: string
  onDateChange: (date: string) => void
  appointmentCount: number
  onLogout: () => void
  selectionCount?: number
  selectionSummary?: GridSelectionSummary
  onBlockSelection?: () => void
  onUnblockSelection?: () => void
  onCreateAppointmentFromSelection?: () => void
  onClearSelection?: () => void
  selectionBusy?: boolean
  gridInteractionsLocked?: boolean
  notificationInbox?: AdminAppointmentNotificationItem[]
  notificationBellOpen?: boolean
  notificationLastSeenAt?: number
  onNotificationBellOpen?: () => void
  onNotificationBellClose?: () => void
  onNotificationSelect?: (item: AdminAppointmentNotificationItem) => void
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

function CalendarIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path
        fillRule="evenodd"
        d="M5.75 2a.75.75 0 01.75.75V4h7V2.75a.75.75 0 011.5 0V4h.25A2.75 2.75 0 0118 6.75v8.5A2.75 2.75 0 0115.25 18H4.75A2.75 2.75 0 012 15.25v-8.5A2.75 2.75 0 014.75 4H5V2.75A.75.75 0 015.75 2zm-1 5.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25v-6.5c0-.69-.56-1.25-1.25-1.25H4.75z"
        clipRule="evenodd"
      />
    </svg>
  )
}

function formatShortDate(dateStr: string): string {
  const [, m, d] = dateStr.split('-').map(Number)
  return `${String(d).padStart(2, '0')} ${MONTH_ABBR[m - 1]}`
}

function stripDatesFrom(anchor: string): string[] {
  return [0, 1, 2, 3, 4, 5, 6].map((offset) => addDaysToDateString(anchor, offset))
}

export function AdminAgendaControlBar({
  date,
  onDateChange,
  appointmentCount,
  onLogout,
  selectionCount = 0,
  selectionSummary,
  onBlockSelection,
  onUnblockSelection,
  onCreateAppointmentFromSelection,
  onClearSelection,
  selectionBusy = false,
  gridInteractionsLocked = false,
  notificationInbox = [],
  notificationBellOpen = false,
  notificationLastSeenAt = Date.now(),
  onNotificationBellOpen,
  onNotificationBellClose,
  onNotificationSelect,
}: Props) {
  const isToday = date === todaySalon()
  const stripDates = stripDatesFrom(date)
  const hasSelection = selectionCount > 0 && selectionSummary != null

  const dayStrip = (
    <div className="flex min-w-0 items-center gap-1" role="navigation" aria-label="Días de la agenda">
      <label className="relative flex h-8 cursor-pointer items-center gap-1.5 border border-gold/30 px-2 text-gold hover:border-gold hover:bg-gold/10">
        <CalendarIcon />
        <span className={`${typography.label} tabular-nums text-gold`}>{formatShortDate(date)}</span>
        <input
          type="date"
          value={date}
          onChange={(e) => {
            if (e.target.value) onDateChange(e.target.value)
          }}
          className="absolute inset-0 cursor-pointer opacity-0"
          aria-label="Elegir fecha"
        />
      </label>

      <button
        type="button"
        disabled={isToday}
        onClick={() => onDateChange(todaySalon())}
        className="h-8 shrink-0 cursor-pointer border border-gold/30 px-2 text-xs font-medium uppercase tracking-wide text-charcoal-muted hover:border-gold disabled:cursor-not-allowed disabled:opacity-40"
      >
        Hoy
      </button>

      <div className="flex items-center gap-0.5 overflow-x-auto px-0.5" role="group" aria-label="Semana visible">
        {stripDates.map((d) => {
          const active = d === date
          const abbr = DAY_ABBR[dayOfWeekFromDateString(d)]
          return (
            <button
              key={d}
              type="button"
              aria-pressed={active}
              aria-label={formatShortDate(d)}
              onClick={() => onDateChange(d)}
              className={`h-8 shrink-0 cursor-pointer border-b-2 px-2 text-xs font-medium uppercase tracking-wide ${
                active
                  ? 'border-gold text-gold'
                  : 'border-transparent text-charcoal-muted hover:text-charcoal'
              }`}
            >
              {abbr}
            </button>
          )
        })}
      </div>

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
    </div>
  )

  const showNotifications =
    onNotificationBellOpen != null &&
    onNotificationBellClose != null &&
    onNotificationSelect != null

  const notificationBell =
    showNotifications ? (
      <AdminAppointmentNotificationsBell
        inbox={notificationInbox}
        open={notificationBellOpen}
        lastSeenAt={notificationLastSeenAt}
        onOpen={onNotificationBellOpen}
        onClose={onNotificationBellClose}
        onSelect={onNotificationSelect}
      />
    ) : null

  const navLinks = (
    <>
      <Link to="/servicios" className={navLinkClass}>
        Servicios
      </Link>
      <Link to="/personal" className={navLinkClass}>
        Personal
      </Link>
      <Link to="/horarios" className={navLinkClass}>
        Horarios
      </Link>
      <Link to="/clientes" className={navLinkClass}>
        Clientes
      </Link>
      <Link to="/clientes/citas" className={navLinkClass}>
        Citas
      </Link>
      <Link to="/stats" className={navLinkClass}>
        Stats
      </Link>
      <Button type="button" variant="outline" size="sm" className="h-8 shrink-0 px-2 text-xs" onClick={onLogout}>
        Salir
      </Button>
    </>
  )

  return (
    <div className="relative border-b border-gold/15">
      <div
        className="pointer-events-none absolute inset-0 bg-cream/55 backdrop-blur-[2px]"
        aria-hidden
      />
      <div className="relative flex flex-col gap-2 px-3 py-2 md:gap-y-2">
        <div className="flex w-full min-w-0 flex-col gap-2 md:hidden">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1 overflow-x-auto">{dayStrip}</div>
            {notificationBell}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">{navLinks}</div>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <div className="hidden min-w-0 md:block">{dayStrip}</div>

          <span className="hidden h-4 w-px bg-gold/25 sm:block" aria-hidden />

          <span className={`${typography.caption} shrink-0 tabular-nums`}>
            {appointmentCount} {appointmentCount === 1 ? 'cita' : 'citas'}
          </span>

          {hasSelection && selectionSummary ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="hidden h-4 w-px bg-gold/25 md:block" aria-hidden />
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
                interactionsLocked={gridInteractionsLocked}
              />
            </div>
          ) : null}

          <div className="ml-auto hidden items-center gap-2 md:flex">
            {notificationBell}
            {navLinks}
          </div>
        </div>
      </div>
    </div>
  )
}
