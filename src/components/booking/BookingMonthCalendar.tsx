import { useEffect, useMemo, useState } from 'react'
import type { Locale } from '@/i18n/types'
import { toDateString, todaySalon } from '@/lib/core/dates'
import { typography } from '@/styles/typography'

type Props = {
  bookableDates: ReadonlySet<string>
  locale: Locale
  selectedDate?: string
  onSelect: (dateStr: string) => void
  disabled?: boolean
  /** Calendario reducido al elegir día (paso de horas). */
  compact?: boolean
  prevMonthLabel: string
  nextMonthLabel: string
}

function parseYmd(dateStr: string): { year: number; month: number; day: number } {
  const [year, month, day] = dateStr.split('-').map(Number)
  return { year, month, day }
}

function ymd(year: number, month: number, day: number): string {
  return toDateString(new Date(year, month - 1, day))
}

function monthBounds(bookableDates: ReadonlySet<string>): { min: string; max: string } | null {
  if (bookableDates.size === 0) return null
  let min = ''
  let max = ''
  for (const d of bookableDates) {
    if (!min || d < min) min = d
    if (!max || d > max) max = d
  }
  return { min, max }
}

function initialViewMonth(bookableDates: ReadonlySet<string>): { year: number; month: number } {
  const today = todaySalon()
  if (bookableDates.has(today)) {
    const { year, month } = parseYmd(today)
    return { year, month }
  }
  const sorted = [...bookableDates].sort()
  if (sorted[0]) return parseYmd(sorted[0])
  const now = new Date()
  return { year: now.getFullYear(), month: now.getMonth() + 1 }
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

function weekdayLabels(locale: Locale): string[] {
  const fmt = new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'es-ES', { weekday: 'short' })
  return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(2024, 0, 1 + i)))
}

export function BookingMonthCalendar({
  bookableDates,
  locale,
  selectedDate = '',
  onSelect,
  disabled = false,
  compact = false,
  prevMonthLabel,
  nextMonthLabel,
}: Props) {
  const bounds = useMemo(() => monthBounds(bookableDates), [bookableDates])
  const [view, setView] = useState(() => initialViewMonth(bookableDates))

  useEffect(() => {
    if (!selectedDate) return
    const { year, month } = parseYmd(selectedDate)
    setView({ year, month })
  }, [selectedDate])

  const cells = useMemo(() => buildMonthCells(view.year, view.month), [view.year, view.month])
  const weekdays = useMemo(() => weekdayLabels(locale), [locale])

  const monthTitle = useMemo(
    () =>
      new Date(view.year, view.month - 1, 1).toLocaleDateString(
        locale === 'en' ? 'en-GB' : 'es-ES',
        { month: 'long', year: 'numeric' },
      ),
    [view.year, view.month, locale],
  )

  const today = todaySalon()
  const viewMonthKey = `${view.year}-${String(view.month).padStart(2, '0')}`
  const minMonthKey = bounds
    ? `${parseYmd(bounds.min).year}-${String(parseYmd(bounds.min).month).padStart(2, '0')}`
    : viewMonthKey
  const maxMonthKey = bounds
    ? `${parseYmd(bounds.max).year}-${String(parseYmd(bounds.max).month).padStart(2, '0')}`
    : viewMonthKey

  const canPrev = viewMonthKey > minMonthKey
  const canNext = viewMonthKey < maxMonthKey

  function goPrevMonth() {
    if (!canPrev) return
    setView((v) => {
      if (v.month === 1) return { year: v.year - 1, month: 12 }
      return { year: v.year, month: v.month - 1 }
    })
  }

  function goNextMonth() {
    if (!canNext) return
    setView((v) => {
      if (v.month === 12) return { year: v.year + 1, month: 1 }
      return { year: v.year, month: v.month + 1 }
    })
  }

  return (
    <div
      className={`border border-gold/30 bg-cream/40 backdrop-blur-[2px] ${compact ? 'mx-auto max-w-[17rem] p-2' : 'p-4'} ${disabled ? 'pointer-events-none opacity-50' : ''}`}
      aria-disabled={disabled}
    >
      <div className={`flex items-center justify-between gap-1 ${compact ? 'mb-2' : 'mb-4'}`}>
        <button
          type="button"
          onClick={goPrevMonth}
          disabled={!canPrev || disabled}
          className={`ui-rounded flex shrink-0 cursor-pointer items-center justify-center border border-gold/30 bg-cream/30 text-gold backdrop-blur-[2px] transition-colors hover:border-gold/60 hover:bg-gold/10 disabled:cursor-not-allowed disabled:opacity-30 ${
            compact ? 'h-7 w-7 text-sm' : 'h-9 w-9'
          }`}
          aria-label={prevMonthLabel}
        >
          ‹
        </button>
        <p
          className={`flex-1 text-center capitalize text-gold ${
            compact ? `${typography.caption} text-xs` : typography.h3
          }`}
        >
          {monthTitle}
        </p>
        <button
          type="button"
          onClick={goNextMonth}
          disabled={!canNext || disabled}
          className={`ui-rounded flex shrink-0 cursor-pointer items-center justify-center border border-gold/30 bg-cream/30 text-gold backdrop-blur-[2px] transition-colors hover:border-gold/60 hover:bg-gold/10 disabled:cursor-not-allowed disabled:opacity-30 ${
            compact ? 'h-7 w-7 text-sm' : 'h-9 w-9'
          }`}
          aria-label={nextMonthLabel}
        >
          ›
        </button>
      </div>

      <div className={`grid grid-cols-7 ${compact ? 'gap-0.5' : 'gap-1'}`} role="grid" aria-label={monthTitle}>
        {weekdays.map((label) => (
          <div
            key={label}
            className={`${typography.caption} text-center normal-case ${compact ? 'py-0.5 text-[9px]' : 'py-1 text-[10px]'}`}
            role="columnheader"
          >
            {label}
          </div>
        ))}
        {cells.map((dateStr, index) => {
          if (!dateStr) {
            return <div key={`empty-${index}`} className="aspect-square" aria-hidden />
          }

          const bookable = bookableDates.has(dateStr)
          const isToday = dateStr === today
          const isSelected = selectedDate === dateStr
          const dayNum = parseYmd(dateStr).day

          return (
            <button
              key={dateStr}
              type="button"
              disabled={!bookable || disabled}
              onClick={() => onSelect(dateStr)}
              className={`aspect-square cursor-pointer transition-colors ${compact ? 'text-xs' : 'text-sm'} ${
                bookable
                  ? isSelected
                    ? 'border-2 border-gold bg-gold/20 font-semibold text-gold backdrop-blur-[1px]'
                    : 'border border-gold/25 bg-cream/25 text-charcoal backdrop-blur-[1px] hover:border-gold hover:bg-gold/15'
                  : 'cursor-not-allowed border border-transparent text-charcoal-muted/40'
              } ${isToday && bookable && !isSelected ? 'ring-1 ring-gold/50' : ''}`}
              aria-label={dateStr}
              aria-pressed={isSelected}
            >
              {dayNum}
            </button>
          )
        })}
      </div>
    </div>
  )
}
