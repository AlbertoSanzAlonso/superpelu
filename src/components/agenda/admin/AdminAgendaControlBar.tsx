import { Link } from 'react-router-dom'
import { AdminAppointmentNotificationsBell } from '@/components/agenda/admin/AdminAppointmentNotificationsBell'
import { StaffGridSelectionActions } from '@/components/agenda/staff/StaffGridSelectionActions'
import type { AdminAppointmentNotificationItem } from '@/lib/agenda/adminNotifications'
import {
  agendaViewLabel,
  agendaViewNavStep,
  type AgendaViewMode,
} from '@/lib/agenda/agendaView'
import { addDaysToDateString, formatDisplayDate, todaySalon } from '@/lib/core/dates'
import type { GridSelectionSummary } from '@/lib/agenda/timeGrid'
import { Button } from '@/components/ui/Button'
import type { StaffDaySchedule } from '@/types/booking'
import { typography } from '@/styles/typography'

const dayNavButtonClass =
  'flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center border border-gold/30 text-gold hover:border-gold hover:bg-gold/10'

const dateInputClass =
  'h-8 cursor-pointer border border-gold/30 bg-cream px-2 text-xs outline-none focus:border-gold'

const staffSelectClass =
  'h-8 min-w-[9rem] flex-1 cursor-pointer border border-gold/30 bg-cream px-2 text-xs md:max-w-[12rem] md:flex-none'

const navLinkClass =
  'flex h-8 shrink-0 cursor-pointer items-center border border-gold/30 px-2 text-xs text-charcoal-muted hover:border-gold'

const viewBtnClass =
  'h-8 shrink-0 cursor-pointer border border-gold/30 px-2 text-xs text-charcoal-muted hover:border-gold'

const viewBtnActiveClass =
  'h-8 shrink-0 cursor-pointer border border-gold bg-gold/15 px-2 text-xs font-medium text-gold'

type Props = {
  date: string
  onDateChange: (date: string) => void
  agendaView: AgendaViewMode
  onAgendaViewChange: (view: AgendaViewMode) => void
  viewDates: string[]
  appointmentCount: number
  schedules: StaffDaySchedule[]
  staffOptions: { staffId: string; staffName: string }[]
  activeStaffId: string | null
  onStaffChange: (staffId: string) => void
  onNewAppointment: () => void
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

function formatViewRangeLabel(view: AgendaViewMode, date: string, viewDates: string[]): string {
  if (view === 'day' || viewDates.length <= 1) return formatDisplayDate(date)
  const first = viewDates[0]
  const last = viewDates[viewDates.length - 1]
  const short = (d: string) => {
    const [y, m, day] = d.split('-').map(Number)
    return new Date(y, m - 1, day).toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
    })
  }
  return `${short(first)} – ${short(last)}`
}

export function AdminAgendaControlBar({
  date,
  onDateChange,
  agendaView,
  onAgendaViewChange,
  viewDates,
  appointmentCount,
  schedules,
  staffOptions,
  activeStaffId,
  onStaffChange,
  onNewAppointment,
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
  const navStep = agendaViewNavStep(agendaView)
  const staffList =
    staffOptions.length > 0
      ? staffOptions
      : schedules
          .filter((s) => s.working)
          .map((s) => ({ staffId: s.staffId, staffName: s.staffName }))
  const hasSelection = selectionCount > 0 && selectionSummary != null
  const requireStaff = agendaView !== 'day'
  const canNewAppointment = Boolean(activeStaffId) && !gridInteractionsLocked

  const dayNav = (
    <div className="flex items-center gap-1">
      <button
        type="button"
        className={dayNavButtonClass}
        aria-label={agendaView === 'day' ? 'Día anterior' : 'Periodo anterior'}
        onClick={() => onDateChange(addDaysToDateString(date, -navStep))}
      >
        <NavChevron direction="prev" />
      </button>
      <button
        type="button"
        className={dayNavButtonClass}
        aria-label={agendaView === 'day' ? 'Día siguiente' : 'Periodo siguiente'}
        onClick={() => onDateChange(addDaysToDateString(date, navStep))}
      >
        <NavChevron direction="next" />
      </button>
    </div>
  )

  const viewToggle = (
    <div className="flex items-center" role="group" aria-label="Vista de agenda">
      {(['day', '3days', 'week'] as const).map((view, index) => {
        const active = agendaView === view
        return (
          <button
            key={view}
            type="button"
            className={`${active ? viewBtnActiveClass : viewBtnClass} ${
              index > 0 ? '-ml-px' : ''
            } ${active ? 'relative z-10' : ''}`}
            aria-pressed={active}
            onClick={() => onAgendaViewChange(view)}
          >
            {agendaViewLabel(view)}
          </button>
        )
      })}
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
            {dayNav}
            {notificationBell}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">{navLinks}</div>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <div className="hidden items-center gap-1 md:flex">{dayNav}</div>

          <p className={`${typography.label} shrink-0 capitalize tabular-nums text-gold`}>
            {formatViewRangeLabel(agendaView, date, viewDates)}
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

          <span className="hidden h-4 w-px bg-gold/25 md:block" aria-hidden />

          <select
            value={activeStaffId ?? ''}
            onChange={(e) => onStaffChange(e.target.value)}
            className={staffSelectClass}
            aria-label="Profesional"
          >
            <option value="">{requireStaff ? 'Elegir profesional…' : 'Profesional…'}</option>
            {staffList.map((s) => (
              <option key={s.staffId} value={s.staffId}>
                {s.staffName}
              </option>
            ))}
          </select>

          {viewToggle}

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
                interactionsLocked={gridInteractionsLocked}
              />
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 px-2 text-xs"
              disabled={!canNewAppointment}
              onClick={onNewAppointment}
            >
              + Cita
            </Button>
          )}

          <div className="ml-auto hidden items-center gap-2 md:flex">
            {notificationBell}
            {navLinks}
          </div>
        </div>
      </div>
    </div>
  )
}
