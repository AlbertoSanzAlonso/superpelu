import { minutesToTime, timeToMinutes } from '@/lib/agenda/adminCalendar'

type Props = {
  value: string
  onChange: (value: string) => void
  /** Hora mostrada y base de ajuste cuando `value` está vacío. */
  defaultTime?: string
  /** Permite volver a vacío (p. ej. hora encadenada automática). */
  allowEmpty?: boolean
  /** Texto breve cuando value está vacío (p. ej. «Auto»). Sin repetir la hora. */
  emptyHint?: string
  minuteStep?: number
  minMinutes?: number
  maxMinutes?: number
  disabled?: boolean
  required?: boolean
  /** Reloj más compacto (p. ej. dentro de un tratamiento). */
  compact?: boolean
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
  compact,
}: {
  label: string
  disabled?: boolean
  onClick: () => void
  direction: 'up' | 'down'
  compact?: boolean
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={label}
      onClick={onClick}
      className={`flex cursor-pointer items-center justify-center border border-gold/30 text-gold transition-colors hover:border-gold hover:bg-gold/10 disabled:cursor-not-allowed disabled:opacity-40 ${
        compact ? 'h-4 w-6 text-[8px]' : 'h-5 w-7 text-[9px]'
      }`}
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
  emptyHint = 'Auto',
  minuteStep = 5,
  minMinutes = 6 * 60,
  maxMinutes = 22 * 60 + 55,
  disabled = false,
  required = false,
  compact = false,
  className = '',
}: Props) {
  const baseTime = value || defaultTime || FALLBACK_TIME
  const total = clampMinutes(parseOrFallback(baseTime, FALLBACK_TIME), minMinutes, maxMinutes)
  const hours = Math.floor(total / 60)
  const minutes = total % 60
  const isUnset = value === ''
  const isAutomatic = allowEmpty && isUnset
  const digitCn = compact
    ? 'w-6 text-center text-sm tabular-nums'
    : 'w-7 text-center text-sm tabular-nums'

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
        className={`inline-flex flex-wrap items-center gap-1.5 border border-gold/30 bg-cream ${
          compact ? 'px-1.5 py-1' : 'px-2 py-1'
        } ${disabled ? 'opacity-50' : ''}`}
      >
        <div className="flex items-center gap-0.5" aria-label={`Hora ${minutesToTime(total)}`}>
          <div className="flex flex-col items-center gap-px">
            <SpinButton
              label="Subir hora"
              direction="up"
              compact={compact}
              disabled={disabled || total + 60 > maxMinutes}
              onClick={() => bumpHours(1)}
            />
            <button
              type="button"
              disabled={disabled}
              onClick={confirmDisplayed}
              className={`${digitCn} cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${
                isUnset ? 'text-charcoal-muted' : 'font-medium text-charcoal'
              }`}
              aria-label={`Hora ${String(hours).padStart(2, '0')}`}
            >
              {String(hours).padStart(2, '0')}
            </button>
            <SpinButton
              label="Bajar hora"
              direction="down"
              compact={compact}
              disabled={disabled || total - 60 < minMinutes}
              onClick={() => bumpHours(-1)}
            />
          </div>

          <span
            className={`font-medium text-charcoal-muted ${compact ? 'text-sm' : 'text-sm'}`}
            aria-hidden
          >
            :
          </span>

          <div className="flex flex-col items-center gap-px">
            <SpinButton
              label={`Subir ${minuteStep} minutos`}
              direction="up"
              compact={compact}
              disabled={disabled || total + minuteStep > maxMinutes}
              onClick={() => bumpMinutes(1)}
            />
            <button
              type="button"
              disabled={disabled}
              onClick={confirmDisplayed}
              className={`${digitCn} cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${
                isUnset ? 'text-charcoal-muted' : 'font-medium text-charcoal'
              }`}
              aria-label={`Minutos ${String(minutes).padStart(2, '0')}`}
            >
              {String(minutes).padStart(2, '0')}
            </button>
            <SpinButton
              label={`Bajar ${minuteStep} minutos`}
              direction="down"
              compact={compact}
              disabled={disabled || total - minuteStep < minMinutes}
              onClick={() => bumpMinutes(-1)}
            />
          </div>
        </div>

        {allowEmpty && (
          <div className="min-w-0">
            {isAutomatic ? (
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
            )}
          </div>
        )}
      </div>
    </div>
  )
}
