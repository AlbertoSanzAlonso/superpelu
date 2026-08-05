import { useEffect, useId, useRef, useState } from 'react'

type Props = {
  value: string
  onChange: (value: string) => void
  /** Primera opción (p. ej. automática / encadenada). */
  emptyLabel?: string
  freeOptions: readonly string[]
  occupiedOptions?: readonly string[]
  /** Grupo adicional (p. ej. fuera de horario). */
  overHoursOptions?: readonly string[]
  className?: string
  disabled?: boolean
  /** Si true, bloquea el envío del form nativo mientras no haya hora. */
  required?: boolean
  /** Altura máxima del panel abierto. */
  maxMenuHeightClassName?: string
}

function optionButtonClass(selected: boolean, tone: 'default' | 'amber' = 'default'): string {
  const base = 'block w-full cursor-pointer px-3 py-1.5 text-left text-sm'
  if (tone === 'amber') {
    return `${base} text-amber-800 hover:bg-amber-50 ${selected ? 'bg-amber-50 font-medium' : ''}`
  }
  return `${base} hover:bg-gold/10 ${selected ? 'bg-gold/15 font-medium' : ''}`
}

/**
 * Desplegable de horas con panel scrollable (el select nativo no limita altura).
 */
export function ScrollableTimeSelect({
  value,
  onChange,
  emptyLabel,
  freeOptions,
  occupiedOptions = [],
  overHoursOptions = [],
  className = '',
  disabled = false,
  required = false,
  maxMenuHeightClassName = 'max-h-44',
}: Props) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const listId = useId()

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null
      if (target && rootRef.current && !rootRef.current.contains(target)) {
        setOpen(false)
      }
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('touchstart', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('touchstart', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  useEffect(() => {
    if (disabled) setOpen(false)
  }, [disabled])

  const displayLabel =
    value === ''
      ? (emptyLabel ?? 'Elegir hora')
      : overHoursOptions.includes(value) || occupiedOptions.includes(value)
        ? `⚠ ${value}`
        : value

  const pick = (next: string) => {
    onChange(next)
    setOpen(false)
  }

  return (
    <div ref={rootRef} className="relative">
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
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((prev) => !prev)}
        className={`${className} flex w-full cursor-pointer items-center justify-between gap-2 text-left disabled:cursor-not-allowed disabled:opacity-50`}
      >
        <span className="truncate">{displayLabel}</span>
        <span className="shrink-0 text-charcoal-muted" aria-hidden>
          ▾
        </span>
      </button>
      {open && !disabled && (
        <div
          id={listId}
          role="listbox"
          className={`absolute left-0 right-0 z-30 mt-1 overflow-y-auto border border-gold/30 bg-cream shadow-md scrollbar-premium ${maxMenuHeightClassName}`}
        >
          {emptyLabel != null && (
            <button
              type="button"
              role="option"
              aria-selected={value === ''}
              onClick={() => pick('')}
              className={optionButtonClass(value === '')}
            >
              {emptyLabel}
            </button>
          )}
          {freeOptions.map((slot) => (
            <button
              key={slot}
              type="button"
              role="option"
              aria-selected={value === slot}
              onClick={() => pick(slot)}
              className={optionButtonClass(value === slot)}
            >
              {slot}
            </button>
          ))}
          {overHoursOptions.length > 0 && (
            <>
              <div className="border-t border-gold/15 px-3 py-1 text-[10px] font-medium uppercase tracking-wide text-amber-800">
                Fuera del horario
              </div>
              {overHoursOptions.map((slot) => (
                <button
                  key={`over-${slot}`}
                  type="button"
                  role="option"
                  aria-selected={value === slot}
                  onClick={() => pick(slot)}
                  className={optionButtonClass(value === slot, 'amber')}
                >
                  ⚠ {slot}
                </button>
              ))}
            </>
          )}
          {occupiedOptions.length > 0 && (
            <>
              <div className="border-t border-gold/15 px-3 py-1 text-[10px] font-medium uppercase tracking-wide text-amber-800">
                Hora ocupada
              </div>
              {occupiedOptions.map((slot) => (
                <button
                  key={`occ-${slot}`}
                  type="button"
                  role="option"
                  aria-selected={value === slot}
                  onClick={() => pick(slot)}
                  className={optionButtonClass(value === slot, 'amber')}
                >
                  ⚠ {slot}
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}
