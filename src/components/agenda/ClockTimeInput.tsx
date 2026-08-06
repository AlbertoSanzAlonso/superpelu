import { minutesToTime, timeToMinutes } from '@/lib/agenda/adminCalendar'

type Props = {
  value: string
  onChange: (value: string) => void
  /** Hora mostrada y base de ajuste cuando `value` está vacío. */
  defaultTime?: string
  /** Permite volver a vacío (p. ej. hora encadenada automática). */
  allowEmpty?: boolean
  /** Texto junto al reloj cuando value está vacío (p. ej. «Automática»). */
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

function SpinButton({
  label,
  disabled,
  onClick,
  direction,
}: {
  label: string
  disabled?: boolean
  onClick: () => void
  direction: 'up' | 'down'
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={label}
      onClick={onClick}
      className="flex h-6 w-9 items-center justify-center border border-gold/30 text-[10px] text-gold transition-colors hover:border-gold hover:bg-gold/10 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {direction === 'up' ? '▲' : '▼'}
    </button>
  )
}

/**
 * Selector de hora tipo reloj: columnas HH / MM con subir/bajar
 * desde la hora actual o la hora por defecto.
 */
export function ClockTimeInput({
  value,
  onChange,
  defaultTime,
  allowEmpty = false,
  emptyHint,
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
    const clamped = clampMinutes(nextMinutes, minMinutes, maxMinutes)
    onChange(minutesToTime(clamped))
  }

  const bumpHours = (delta: number) => {
    commit(total + delta * 60)
  }

  const bumpMinutes = (delta: number) => {
    commit(total + delta * minuteStep)
  }

  const confirmDisplayed = () => {
    if (!disabled && isUnset) onChange(minutesToTime(total))
  }

  return (
    <div className={className}>
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
      <div
        className={`flex flex-wrap items-center gap-3 border border-gold/30 bg-cream px-2 py-1.5 ${
          disabled ? 'opacity-50' : ''
        }`}
      >
        <div className="flex items-center gap-1.5">
          <div className="flex flex-col items-center gap-0.5">
            <SpinButton
              label="Subir hora"
              direction="up"
              disabled={disabled || total + 60 > maxMinutes}
              onClick={() => bumpHours(1)}
            />
            <button
              type="button"
              disabled={disabled}
              onClick={confirmDisplayed}
              className={`w-9 text-center text-base tabular-nums disabled:opacity-50 ${
                isUnset ? 'text-charcoal-muted' : 'font-medium text-charcoal'
              }`}
              aria-label={`Hora ${String(hours).padStart(2, '0')}`}
            >
              {String(hours).padStart(2, '0')}
            </button>
            <SpinButton
              label="Bajar hora"
              direction="down"
              disabled={disabled || total - 60 < minMinutes}
              onClick={() => bumpHours(-1)}
            />
          </div>

          <span className="pb-0.5 text-base font-medium text-charcoal-muted" aria-hidden>
            :
          </span>

          <div className="flex flex-col items-center gap-0.5">
            <SpinButton
              label={`Subir ${minuteStep} minutos`}
              direction="up"
              disabled={disabled || total + minuteStep > maxMinutes}
              onClick={() => bumpMinutes(1)}
            />
            <button
              type="button"
              disabled={disabled}
              onClick={confirmDisplayed}
              className={`w-9 text-center text-base tabular-nums disabled:opacity-50 ${
                isUnset ? 'text-charcoal-muted' : 'font-medium text-charcoal'
              }`}
              aria-label={`Minutos ${String(minutes).padStart(2, '0')}`}
            >
              {String(minutes).padStart(2, '0')}
            </button>
            <SpinButton
              label={`Bajar ${minuteStep} minutos`}
              direction="down"
              disabled={disabled || total - minuteStep < minMinutes}
              onClick={() => bumpMinutes(-1)}
            />
          </div>
        </div>

        <div className="min-w-0 flex-1 space-y-1">
          {isAutomatic ? (
            <p className="text-xs text-charcoal-muted">
              {emptyHint ?? `Automática · ${minutesToTime(total)}`}
            </p>
          ) : isUnset ? (
            <p className="text-xs text-charcoal-muted">
              Sugerida · {minutesToTime(total)}
            </p>
          ) : (
            <p className="text-xs tabular-nums text-charcoal">{minutesToTime(total)}</p>
          )}
          {allowEmpty && !isAutomatic && (
            <button
              type="button"
              disabled={disabled}
              onClick={() => onChange('')}
              className="text-xs text-gold underline-offset-2 hover:underline disabled:opacity-40"
            >
              Volver a automática
            </button>
          )}
          {isUnset && (
            <p className="text-[10px] text-charcoal-muted">Ajusta ▲▼ para fijar hora</p>
          )}
        </div>
      </div>
    </div>
  )
}
