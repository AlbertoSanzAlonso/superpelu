import { useState } from 'react'
import { typography } from '@/styles/typography'
import { Button } from '@/components/ui/Button'
import { enumerateDateRange, SpecialDateRangeCalendar } from './SpecialDateRangeCalendar'

function orderedBounds(start: string, end: string): { from: string; to: string } {
  if (!start) return { from: '', to: '' }
  const effectiveEnd = end || start
  return start <= effectiveEnd
    ? { from: start, to: effectiveEnd }
    : { from: effectiveEnd, to: start }
}

export function SpecialSpanDateEditor({
  start,
  end,
  existingDates,
  minDate,
  onApply,
}: {
  start: string
  end: string
  /** Fechas de otros horarios especiales: no se pueden pisar. */
  existingDates: ReadonlySet<string>
  minDate: string
  onApply: (start: string, end: string) => void
}) {
  const [rangeStart, setRangeStart] = useState(start)
  const [rangeEnd, setRangeEnd] = useState(end === start ? '' : end)

  const pickDate = (dateStr: string) => {
    if (!rangeStart || (rangeStart && rangeEnd)) {
      setRangeStart(dateStr)
      setRangeEnd('')
      return
    }
    setRangeEnd(dateStr)
  }

  const { from, to } = orderedBounds(rangeStart, rangeEnd)
  const changed = Boolean(from) && (from !== start || to !== end)
  const overlaps = changed && enumerateDateRange(from, to).some((date) => existingDates.has(date))
  const singleDay = from === to

  return (
    <div className="mb-3">
      <span className={`${typography.caption} mb-1 block normal-case tracking-normal`}>Días</span>
      <p className="mb-2 text-xs text-charcoal-muted">
        Primer clic marca el inicio y el segundo el final.
      </p>
      <SpecialDateRangeCalendar
        rangeStart={rangeStart}
        rangeEnd={rangeEnd}
        onPick={pickDate}
        existingDates={existingDates}
        minDate={minDate}
      />
      {changed && (
        <div className="mt-2">
          {overlaps ? (
            <p className="text-xs text-red-600">Esas fechas ya tienen un horario especial.</p>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() => onApply(from, to)}
            >
              {singleDay ? 'Cambiar día' : 'Cambiar días'}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
