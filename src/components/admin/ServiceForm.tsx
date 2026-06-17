import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import type { AdminService, AdminServiceCategory } from '@/lib/api/admin-catalog'

const labelClass = 'block text-xs uppercase tracking-wide text-gold mb-1'
const fieldClass =
  'w-full border border-gold/30 bg-cream px-3 py-2 font-sans text-sm text-charcoal outline-none transition-colors focus:border-gold'

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
  onSave: (data: {
    id: string
    nameEs: string
    nameEn: string
    durationMinutes: number
    categoryId: string | null
    bookableOnline: boolean
    sortOrder: number
  }) => void
  onCancel: () => void
  busy: boolean
}) {
  const [id, setId] = useState(initial?.id ?? '')
  const [nameEs, setNameEs] = useState(initial?.nameEs ?? '')
  const [nameEn, setNameEn] = useState(initial?.nameEn ?? '')
  const [durationMinutes, setDurationMinutes] = useState(initial?.durationMinutes ?? 30)
  const [formCategoryId, setFormCategoryId] = useState(initial?.categoryId ?? categoryId)
  const [bookableOnline, setBookableOnline] = useState(initial?.bookableOnline ?? true)
  const [sortOrder, setSortOrder] = useState(initial?.sortOrder ?? 0)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!nameEs.trim() || (mode === 'create' && !id.trim()) || !durationMinutes) return
    onSave({
      id: id.trim(),
      nameEs: nameEs.trim(),
      nameEn: nameEn.trim(),
      durationMinutes,
      categoryId: formCategoryId,
      bookableOnline,
      sortOrder,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {mode === 'create' && (
        <div>
          <label className={labelClass} htmlFor="svc-id">ID único</label>
          <input
            id="svc-id"
            required
            value={id}
            onChange={(e) => setId(e.target.value)}
            className={fieldClass}
            placeholder="ej: svc-nuevo-tratamiento"
          />
        </div>
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
            type="number"
            required
            min={1}
            value={durationMinutes}
            onChange={(e) => setDurationMinutes(Number(e.target.value))}
            className={fieldClass}
          />
        </div>
        <div className="flex-1">
          <label className={labelClass} htmlFor="svc-order">Orden</label>
          <input
            id="svc-order"
            type="number"
            value={sortOrder}
            onChange={(e) => setSortOrder(Number(e.target.value))}
            className={fieldClass}
          />
        </div>
      </div>
      <div>
        <label className={labelClass} htmlFor="svc-category">Categoría</label>
        <select
          id="svc-category"
          value={formCategoryId}
          onChange={(e) => setFormCategoryId(e.target.value)}
          className={fieldClass}
        >
          <option value="">Sin categoría</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.nameEs}</option>
          ))}
        </select>
      </div>
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
