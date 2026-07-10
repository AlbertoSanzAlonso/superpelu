import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/Button'
import type { AdminService, AdminServiceCategory } from '@/lib/api/admin-catalog'
import {
  defaultBookingPattern,
  formatPatternSummary,
  isSegmentedPattern,
  normalizeBookingPattern,
  patternTotalSpanMinutes,
  validateBookingPattern,
  type ServiceBookingPattern,
  type ServiceBookingStep,
} from '@/lib/booking/servicePattern'

const labelClass = 'block text-xs uppercase tracking-wide text-gold mb-1'
const fieldClass =
  'w-full border border-gold/30 bg-cream px-3 py-2 font-sans text-sm text-charcoal outline-none transition-colors focus:border-gold'

export type ServiceFormData = {
  nameEs: string
  nameEn: string
  durationMinutes: number
  categoryId: string | null
  bookableOnline: boolean
  bookingPattern: ServiceBookingPattern | null
}

function patternFromInitial(initial: AdminService | null): ServiceBookingPattern {
  if (initial?.bookingPattern && isSegmentedPattern(initial.bookingPattern)) {
    return initial.bookingPattern
  }
  return defaultBookingPattern(initial?.durationMinutes ?? 30)
}

function StepRow({
  step,
  index,
  onMinutesChange,
  onRemove,
  canRemove,
}: {
  step: ServiceBookingStep
  index: number
  onMinutesChange: (index: number, minutes: number) => void
  onRemove: (index: number) => void
  canRemove: boolean
}) {
  const isBreak = step.type === 'break'
  return (
    <div
      className={`flex items-center gap-2 rounded border px-2 py-1.5 ${
        isBreak ? 'border-gold/15 bg-gold/5' : 'border-gold/25 bg-cream'
      }`}
    >
      <span className="w-24 shrink-0 text-xs text-charcoal-muted">
        {isBreak ? 'Descanso' : `Tramo ${Math.floor(index / 2) + 1}`}
      </span>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={String(step.minutes)}
        onChange={(e) => {
          const value = Number(e.target.value.replace(/\D/g, ''))
          if (Number.isFinite(value) && value > 0) onMinutesChange(index, value)
        }}
        className="w-16 border border-gold/30 bg-white px-2 py-1 text-sm tabular-nums"
        aria-label={isBreak ? 'Minutos de descanso' : 'Minutos del tramo'}
      />
      <span className="text-xs text-charcoal-muted">min</span>
      {canRemove && (
        <button
          type="button"
          className="ml-auto text-xs text-charcoal-muted hover:text-red-600"
          onClick={() => onRemove(index)}
        >
          Quitar
        </button>
      )}
    </div>
  )
}

