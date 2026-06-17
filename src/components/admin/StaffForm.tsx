import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import type { AdminStaffMember } from '@/lib/api/admin'

const labelClass = 'block text-xs uppercase tracking-wide text-gold mb-1'
const fieldClass =
  'w-full border border-gold/30 bg-cream px-3 py-2 font-sans text-sm text-charcoal outline-none transition-colors focus:border-gold'

export function StaffForm({
  mode,
  initial,
  onSave,
  onCancel,
  busy,
}: {
  mode: 'create' | 'edit'
  initial: AdminStaffMember | null
  onSave: (data: {
    id: string
    name: string
    role: string | null
    phone: string | null
    email: string | null
    password: string
    sortOrder: number
  }) => void
  onCancel: () => void
  busy: boolean
}) {
  const [id, setId] = useState(initial?.id ?? '')
  const [name, setName] = useState(initial?.name ?? '')
  const [role, setRole] = useState(initial?.role ?? 'Profesional')
  const [phone, setPhone] = useState(initial?.phone ?? '')
  const [email, setEmail] = useState(initial?.email ?? '')
  const [password, setPassword] = useState('')
  const [sortOrder, setSortOrder] = useState(initial?.sortOrder ?? 0)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || (mode === 'create' && (!id.trim() || !password.trim()))) return
    onSave({
      id: id.trim(),
      name: name.trim(),
      role: role.trim() || null,
      phone: phone.trim() || null,
      email: email.trim() || null,
      password: mode === 'create' ? password : password || '',
      sortOrder,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {mode === 'create' && (
        <div>
          <label className={labelClass} htmlFor="sf-id">ID único</label>
          <input
            id="sf-id"
            required
            value={id}
            onChange={(e) => setId(e.target.value)}
            className={fieldClass}
            placeholder="ej: nombre-apellido"
          />
        </div>
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
      <div>
        <label className={labelClass} htmlFor="sf-password">
          {mode === 'create' ? 'Contraseña' : 'Nueva contraseña (dejar vacío para mantener)'}
        </label>
        <input
          id="sf-password"
          type="password"
          required={mode === 'create'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={fieldClass}
        />
      </div>
      <div>
        <label className={labelClass} htmlFor="sf-order">Orden</label>
        <input
          id="sf-order"
          type="number"
          value={sortOrder}
          onChange={(e) => setSortOrder(Number(e.target.value))}
          className={fieldClass}
        />
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
