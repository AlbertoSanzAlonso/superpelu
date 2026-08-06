import { minutesToTime, timeToMinutes } from '@/lib/agenda/adminCalendar'

type Props = {
  value: string
  onChange: (value: string) => void
  /** Hora mostrada y base de ajuste cuando `value` está vacío. */
  defaultTime?: string
  /** Permite volver a vacío (p. ej. hora encadenada automática). */
  allowEmpty?: boolean
  /** Texto breve cuando value está vacío (p. ej. «Auto»). */
  emptyHint?: string
  minuteStep?: number
  minMinutes?: number
  maxMinutes?: number
  disabled?: boolean
  required?: boolean
  className?: string
}

const FALLBACK_TIME = '10:00'

function clampMinutes(minutes: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, minutes))
}

function parseOrFallback(time: string | undefined, fallback: string): number {
  if (!time || !/^\d{1,2}:\d{2}$/.test(time)) return timeToMinutes(fallback)
  return timeToMinutes(time)
}

/** Misma altura visual que los selects compactos del modal (`py-1.5 text-sm`). */
const fieldCn =
  'border border-gold/30 bg-cream px-2 py-1.5 text-sm tabular-nums text-charcoal outline-none focus:border-gold disabled:cursor-not-allowed disabled:opacity-50'

/**
 * Hora con campos numéricos HH / MM (flechas nativas del input),
 * alineados en altura con especialista y duración.
 */
export function ClockTimeInput({
  value,
  onChange,
  defaultTime,
  allowEmpty = false,
  emptyHint = 'Auto',
  minuteStep = 5,
  minMinutes = 6 * 60,
  maxMinutes = 22 * 60 + 55,
  disabled = false,
  required = false,
  className = '',
}: Props) {
  const baseTime = value || defaultTime || FALLBACK_TIME
  const total = clampMinutes(parseOrFallback(baseTime, FALLBACK_TIME), minMinutes, maxMinutes)
  const hours = Math.floor(total / 60)
  const minutes = total % 60
  const isUnset = value === ''
  const isAutomatic = allowEmpty && isUnset

  const commit = (nextMinutes: number) => {
    onChange(minutesToTime(clampMinutes(nextMinutes, minMinutes, maxMinutes)))
  }

  const setHours = (raw: number) => {
    const h = Number.isFinite(raw) ? Math.trunc(raw) : hours
    commit(h * 60 + minutes)
  }

  const setMinutes = (raw: number) => {
    let m = Number.isFinite(raw) ? Math.trunc(raw) : minutes
    // Ajusta al múltiplo de step más cercano.
    m = Math.round(m / minuteStep) * minuteStep
    if (m >= 60) m = 60 - minuteStep
    if (m < 0) m = 0
    commit(hours * 60 + m)
  }

  return (
    <div className={`inline-flex items-center gap-1.5 ${className}`}>
      {required && (
        <input
          tabIndex={-1}
          aria-hidden
          className="pointer-events-none absolute h-0 w-0 opacity-0"
          value={value}
          required
          disabled={disabled}
          onChange={() => {}}
        />
      )}
      <input
        type="number"
        inputMode="numeric"
        min={Math.floor(minMinutes / 60)}
        max={Math.floor(maxMinutes / 60)}
        step={1}
        value={hours}
        disabled={disabled}
        aria-label="Horas"
        onChange={(e) => setHours(e.target.valueAsNumber)}
        className={`${fieldCn} w-[3.25rem] cursor-text ${isUnset ? 'text-charcoal-muted' : ''}`}
      />
      <span className="text-sm font-medium text-charcoal-muted" aria-hidden>
        :
      </span>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        max={60 - minuteStep}
        step={minuteStep}
        value={minutes}
        disabled={disabled}
        aria-label="Minutos"
        onChange={(e) => setMinutes(e.target.valueAsNumber)}
        className={`${fieldCn} w-[3.25rem] cursor-text ${isUnset ? 'text-charcoal-muted' : ''}`}
      />
      {allowEmpty && (
        isAutomatic ? (
          <span className="text-[10px] text-charcoal-muted">{emptyHint}</span>
        ) : (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange('')}
            className="cursor-pointer text-[10px] text-gold underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:opacity-40"
          >
            Auto
          </button>
        )
      )}
    </div>
  )
}