export function ServiceForm({
  mode,
  initial,
  categoryId,
  categories,
  onSave,
  onCancel,
  busy,
}: {
  mode: 'create' | 'edit'
  initial: AdminService | null
  categoryId: string
  categories: AdminServiceCategory[]
  onSave: (data: ServiceFormData) => void
  onCancel: () => void
  busy: boolean
}) {
  const [nameEs, setNameEs] = useState(initial?.nameEs ?? '')
  const [nameEn, setNameEn] = useState(initial?.nameEn ?? '')
  const [formCategoryId, setFormCategoryId] = useState(initial?.categoryId ?? categoryId)
  const [bookableOnline, setBookableOnline] = useState(initial?.bookableOnline ?? true)
  const [pattern, setPattern] = useState<ServiceBookingPattern>(() => patternFromInitial(initial))
  const [patternError, setPatternError] = useState('')

  const totalMinutes = useMemo(() => patternTotalSpanMinutes(pattern), [pattern])
  const segmented = isSegmentedPattern(pattern)

  const updateStepMinutes = (index: number, minutes: number) => {
    setPattern((current) =>
      current.map((step, i) => (i === index ? { ...step, minutes } : step)),
    )
    setPatternError('')
  }

  const removeStep = (index: number) => {
    setPattern((current) => {
      if (current.length <= 1) return current
      const next = current.filter((_, i) => i !== index)
      if (next.length === 1) return next
      if (next[0].type !== 'work') next.shift()
      if (next[next.length - 1].type !== 'work') next.pop()
      return next.length > 0 ? next : defaultBookingPattern(30)
    })
    setPatternError('')
  }

  const addWorkSegment = () => {
    setPattern((current) => {
      if (current.length === 0) return defaultBookingPattern(30)
      const last = current[current.length - 1]
      if (last.type === 'break') {
        return [...current, { type: 'work', minutes: 30 }]
      }
      return [...current, { type: 'break', minutes: 30 }, { type: 'work', minutes: 30 }]
    })
    setPatternError('')
  }

  const addBreak = () => {
    setPattern((current) => {
      if (current.length === 0) return defaultBookingPattern(30)
      const last = current[current.length - 1]
      if (last.type === 'work') {
        return [...current, { type: 'break', minutes: 30 }]
      }
      return current
    })
    setPatternError('')
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!nameEs.trim()) return
    const validationError = validateBookingPattern(pattern)
    if (validationError) {
      setPatternError(validationError)
      return
    }
    const bookingPattern = normalizeBookingPattern(pattern)
    const durationMinutes = bookingPattern
      ? patternTotalSpanMinutes(bookingPattern)
      : pattern[0]?.minutes ?? 30
    onSave({
      nameEs: nameEs.trim(),
      nameEn: nameEn.trim(),
      durationMinutes,
      categoryId: formCategoryId || null,
      bookableOnline,
      bookingPattern,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {mode === 'edit' && initial && (
        <p className="text-xs text-charcoal-muted">
          ID interno: <span className="font-mono text-charcoal">{initial.id}</span>
        </p>
      )}
      <div>
        <label className={labelClass} htmlFor="svc-es">Nombre (ES)</label>
        <input
          id="svc-es"
          required
          value={nameEs}
          onChange={(e) => setNameEs(e.target.value)}
          className={fieldClass}
        />
      </div>
      <div>
        <label className={labelClass} htmlFor="svc-en">Nombre (EN)</label>
        <input
          id="svc-en"
          value={nameEn}
          onChange={(e) => setNameEn(e.target.value)}
          className={fieldClass}
        />
      </div>
      <div>
        <label className={labelClass} htmlFor="svc-category">Categoría</label>
        <select
          id="svc-category"
          value={formCategoryId}
          onChange={(e) => setFormCategoryId(e.target.value)}
          className={fieldClass}
          required={categories.length > 0}
        >
          <option value="">{categories.length > 0 ? 'Elige categoría…' : 'Sin categoría'}</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.nameEs}</option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className={labelClass}>Duración por tramos</p>
          <p className="text-xs tabular-nums text-charcoal-muted">
            Total: {totalMinutes} min
            {segmented && (
              <span className="ml-1">({formatPatternSummary(pattern)})</span>
            )}
          </p>
        </div>
        <p className="text-xs text-charcoal-muted">
          En la agenda solo se bloquean los tramos de trabajo; los descansos quedan libres para otras citas.
        </p>
        <div className="space-y-1.5">
          {pattern.map((step, index) => (
            <StepRow
              key={`${step.type}-${index}`}
              step={step}
              index={index}
              onMinutesChange={updateStepMinutes}
              onRemove={removeStep}
              canRemove={pattern.length > 1}
            />
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={addWorkSegment}>
            + Añadir tramo
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addBreak}
            disabled={pattern.length > 0 && pattern[pattern.length - 1].type === 'break'}
          >
            + Añadir descanso
          </Button>
        </div>
        {patternError && (
          <p className="text-xs text-red-700" role="alert">{patternError}</p>
        )}
      </div>

      <p className="text-xs text-charcoal-muted">
        El orden dentro de cada categoría se ajusta en el listado con las flechas arriba/abajo.
      </p>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={bookableOnline}
          onChange={(e) => setBookableOnline(e.target.checked)}
          className="h-4 w-4 accent-gold"
        />
        <span className="text-sm text-charcoal">Reservable online</span>
      </label>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" variant="solid" size="sm" disabled={busy}>
          {mode === 'create' ? 'Crear' : 'Guardar'}
        </Button>
      </div>
    </form>
  )
}
