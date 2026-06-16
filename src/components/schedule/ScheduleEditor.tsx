import { typography } from '@/styles/typography'
import { DAY_NAMES, DAY_ORDER, cloneWindows } from './constants'
import type { WeeklyWindows } from './constants'

export function ScheduleEditor({
  weeklyWindows,
  onChange,
}: {
  weeklyWindows: WeeklyWindows
  onChange: (w: WeeklyWindows) => void
}) {
  const updateRange = (day: number, idx: number, field: 'start' | 'end', value: string) => {
    const next = cloneWindows(weeklyWindows)
    if (!next[day]) next[day] = []
    next[day][idx] = { ...next[day][idx], [field]: value }
    onChange(next)
  }

  const addRange = (day: number) => {
    const next = cloneWindows(weeklyWindows)
    if (!next[day]) next[day] = []
    next[day].push({ start: '10:00', end: '14:00' })
    onChange(next)
  }

  const removeRange = (day: number, idx: number) => {
    const next = cloneWindows(weeklyWindows)
    next[day] = next[day].filter((_, i) => i !== idx)
    onChange(next)
  }

  const toggleDay = (day: number) => {
    const next = cloneWindows(weeklyWindows)
    if ((next[day] ?? []).length > 0) {
      next[day] = []
    } else {
      next[day] = [{ start: '10:00', end: '14:00' }]
    }
    onChange(next)
  }

  return (
    <div className="space-y-3">
      {DAY_ORDER.map((day) => {
        const ranges = weeklyWindows[day] ?? []
        const isOpen = ranges.length > 0
        return (
          <div key={day} className="border border-gold/15 bg-cream/60 p-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => toggleDay(day)}
                className={`flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center border text-xs ${
                  isOpen
                    ? 'border-gold bg-gold/15 text-gold'
                    : 'border-gold/30 text-transparent hover:border-gold/60'
                }`}
              >
                {isOpen ? '\u2713' : '\u00A0'}
              </button>
              <span className={`${typography.label} w-24 shrink-0`}>{DAY_NAMES[day]}</span>
              {isOpen ? (
                <div className="flex flex-1 flex-wrap items-center gap-2">
                  {ranges.map((range, idx) => (
                    <div key={idx} className="flex items-center gap-1.5">
                      <input
                        type="time"
                        value={range.start}
                        onChange={(e) => updateRange(day, idx, 'start', e.target.value)}
                        className="h-7 w-24 cursor-pointer border border-gold/30 bg-cream px-1.5 text-xs text-charcoal outline-none focus:border-gold"
                      />
                      <span className="text-xs text-charcoal-muted">a</span>
                      <input
                        type="time"
                        value={range.end}
                        onChange={(e) => updateRange(day, idx, 'end', e.target.value)}
                        className="h-7 w-24 cursor-pointer border border-gold/30 bg-cream px-1.5 text-xs text-charcoal outline-none focus:border-gold"
                      />
                      <button
                        type="button"
                        onClick={() => removeRange(day, idx)}
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
                    onClick={() => addRange(day)}
                    className="flex h-7 cursor-pointer items-center border border-gold/30 px-2 text-xs text-gold hover:border-gold hover:bg-gold/10"
                  >
                    + Franja
                  </button>
                </div>
              ) : (
                <span className="text-xs text-charcoal-muted">Cerrado</span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
