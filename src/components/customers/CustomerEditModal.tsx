import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { updateCustomer, ApiError } from '@/lib/api'
import { formatPhoneDisplay } from '@/lib/phone'
import type { Customer } from '@/types/customers'
import { typography } from '@/styles/typography'

type CustomerFields = Pick<Customer, 'phone' | 'firstName' | 'lastName' | 'email' | 'notes'>

type Props = {
  open: boolean
  customer: CustomerFields | null
  adminToken: string
  onClose: () => void
  onSaved: (customer: CustomerFields) => void
}

function isValidEmail(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed) return true
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)
}

export function CustomerEditModal({
  open,
  customer,
  adminToken,
  onClose,
  onSaved,
}: Props) {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open || !customer) return
    setFirstName(customer.firstName)
    setLastName(customer.lastName)
    setEmail(customer.email ?? '')
    setNotes(customer.notes ?? '')
    setError('')
    setSaving(false)
  }, [open, customer])

  if (!open || !customer) return null

  const phone = customer.phone

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!firstName.trim()) {
      setError('Indica al menos el nombre')
      return
    }
    if (!isValidEmail(email)) {
      setError('El correo electrónico no es válido')
      return
    }

    setSaving(true)
    setError('')
    try {
      const { customer: updated } = await updateCustomer(adminToken, phone, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim() || null,
        notes: notes.trim() || null,
      })
      onSaved(updated)
      onClose()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo guardar los cambios')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex bg-charcoal/50 backdrop-blur-[2px] sm:items-center sm:justify-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="customer-edit-title"
      onClick={saving ? undefined : onClose}
    >
      <form
        className="flex h-dvh w-full max-w-lg flex-col overflow-hidden bg-cream shadow-2xl sm:h-auto sm:max-h-[min(90vh,40rem)] sm:border sm:border-gold/35"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => void handleSubmit(e)}
      >
        <header className="relative shrink-0 border-b border-gold/20 bg-gradient-to-br from-gold/8 via-cream to-cream px-5 py-4">
          <div className="pr-10">
            <p className={`${typography.caption} text-gold`}>Ficha de cliente</p>
            <h2 id="customer-edit-title" className={`${typography.h3} mt-0.5 text-charcoal`}>
              Editar datos
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="absolute right-4 top-4 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-gold/30 text-charcoal-muted transition-colors hover:border-gold hover:text-gold disabled:opacity-50"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5">
          <div className="rounded-lg border border-gold/25 bg-charcoal/[0.03] px-4 py-3">
            <p className={`${typography.label} mb-1`}>Teléfono</p>
            <p className="tabular-nums text-base font-medium text-charcoal">
              {formatPhoneDisplay(customer.phone)}
            </p>
            <p className={`${typography.caption} mt-1.5 text-charcoal-muted`}>
              Identificador del cliente — no se puede modificar
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Nombre"
              required
              autoComplete="given-name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              disabled={saving}
            />
            <Input
              label="Apellidos"
              autoComplete="family-name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              disabled={saving}
            />
          </div>

          <Input
            label="Correo electrónico"
            type="email"
            autoComplete="email"
            placeholder="opcional@ejemplo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={saving}
          />

          <Textarea
            label="Observaciones"
            placeholder="Preferencias, alergias, notas internas…"
            value={notes}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNotes(e.target.value)}
            disabled={saving}
            rows={4}
          />

          {error && (
            <p
              className="rounded border border-red-200 bg-red-50 px-3 py-2 text-center text-sm text-red-800"
              role="alert"
            >
              {error}
            </p>
          )}
        </div>

        <footer className="flex shrink-0 flex-col-reverse gap-2 border-t border-gold/15 bg-cream/95 px-5 py-4 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={saving}
            onClick={onClose}
            className="w-full sm:w-auto"
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            variant="solid"
            size="sm"
            disabled={saving}
            className="w-full sm:w-auto"
          >
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </Button>
        </footer>
      </form>
    </div>
  )
}
