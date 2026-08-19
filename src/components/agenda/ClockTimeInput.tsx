import { useCallback, useEffect, useRef, useState } from 'react'
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

  // Estado local para edición libre con teclado; se sincroniza al perder el foco.
  const [localHours, setLocalHours] = useState<string>(String(hours))
  const [localMinutes, setLocalMinutes] = useState<string>(String(minutes).padStart(2, '0'))
  const hourFocused = useRef(false)
  const minuteFocused = useRef(false)

  // Sincronizar estado local cuando el valor externo cambia y el campo no está enfocado.
  useEffect(() => {
    if (!hourFocused.current) setLocalHours(String(hours))
  }, [hours])
  useEffect(() => {
    if (!minuteFocused.current) setLocalMinutes(String(minutes).padStart(2, '0'))
  }, [minutes])

  const commitHours = useCallback(() => {
    const raw = parseInt(localHours, 10)
    if (!Number.isFinite(raw) || isNaN(raw)) {
      setLocalHours(String(hours))
      return
    }
    commit(Math.trunc(raw) * 60 + minutes)
  }, [localHours, hours, minutes]) // eslint-disable-line react-hooks/exhaustive-deps

  const commitMinutes = useCallback(() => {
    const raw = parseInt(localMinutes, 10)
    if (!Number.isFinite(raw) || isNaN(raw)) {
      setLocalMinutes(String(minutes).padStart(2, '0'))
      return
    }
    let m = Math.trunc(raw)
    m = Math.round(m / minuteStep) * minuteStep
    if (m >= 60) m = 60 - minuteStep
    if (m < 0) m = 0
    setLocalMinutes(String(m).padStart(2, '0'))
    commit(hours * 60 + m)
  }, [localMinutes, hours, minutes, minuteStep]) // eslint-disable-line react-hooks/exhaustive-deps

  const hourInput = (
    <input
      type="number"
      inputMode="numeric"
      min={Math.floor(minMinutes / 60)}
      max={Math.floor(maxMinutes / 60)}
      step={1}
      value={localHours}
      disabled={disabled}
      aria-label="Horas"
      onFocus={() => { hourFocused.current = true }}
      onChange={(e) => setLocalHours(e.target.value)}
      onBlur={() => { hourFocused.current = false; commitHours() }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') { commitHours(); (e.target as HTMLInputElement).blur() }
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          e.preventDefault()
          const delta = e.key === 'ArrowUp' ? 1 : -1
          const cur = parseInt(localHours, 10)
          const next = isNaN(cur) ? hours + delta : cur + delta
          setLocalHours(String(next))
          commit(Math.trunc(next) * 60 + minutes)
        }
      }}
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
      value={localMinutes}
      disabled={disabled}
      aria-label="Minutos"
      onFocus={() => { minuteFocused.current = true }}
      onChange={(e) => setLocalMinutes(e.target.value)}
      onBlur={() => { minuteFocused.current = false; commitMinutes() }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') { commitMinutes(); (e.target as HTMLInputElement).blur() }
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          e.preventDefault()
          const delta = e.key === 'ArrowUp' ? minuteStep : -minuteStep
          const cur = parseInt(localMinutes, 10)
          let next = (isNaN(cur) ? minutes : cur) + delta
          next = Math.round(next / minuteStep) * minuteStep
          if (next >= 60) next = 60 - minuteStep
          if (next < 0) next = 0
          setLocalMinutes(String(next).padStart(2, '0'))
          commit(hours * 60 + next)
        }
      }}
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
