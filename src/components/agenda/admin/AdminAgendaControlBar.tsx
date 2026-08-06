import { Link } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { AdminAppointmentNotificationsBell } from '@/components/agenda/admin/AdminAppointmentNotificationsBell'
import { StaffGridSelectionActions } from '@/components/agenda/staff/StaffGridSelectionActions'
import type { AdminAppointmentNotificationItem } from '@/lib/agenda/adminNotifications'
import { addDaysToDateString, dayOfWeekFromDateString, todaySalon } from '@/lib/core/dates'
import type { GridSelectionSummary } from '@/lib/agenda/timeGrid'
import { Button } from '@/components/ui/Button'
import { typography } from '@/styles/typography'

const dayNavButtonClass =
  'flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center border border-gold/30 text-gold transition-colors hover:border-gold hover:bg-gold/10'

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

const STRIP_LEN = 7

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
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
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
  return Array.from({ length: STRIP_LEN }, (_, offset) => addDaysToDateString(anchor, offset))
}

function windowContains(windowStart: string, date: string): boolean {
  const end = addDaysToDateString(windowStart, STRIP_LEN - 1)
  return date >= windowStart && date <= end
}

function DateJumpButton({
  date,
  onPick,
}: {
  date: string
  onPick: (next: string) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="relative h-8 w-[6.75rem] shrink-0 border border-gold/30 transition-colors hover:border-gold hover:bg-gold/10 has-[:focus-visible]:border-gold">
      <div
        className="pointer-events-none flex h-full w-full items-center gap-1.5 px-2 text-gold"
        aria-hidden
      >
        <CalendarIcon />
        <span className={`${typography.label} truncate tabular-nums text-gold`}>
          {formatShortDate(date)}
        </span>
      </div>
      <input
        ref={inputRef}
        type="date"
        value={date}
        onChange={(e) => {
          const next = e.target.value
          if (next) onPick(next)
        }}
        onClick={(e) => {
          const el = e.currentTarget
          if (typeof el.showPicker !== 'function') return
          e.preventDefault()
          void el.showPicker().catch(() => {
            el.focus()
          })
        }}
        className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0"
        aria-label={`Elegir fecha, actual ${formatShortDate(date)}`}
      />
    </div>
  )
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
  const [windowStart, setWindowStart] = useState(date)
  const [stripAnim, setStripAnim] = useState<'next' | 'prev' | null>(null)
  const isToday = date === todaySalon()
  const stripDates = stripDatesFrom(windowStart)
  const windowEnd = stripDates[STRIP_LEN - 1]!
  const hasSelection = selectionCount > 0 && selectionSummary != null

  useEffect(() => {
    if (windowContains(windowStart, date)) return
    setStripAnim(date > windowStart ? 'next' : 'prev')
    setWindowStart(date)
  }, [date, windowStart])

  useEffect(() => {
    if (!stripAnim) return
    const id = window.setTimeout(() => setStripAnim(null), 400)
    return () => window.clearTimeout(id)
  }, [stripAnim, windowStart])

  function selectDate(next: string) {
    if (next === date) return
    onDateChange(next)
  }

  function jumpToDate(next: string) {
    if (!windowContains(windowStart, next)) {
      setStripAnim(next > windowStart ? 'next' : 'prev')
      setWindowStart(next)
    }
    selectDate(next)
  }

  function goPrev() {
    if (date > windowStart) {
      selectDate(addDaysToDateString(date, -1))
      return
    }
    const prev = addDaysToDateString(date, -1)
    setStripAnim('prev')
    setWindowStart(addDaysToDateString(prev, -(STRIP_LEN - 1)))
    selectDate(prev)
  }

  function goNext() {
    if (date < windowEnd) {
      selectDate(addDaysToDateString(date, 1))
      return
    }
    const next = addDaysToDateString(date, 1)
    setStripAnim('next')
    setWindowStart(next)
    selectDate(next)
  }

  const stripAnimClass =
    stripAnim === 'next'
      ? 'agenda-strip-enter-next'
      : stripAnim === 'prev'
        ? 'agenda-strip-enter-prev'
        : ''

  function renderDayButtons() {
    return (
      <div
        key={windowStart}
        className={`flex min-w-0 flex-1 items-center justify-between gap-0.5 sm:flex-none sm:justify-start sm:gap-0.5 ${stripAnimClass}`}
        role="group"
        aria-label="Semana visible"
      >
        {stripDates.map((d) => {
          const active = d === date
          const abbr = DAY_ABBR[dayOfWeekFromDateString(d)]
          return (
            <button
              key={d}
              type="button"
              aria-pressed={active}
              aria-label={formatShortDate(d)}
              onClick={() => selectDate(d)}
              className={`h-8 min-w-0 flex-1 cursor-pointer border-b-2 px-1 text-[11px] font-medium uppercase tracking-wide transition-[color,border-color] duration-300 ease-[var(--ease-premium)] sm:flex-none sm:px-2 sm:text-xs ${
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
    )
  }

  function renderArrows() {
    return (
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          className={dayNavButtonClass}
          aria-label="Día anterior"
          onClick={goPrev}
        >
          <NavChevron direction="prev" />
        </button>
        <button
          type="button"
          className={dayNavButtonClass}
          aria-label="Día siguiente"
          onClick={goNext}
        >
          <NavChevron direction="next" />
        </button>
      </div>
    )
  }

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
      <div className="relative flex flex-col gap-2 px-3 py-2">
        {/* Móvil: dos filas para no desbordar */}
        <div className="flex w-full min-w-0 flex-col gap-1.5 md:hidden">
          <div className="flex min-w-0 items-center gap-1.5">
            <DateJumpButton date={date} onPick={jumpToDate} />
            <button
              type="button"
              disabled={isToday}
              onClick={() => jumpToDate(todaySalon())}
              className="h-8 shrink-0 cursor-pointer border border-gold/30 px-2 text-xs font-medium uppercase tracking-wide text-charcoal-muted transition-colors hover:border-gold disabled:cursor-not-allowed disabled:opacity-40"
            >
              Hoy
            </button>
            <div className="ml-auto flex shrink-0 items-center gap-1.5">
              {renderArrows()}
              {notificationBell}
            </div>
          </div>
          <div className="flex min-w-0 items-center gap-1" role="navigation" aria-label="Días de la agenda">
            {renderDayButtons()}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
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
                  interactionsLocked={gridInteractionsLocked}
                />
              </div>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">{navLinks}</div>
        </div>

        {/* Desktop */}
        <div className="hidden min-w-0 flex-wrap items-center gap-x-3 gap-y-2 md:flex">
          <div className="flex min-w-0 items-center gap-1" role="navigation" aria-label="Días de la agenda">
            <DateJumpButton date={date} onPick={jumpToDate} />
            <button
              type="button"
              disabled={isToday}
              onClick={() => jumpToDate(todaySalon())}
              className="h-8 shrink-0 cursor-pointer border border-gold/30 px-2 text-xs font-medium uppercase tracking-wide text-charcoal-muted transition-colors hover:border-gold disabled:cursor-not-allowed disabled:opacity-40"
            >
              Hoy
            </button>
            {renderDayButtons()}
            {renderArrows()}
          </div>

          <span className="h-4 w-px bg-gold/25" aria-hidden />

          <span className={`${typography.caption} shrink-0 tabular-nums`}>
            {appointmentCount} {appointmentCount === 1 ? 'cita' : 'citas'}
          </span>

          {hasSelection && selectionSummary ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="h-4 w-px bg-gold/25" aria-hidden />
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

          <div className="ml-auto flex items-center gap-2">
            {notificationBell}
            {navLinks}
          </div>
        </div>
      </div>
    </div>
  )
}
