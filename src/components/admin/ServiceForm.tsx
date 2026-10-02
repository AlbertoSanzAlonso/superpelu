import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/Button'
import type { AdminService, AdminServiceCategory } from '@/lib/api/admin-catalog'
import {
  defaultBookingPattern,
  defaultColorSplitPattern,
  formatPatternSummary,
  isSegmentedPattern,
  normalizeBookingPattern,
  patternTotalSpanMinutes,
  validateBookingPattern,
  type ServiceBookingPattern,
  type ServiceBookingStep,
  type ServiceBookingWorkStep,
} from '@/lib/booking/servicePattern'
import {
  isHiddenFromPublicBooking,
  usesColorSplitBooking,
} from '@/lib/booking/occupancy'

const labelClass = 'block text-xs uppercase tracking-wide text-gold mb-1'
const fieldClass =
  'w-full border border-gold/30 bg-cream px-3 py-2 font-sans text-sm text-charcoal outline-none transition-colors focus:border-gold'
const miniFieldClass =
  'w-full border border-gold/30 bg-white px-2 py-1 font-sans text-xs text-charcoal outline-none focus:border-gold'

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
  if (initial && usesColorSplitBooking(initial.id)) {
    return defaultColorSplitPattern()
  }
  return defaultBookingPattern(initial?.durationMinutes ?? 30)
}

function StepRow({
  step,
  index,
  workOrdinal,
  onMinutesChange,
  onWorkNameChange,
  onReplaceableChange,
  onRemove,
  canRemove,
}: {
  step: ServiceBookingStep
  index: number
  workOrdinal: number
  onMinutesChange: (index: number, minutes: number) => void
  onWorkNameChange: (index: number, field: 'nameEs' | 'nameEn', value: string) => void
  onReplaceableChange: (index: number, checked: boolean) => void
  onRemove: (index: number) => void
  canRemove: boolean
}) {
  const isBreak = step.type === 'break'
  const work = step as ServiceBookingWorkStep

  if (isBreak) {
    return (
      <div className="flex items-center gap-2 rounded border border-gold/15 bg-gold/5 px-2 py-1.5">
        <span className="w-24 shrink-0 text-xs text-charcoal-muted">Descanso</span>
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
          aria-label="Minutos de descanso"
        />
        <span className="text-xs text-charcoal-muted">min</span>
        {canRemove && (
          <button
            type="button"
            className="ml-auto cursor-pointer text-xs text-charcoal-muted hover:text-red-600"
            onClick={() => onRemove(index)}
          >
            Quitar
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-2 rounded border border-gold/25 bg-cream px-2 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="w-24 shrink-0 text-xs text-charcoal-muted">
          Tramo {workOrdinal}
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
          aria-label={`Minutos del tramo ${workOrdinal}`}
        />
        <span className="text-xs text-charcoal-muted">min</span>
        {canRemove && (
          <button
            type="button"
            className="ml-auto cursor-pointer text-xs text-charcoal-muted hover:text-red-600"
            onClick={() => onRemove(index)}
          >
            Quitar
          </button>
        )}
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <label className="mb-0.5 block text-[10px] uppercase tracking-wide text-charcoal-muted">
            Nombre tramo (ES)
          </label>
          <input
            type="text"
            value={work.nameEs ?? ''}
            onChange={(e) => onWorkNameChange(index, 'nameEs', e.target.value)}
            placeholder={`Tramo ${workOrdinal}`}
            className={miniFieldClass}
          />
        </div>
        <div>
          <label className="mb-0.5 block text-[10px] uppercase tracking-wide text-charcoal-muted">
            Nombre tramo (EN)
          </label>
          <input
            type="text"
            value={work.nameEn ?? ''}
            onChange={(e) => onWorkNameChange(index, 'nameEn', e.target.value)}
            placeholder={`Segment ${workOrdinal}`}
            className={miniFieldClass}
          />
        </div>
      </div>
      <label className="flex items-start gap-2">
        <input
          type="checkbox"
          checked={work.replaceableByNext === true}
          onChange={(e) => onReplaceableChange(index, e.target.checked)}
          className="mt-0.5 h-4 w-4 accent-gold"
        />
        <span className="text-xs text-charcoal">
          Sustituible por el siguiente tratamiento
          <span className="mt-0.5 block text-charcoal-muted">
            Si el cliente reserva otro servicio de peluquería después, este tramo
            no se crea y ese servicio ocupa el hueco (como el aclarado del color).
          </span>
        </span>
      </label>
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
  const isInternalCompanion = Boolean(initial && isHiddenFromPublicBooking(initial.id))

  const updateStepMinutes = (index: number, minutes: number) => {
    setPattern((current) =>
      current.map((step, i) => (i === index ? { ...step, minutes } : step)),
    )
    setPatternError('')
  }

  const updateWorkName = (index: number, field: 'nameEs' | 'nameEn', value: string) => {
    setPattern((current) =>
      current.map((step, i) => {
        if (i !== index || step.type !== 'work') return step
        return { ...step, [field]: value }
      }),
    )
  }

  const updateReplaceable = (index: number, checked: boolean) => {
    setPattern((current) =>
      current.map((step, i) => {
        if (step.type !== 'work') return step
        if (i === index) {
          const next = { ...step }
          if (checked) next.replaceableByNext = true
          else delete next.replaceableByNext
          return next
        }
        if (!checked) return step
        const cleared = { ...step }
        delete cleared.replaceableByNext
        return cleared
      }),
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
      bookableOnline: isInternalCompanion ? false : bookableOnline,
      bookingPattern,
    })
  }

  let workOrdinal = 0

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
          En la agenda solo se bloquean los tramos de trabajo; los descansos quedan
          libres. Con varios tramos de trabajo se crean bloques enlazados (como color +
          aclarado).
        </p>
        <div className="space-y-2">
          {pattern.map((step, index) => {
            if (step.type === 'work') workOrdinal += 1
            return (
              <StepRow
                key={`${step.type}-${index}`}
                step={step}
                index={index}
                workOrdinal={workOrdinal}
                onMinutesChange={updateStepMinutes}
                onWorkNameChange={updateWorkName}
                onReplaceableChange={updateReplaceable}
                onRemove={removeStep}
                canRemove={pattern.length > 1}
              />
            )
          })}
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
      <div className="space-y-1.5">
        {isInternalCompanion ? (
          <p className="text-xs text-charcoal-muted">
            Pieza interna legacy de coloración. Las reservas nuevas usan el tramo
            «Aclarado» del propio tratamiento de color; este servicio se mantiene por
            citas antiguas.
          </p>
        ) : (
          <>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={bookableOnline}
                onChange={(e) => setBookableOnline(e.target.checked)}
                className="h-4 w-4 accent-gold"
              />
              <span className="text-sm text-charcoal">Reservable online</span>
            </label>
            <p className="text-xs text-charcoal-muted">
              Si se desmarca, el cliente ve el tratamiento en la reserva pero solo puede
              llamar o escribir por WhatsApp (igual que mechas / balayage). En agenda sí
              se puede citar.
            </p>
          </>
        )}
      </div>
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
