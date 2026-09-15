import { useMemo, useState } from 'react'
import { addDaysToDateString, toDateString, todaySalon } from '@/lib/core/dates'
import { typography } from '@/styles/typography'

type Props = {
  rangeStart: string
  rangeEnd: string
  onPick: (dateStr: string) => void
  /** Fechas que ya tienen horario especial (solo marca visual). */
  existingDates?: ReadonlySet<string>
  minDate?: string
}

function parseYmd(dateStr: string): { year: number; month: number; day: number } {
  const [year, month, day] = dateStr.split('-').map(Number)
  return { year, month, day }
}

function ymd(year: number, month: number, day: number): string {
  return toDateString(new Date(year, month - 1, day))
}

function buildMonthCells(year: number, month: number): Array<string | null> {
  const firstDow = new Date(year, month - 1, 1).getDay()
  const mondayOffset = (firstDow + 6) % 7
  const daysInMonth = new Date(year, month, 0).getDate()
  const cells: Array<string | null> = Array(mondayOffset).fill(null)
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(ymd(year, month, day))
  }
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

const WEEKDAYS = (() => {
  const fmt = new Intl.DateTimeFormat('es-ES', { weekday: 'short' })
  return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(2024, 0, 1 + i)))
})()

/** Lista inclusiva de fechas YYYY-MM-DD entre dos extremos (orden indiferente). */
export function enumerateDateRange(a: string, b: string): string[] {
  const from = a <= b ? a : b
  const to = a <= b ? b : a
  const out: string[] = []
  let cursor = from
  while (cursor <= to) {
    out.push(cursor)
    cursor = addDaysToDateString(cursor, 1)
  }
  return out
}

export function formatSpecialDateRangeLabel(start: string, end: string): string {
  if (!start) return ''
  const effectiveEnd = end || start
  const fmt = (dateStr: string) =>
    new Date(dateStr + 'T12:00:00').toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  if (start === effectiveEnd) return fmt(start)
  const [from, to] = start <= effectiveEnd ? [start, effectiveEnd] : [effectiveEnd, start]
  return `${fmt(from)} – ${fmt(to)}`
}

export function SpecialDateRangeCalendar({
  rangeStart,
  rangeEnd,
  onPick,
  existingDates,
  minDate = todaySalon(),
}: Props) {
  const today = todaySalon()
  const [view, setView] = useState(() => {
    const { year, month } = parseYmd(minDate || today)
    return { year, month }
  })

  const cells = useMemo(() => buildMonthCells(view.year, view.month), [view.year, view.month])

  const monthTitle = useMemo(
    () =>
      new Date(view.year, view.month - 1, 1).toLocaleDateString('es-ES', {
        month: 'long',
        year: 'numeric',
      }),
    [view.year, view.month],
  )

  const effectiveEnd = rangeEnd || rangeStart
  const rangeFrom = rangeStart && effectiveEnd
    ? rangeStart <= effectiveEnd
      ? rangeStart
      : effectiveEnd
    : ''
  const rangeTo = rangeStart && effectiveEnd
    ? rangeStart <= effectiveEnd
      ? effectiveEnd
      : rangeStart
    : ''

  function goPrevMonth() {
    setView((v) => (v.month === 1 ? { year: v.year - 1, month: 12 } : { year: v.year, month: v.month - 1 }))
  }

  function goNextMonth() {
    setView((v) => (v.month === 12 ? { year: v.year + 1, month: 1 } : { year: v.year, month: v.month + 1 }))
  }

  const viewMonthKey = `${view.year}-${String(view.month).padStart(2, '0')}`
  const minMonthKey = minDate.slice(0, 7)
  const canPrev = viewMonthKey > minMonthKey

  return (
    <div className="w-full max-w-[17rem] border border-gold/30 bg-cream/40 p-2">
      <div className="mb-2 flex items-center justify-between gap-1">
        <button
          type="button"
          onClick={goPrevMonth}
          disabled={!canPrev}
          className="ui-rounded flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center border border-gold/30 bg-cream/30 text-sm text-gold transition-colors hover:border-gold/60 hover:bg-gold/10 disabled:cursor-not-allowed disabled:opacity-30"
          aria-label="Mes anterior"
        >
          ‹
        </button>
        <p className={`flex-1 text-center capitalize text-gold ${typography.caption} text-xs`}>
          {monthTitle}
        </p>
        <button
          type="button"
          onClick={goNextMonth}
          className="ui-rounded flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center border border-gold/30 bg-cream/30 text-sm text-gold transition-colors hover:border-gold/60 hover:bg-gold/10"
          aria-label="Mes siguiente"
        >
          ›
        </button>
      </div>

      <div className="grid grid-cols-7 gap-0.5" role="grid" aria-label={monthTitle}>
        {WEEKDAYS.map((label) => (
          <div
            key={label}
            className={`${typography.caption} py-0.5 text-center text-[9px] normal-case`}
            role="columnheader"
          >
            {label}
          </div>
        ))}
        {cells.map((dateStr, index) => {
          if (!dateStr) {
            return <div key={`empty-${index}`} className="aspect-square" aria-hidden />
          }

          const disabled = dateStr < minDate
          const isToday = dateStr === today
          const inRange = Boolean(rangeFrom && rangeTo && dateStr >= rangeFrom && dateStr <= rangeTo)
          const isEdge = dateStr === rangeFrom || dateStr === rangeTo
          const alreadyExists = existingDates?.has(dateStr) ?? false
          const dayNum = parseYmd(dateStr).day

          return (
            <button
              key={dateStr}
              type="button"
              disabled={disabled}
              onClick={() => onPick(dateStr)}
              className={`aspect-square text-xs transition-colors ${
                disabled
                  ? 'cursor-not-allowed border border-transparent text-charcoal-muted/40'
                  : isEdge
                    ? 'cursor-pointer border-2 border-gold bg-gold/25 font-semibold text-gold'
                    : inRange
                      ? 'cursor-pointer border border-gold/40 bg-gold/15 text-charcoal'
                      : alreadyExists
                        ? 'cursor-pointer border border-gold/20 bg-cream/50 text-charcoal-muted hover:border-gold hover:bg-gold/10'
                        : 'cursor-pointer border border-gold/25 bg-cream/25 text-charcoal hover:border-gold hover:bg-gold/15'
              } ${isToday && !disabled && !isEdge ? 'ring-1 ring-gold/50' : ''}`}
              aria-label={dateStr}
              aria-pressed={inRange}
            >
              {dayNum}
            </button>
          )
        })}
      </div>
    </div>
  )
}
