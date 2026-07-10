import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import type { AdminService, AdminServiceCategory } from '@/lib/api/admin-catalog'

const labelClass = 'block text-xs uppercase tracking-wide text-gold mb-1'
const fieldClass =
  'w-full border border-gold/30 bg-cream px-3 py-2 font-sans text-sm text-charcoal outline-none transition-colors focus:border-gold'

export type ServiceFormData = {
  nameEs: string
  nameEn: string
  durationMinutes: number
  categoryId: string | null
  bookableOnline: boolean
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
  const [durationText, setDurationText] = useState(String(initial?.durationMinutes ?? 30))
  const [formCategoryId, setFormCategoryId] = useState(initial?.categoryId ?? categoryId)
  const [bookableOnline, setBookableOnline] = useState(initial?.bookableOnline ?? true)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const durationMinutes = Number(durationText)
    if (!nameEs.trim() || !Number.isFinite(durationMinutes) || durationMinutes < 1) return
    onSave({
      nameEs: nameEs.trim(),
      nameEn: nameEn.trim(),
      durationMinutes,
      categoryId: formCategoryId || null,
      bookableOnline,
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
      <div className="flex gap-4">
        <div className="flex-1">
          <label className={labelClass} htmlFor="svc-duration">Duración (min)</label>
          <input
            id="svc-duration"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            required
            value={durationText}
            onChange={(e) => setDurationText(e.target.value.replace(/\D/g, ''))}
            className={fieldClass}
            autoComplete="off"
          />
        </div>
        <div className="flex-1">
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
