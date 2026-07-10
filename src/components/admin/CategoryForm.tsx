import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import type { AdminServiceCategory } from '@/lib/api/admin-catalog'

const labelClass = 'block text-xs uppercase tracking-wide text-gold mb-1'
const fieldClass =
  'w-full border border-gold/30 bg-cream px-3 py-2 font-sans text-sm text-charcoal outline-none transition-colors focus:border-gold'

export type CategoryFormData = {
  id: string
  nameEs: string
  nameEn: string
}

export function CategoryForm({
  mode,
  initial,
  onSave,
  onCancel,
  busy,
}: {
  mode: 'create' | 'edit'
  initial: AdminServiceCategory | null
  onSave: (data: CategoryFormData) => void
  onCancel: () => void
  busy: boolean
}) {
  const [id, setId] = useState(initial?.id ?? '')
  const [nameEs, setNameEs] = useState(initial?.nameEs ?? '')
  const [nameEn, setNameEn] = useState(initial?.nameEn ?? '')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!nameEs.trim() || (mode === 'create' && !id.trim())) return
    onSave({
      id: id.trim(),
      nameEs: nameEs.trim(),
      nameEn: nameEn.trim(),
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {mode === 'create' && (
        <div>
          <label className={labelClass} htmlFor="cat-id">ID único</label>
          <input
            id="cat-id"
            required
            value={id}
            onChange={(e) => setId(e.target.value)}
            className={fieldClass}
            placeholder="ej: nuevo-servicio"
          />
        </div>
      )}
      <div>
        <label className={labelClass} htmlFor="cat-es">Nombre (ES)</label>
        <input
          id="cat-es"
          required
          value={nameEs}
          onChange={(e) => setNameEs(e.target.value)}
          className={fieldClass}
        />
      </div>
      <div>
        <label className={labelClass} htmlFor="cat-en">Nombre (EN)</label>
        <input
          id="cat-en"
          value={nameEn}
          onChange={(e) => setNameEn(e.target.value)}
          className={fieldClass}
        />
      </div>
      <p className="text-xs text-charcoal-muted">
        El orden de las categorías se ajusta en el listado con las flechas arriba/abajo.
      </p>
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
