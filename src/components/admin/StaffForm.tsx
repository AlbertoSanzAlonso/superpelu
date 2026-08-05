import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import type { AdminStaffMember } from '@/lib/api/admin'

const labelClass = 'block text-xs uppercase tracking-wide text-gold mb-1'
const fieldClass =
  'w-full border border-gold/30 bg-cream px-3 py-2 font-sans text-sm text-charcoal outline-none transition-colors focus:border-gold'

export type StaffCategoryOption = {
  id: string
  nameEs: string
}

export function StaffForm({
  mode,
  initial,
  categories,
  onSave,
  onCancel,
  busy,
}: {
  mode: 'create' | 'edit'
  initial: AdminStaffMember | null
  categories: StaffCategoryOption[]
  onSave: (data: {
    name: string
    role: string | null
    phone: string | null
    email: string | null
    categoryIds: string[]
  }) => void
  onCancel: () => void
  busy: boolean
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [role, setRole] = useState(initial?.role ?? 'Profesional')
  const [phone, setPhone] = useState(initial?.phone ?? '')
  const [email, setEmail] = useState(initial?.email ?? '')
  const [categoryIds, setCategoryIds] = useState<string[]>(() => {
    if (initial?.categoryIds?.length) return [...initial.categoryIds]
    if (mode === 'create') return categories.map((c) => c.id)
    return []
  })

  const toggleCategory = (id: string) => {
    setCategoryIds((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    )
  }

  const selectAll = () => setCategoryIds(categories.map((c) => c.id))
  const selectNone = () => setCategoryIds([])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    onSave({
      name: name.trim(),
      role: role.trim() || null,
      phone: phone.trim() || null,
      email: email.trim() || null,
      categoryIds,
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
        <label className={labelClass} htmlFor="sf-name">Nombre</label>
        <input
          id="sf-name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={fieldClass}
        />
      </div>
      <div>
        <label className={labelClass} htmlFor="sf-role">Rol</label>
        <input
          id="sf-role"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className={fieldClass}
        />
      </div>
      <div>
        <label className={labelClass} htmlFor="sf-phone">Teléfono</label>
        <input
          id="sf-phone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className={fieldClass}
        />
      </div>
      <div>
        <label className={labelClass} htmlFor="sf-email">Email</label>
        <input
          id="sf-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={fieldClass}
        />
      </div>

      <fieldset>
        <legend className={labelClass}>Categorías de tratamiento</legend>
        <p className="mb-2 text-xs text-charcoal-muted">
          Solo aparecerá en reserva para tratamientos de estas categorías.
        </p>
        <div className="mb-2 flex gap-2">
          <button
            type="button"
            onClick={selectAll}
            className="cursor-pointer text-xs text-gold underline-offset-2 hover:underline"
          >
            Todas
          </button>
          <button
            type="button"
            onClick={selectNone}
            className="cursor-pointer text-xs text-gold underline-offset-2 hover:underline"
          >
            Ninguna
          </button>
        </div>
        <div className="max-h-48 space-y-1.5 overflow-y-auto border border-gold/20 bg-cream/50 p-2">
          {categories.length === 0 ? (
            <p className="text-xs text-charcoal-muted">No hay categorías activas.</p>
          ) : (
            categories.map((cat) => {
              const checked = categoryIds.includes(cat.id)
              return (
                <label
                  key={cat.id}
                  className="flex cursor-pointer items-start gap-2 px-1 py-0.5 text-sm text-charcoal hover:bg-gold/5"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleCategory(cat.id)}
                    className="mt-0.5 cursor-pointer accent-[var(--color-gold,#b8963e)]"
                  />
                  <span className="leading-snug">{cat.nameEs}</span>
                </label>
              )
            })
          )}
        </div>
      </fieldset>

      <p className="text-xs text-charcoal-muted">
        El orden en el listado se ajusta con las flechas arriba/abajo.
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
