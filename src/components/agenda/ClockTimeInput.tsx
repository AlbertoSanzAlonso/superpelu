import { minutesToTime, timeToMinutes } from '@/lib/agenda/adminCalendar'

type Props = {
  value: string
  onChange: (value: string) => void
  /** Hora mostrada y base de ajuste cuando `value` está vacío. */
  defaultTime?: string
  /** Permite value vacío (hora encadenada automática). */
  allowEmpty?: boolean
  minuteStep?: number
  minMinutes?: number
  maxMinutes?: number
  disabled?: boolean
  required?: boolean
  /** Muestra etiquetas «Horas» / «Minutos» (editor del título). */
  labeled?: boolean
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

/** Misma altura que selects compactos; ancho con margen para las flechas nativas. */
const fieldCn =
  'clock-time-num w-[4.75rem] min-w-[4.75rem] border border-gold/40 bg-white px-2 py-1.5 text-center text-sm tabular-nums text-charcoal outline-none focus:border-gold focus:ring-1 focus:ring-gold/30 disabled:cursor-not-allowed disabled:opacity-50'

/**
 * Hora con campos numéricos HH / MM (flechas nativas del input).
 */
export function ClockTimeInput({
  value,
  onChange,
  defaultTime,
  minuteStep = 5,
  minMinutes = 6 * 60,
  maxMinutes = 22 * 60 + 55,
  disabled = false,
  required = false,
  labeled = false,
  className = '',
}: Props) {
  const baseTime = value || defaultTime || FALLBACK_TIME
  const total = clampMinutes(parseOrFallback(baseTime, FALLBACK_TIME), minMinutes, maxMinutes)
  const hours = Math.floor(total / 60)
  const minutes = total % 60
  const isUnset = value === ''

  const commit = (nextMinutes: number) => {
    onChange(minutesToTime(clampMinutes(nextMinutes, minMinutes, maxMinutes)))
  }

  const setHours = (raw: number) => {
    if (!Number.isFinite(raw)) return
    commit(Math.trunc(raw) * 60 + minutes)
  }

  const setMinutes = (raw: number) => {
    if (!Number.isFinite(raw)) return
    let m = Math.trunc(raw)
    m = Math.round(m / minuteStep) * minuteStep
    if (m >= 60) m = 60 - minuteStep
    if (m < 0) m = 0
    commit(hours * 60 + m)
  }

  const hourInput = (
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
      className={`${fieldCn} cursor-text ${isUnset ? 'text-charcoal-muted' : ''}`}
    />
  )

  const minuteInput = (
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
      className={`${fieldCn} cursor-text ${isUnset ? 'text-charcoal-muted' : ''}`}
    />
  )

  return (
    <div className={`inline-flex items-end gap-2 ${className}`}>
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
      {labeled ? (
        <>
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] font-medium uppercase tracking-wide text-charcoal-muted">
              Horas
            </span>
            {hourInput}
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] font-medium uppercase tracking-wide text-charcoal-muted">
              Minutos
            </span>
            {minuteInput}
          </div>
        </>
      ) : (
        <>
          {hourInput}
          <span className="pb-1.5 text-sm font-medium text-charcoal-muted" aria-hidden>
            :
          </span>
          {minuteInput}
        </>
      )}
    </div>
  )
}
