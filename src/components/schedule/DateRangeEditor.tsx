import type { ScheduleTimeRange } from '@/types/schedule'

export function DateRangeEditor({
  ranges,
  onChange,
}: {
  ranges: ScheduleTimeRange[]
  onChange: (ranges: ScheduleTimeRange[]) => void
}) {
  const update = (idx: number, field: 'start' | 'end', value: string) => {
    const next = ranges.map((r, i) => (i === idx ? { ...r, [field]: value } : r))
    onChange(next)
  }

  const add = () => {
    onChange([...ranges, { start: '10:00', end: '14:00' }])
  }

  const remove = (idx: number) => {
    onChange(ranges.filter((_, i) => i !== idx))
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {ranges.map((range, idx) => (
        <div key={idx} className="flex items-center gap-1.5">
          <input
            type="time"
            value={range.start}
            onChange={(e) => update(idx, 'start', e.target.value)}
            className="h-7 w-24 cursor-pointer border border-gold/30 bg-cream px-1.5 text-xs text-charcoal outline-none focus:border-gold"
          />
          <span className="text-xs text-charcoal-muted">a</span>
          <input
            type="time"
            value={range.end}
            onChange={(e) => update(idx, 'end', e.target.value)}
            className="h-7 w-24 cursor-pointer border border-gold/30 bg-cream px-1.5 text-xs text-charcoal outline-none focus:border-gold"
          />
          <button
            type="button"
            onClick={() => remove(idx)}
            className="flex h-7 w-7 cursor-pointer items-center justify-center border border-gold/30 text-xs text-charcoal-muted hover:border-red-400 hover:text-red-500"
            aria-label="Eliminar franja"
          >
            x
          </button>
          {idx < ranges.length - 1 && (
            <span className="mx-1 text-xs text-charcoal-muted">+</span>
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="flex h-7 cursor-pointer items-center border border-gold/30 px-2 text-xs text-gold hover:border-gold hover:bg-gold/10"
      >
        + Franja
      </button>
    </div>
  )
}
