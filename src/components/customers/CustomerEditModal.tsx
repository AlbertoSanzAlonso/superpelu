import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Input, Textarea } from '@/components/ui/Input'
import { CustomerLocaleSelect } from '@/components/customers/CustomerLocaleSelect'
import { ForeignPhoneLocaleConfirmDialog } from '@/components/customers/ForeignPhoneLocaleConfirmDialog'
import { updateCustomer, createCustomer, deleteCustomer, ApiError } from '@/lib/api'
import { normalizeLocale, type Locale } from '@/i18n/types'
import { isGuestCustomerPhone } from '@/lib/customer/guestPhone'
import { formatPhoneDisplay, isValidPhone, normalizePhone } from '@/lib/customer/phone'
import { shouldAskForeignPhoneLocale } from '@/hooks/useForeignPhoneLocalePrompt'
import type { Customer, CustomerMember } from '@/types/customers'
import { typography } from '@/styles/typography'

type CustomerFields = Pick<
  Customer,
  | 'phone'
  | 'firstName'
  | 'lastName'
  | 'email'
  | 'notes'
  | 'locale'
  | 'birthdate'
  | 'lastUpdateSource'
  | 'updatedAt'
  | 'members'
>

type Props = {
  open: boolean
  mode?: 'edit' | 'create'
  customer: CustomerFields | null
  adminToken: string
  onClose: () => void
  onSaved: (customer: CustomerFields) => void
  onDeleted?: (phone: string) => void
}

function isValidEmail(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed) return true
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)
}

type MemberDraft = {
  key: string
  id?: string
  firstName: string
  lastName: string
}

function draftsFromMembers(members: CustomerMember[] | undefined): MemberDraft[] {
  return (members ?? []).map((member) => ({
    key: member.id,
    id: member.id,
    firstName: member.firstName,
    lastName: member.lastName,
  }))
}

function phoneConflictMessage(name: string, creating: boolean): string {
  const who = name.trim() || 'otro cliente'
  if (creating) {
    return `Ese teléfono ya pertenece a ${who}. Si sustituyes, los datos de este formulario reemplazan su ficha. Las citas que ya tiene se conservan.`
  }
  return `Ese teléfono ya pertenece a ${who}. Si sustituyes, esta ficha pasa a ese número y se elimina la de ${who}. Las citas de las dos quedan juntas en ese teléfono.`
}

export function CustomerEditModal({
  open,
  mode = 'edit',
  customer,
  adminToken,
  onClose,
  onSaved,
  onDeleted,
}: Props) {
  const isCreate = mode === 'create'
  const [phoneInput, setPhoneInput] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [notes, setNotes] = useState('')
  const [birthdate, setBirthdate] = useState('')
  const [locale, setLocale] = useState<Locale>('es')
  const [members, setMembers] = useState<MemberDraft[]>([])
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [foreignPhonePromptOpen, setForeignPhonePromptOpen] = useState(false)
  const [phoneConflictOpen, setPhoneConflictOpen] = useState(false)
  const [phoneConflictName, setPhoneConflictName] = useState('')
  const [error, setError] = useState('')
  const backdropPressed = useRef(false)

  useEffect(() => {
    if (!open) return
    if (isCreate) {
      setPhoneInput('')
      setFirstName('')
      setLastName('')
      setEmail('')
      setNotes('')
      setBirthdate('')
      setLocale('es')
      setMembers([])
    } else if (customer) {
      setPhoneInput(formatPhoneDisplay(customer.phone))
      setFirstName(customer.firstName)
      setLastName(customer.lastName)
      setEmail(customer.email ?? '')
      setNotes(customer.notes ?? '')
      setBirthdate(customer.birthdate ?? '')
      setLocale(normalizeLocale(customer.locale))
      setMembers(draftsFromMembers(customer.members))
    }
    setError('')
    setSaving(false)
    setDeleting(false)
    setDeleteConfirmOpen(false)
    setForeignPhonePromptOpen(false)
    setPhoneConflictOpen(false)
    setPhoneConflictName('')
  }, [open, customer, isCreate])

  if (!open || (!isCreate && !customer)) return null

  const phone = isCreate ? phoneInput : customer!.phone
  const busy = saving || deleting
  const phoneChanged =
    isCreate || normalizePhone(phoneInput) !== normalizePhone(customer?.phone ?? '')

  function validateForm(): boolean {
    if (!firstName.trim()) {
      setError('Indica al menos el nombre')
      return false
    }
    if (!isValidEmail(email)) {
      setError('El correo electrónico no es válido')
      return false
    }
    if (!isValidPhone(phoneInput) || isGuestCustomerPhone(phoneInput)) {
      setError('Indica un teléfono válido')
      return false
    }
    if (members.some((member) => !member.firstName.trim() && (member.lastName.trim() || member.id))) {
      setError('Cada miembro necesita al menos el nombre')
      return false
    }
    return true
  }

  async function persist(localeOverride?: Locale, replaceExisting = false) {
    const localeToSave = localeOverride ?? locale
    if (localeOverride) setLocale(localeOverride)

    setSaving(true)
    setError('')
    try {
      const fields = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim() || null,
        notes: notes.trim() || null,
        birthdate: birthdate.trim() || null,
        locale: localeToSave,
        replaceExisting,
        members: members
          .filter((member) => member.firstName.trim())
          .map((member) => ({
            id: member.id,
            firstName: member.firstName.trim(),
            lastName: member.lastName.trim(),
          })),
      }
      if (isCreate) {
        const { customer: created } = await createCustomer(adminToken, {
          phone: phoneInput.trim(),
          ...fields,
        })
        onSaved(created)
      } else {
        const { customer: updated } = await updateCustomer(adminToken, phone, {
          phone: phoneInput.trim(),
          ...fields,
        })
        onSaved(updated)
      }
      setPhoneConflictOpen(false)
      onClose()
    } catch (err) {
      if (!replaceExisting && err instanceof ApiError && err.code === 'TELEFONO_EN_USO') {
        setPhoneConflictName(err.existingCustomerName?.trim() ?? '')
        setPhoneConflictOpen(true)
        return
      }
      setPhoneConflictOpen(false)
      setError(err instanceof ApiError ? err.message : 'No se pudo guardar los cambios')
    } finally {
      setSaving(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validateForm()) return

    if (phoneChanged && shouldAskForeignPhoneLocale(phoneInput, locale)) {
      setForeignPhonePromptOpen(true)
      return
    }

    await persist()
  }

  async function handleDelete() {
    setDeleting(true)
    setError('')
    try {
      await deleteCustomer(adminToken, phone)
      setDeleteConfirmOpen(false)
      onDeleted?.(phone)
      onClose()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo eliminar el cliente')
      setDeleteConfirmOpen(false)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <div
        className="fixed inset-0 z-[60] flex bg-charcoal/50 backdrop-blur-[2px] sm:items-center sm:justify-center sm:p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="customer-edit-title"
        onMouseDown={(e) => {
          backdropPressed.current = e.target === e.currentTarget
        }}
        onMouseUp={(e) => {
          const releaseOnBackdrop = e.target === e.currentTarget
          const close = backdropPressed.current && releaseOnBackdrop
          backdropPressed.current = false
          if (!busy && close) onClose()
        }}
      >
        <form
          className="flex h-dvh w-full max-w-lg flex-col overflow-hidden bg-cream shadow-2xl sm:h-auto sm:max-h-[min(92vh,52rem)] sm:border sm:border-gold/35"
          onClick={(e) => e.stopPropagation()}
          onSubmit={(e) => void handleSubmit(e)}
        >
          <header className="relative shrink-0 border-b border-gold/20 bg-gradient-to-br from-gold/8 via-cream to-cream px-5 py-4">
            <div className="pr-10">
              <p className={`${typography.caption} text-gold`}>Ficha de cliente</p>
              <h2 id="customer-edit-title" className={`${typography.h3} mt-0.5 text-charcoal`}>
                {isCreate ? 'Nuevo cliente' : 'Editar datos'}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="absolute right-4 top-4 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-gold/30 text-charcoal-muted transition-colors hover:border-gold hover:text-gold disabled:opacity-50"
              aria-label="Cerrar"
            >
              ✕
            </button>
          </header>

          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5">
            <Input
              label="Teléfono"
              required
              type="tel"
              autoComplete="tel"
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
              disabled={busy}
              placeholder="+34…"
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Nombre"
                required
                autoComplete="given-name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                disabled={busy}
              />
              <Input
                label="Apellidos"
                autoComplete="family-name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                disabled={busy}
              />
            </div>

            <Input
              label="Correo electrónico"
              type="email"
              autoComplete="email"
              placeholder="opcional@ejemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={busy}
            />

            <Input
              label="Fecha de nacimiento"
              type="date"
              value={birthdate}
              onChange={(e) => setBirthdate(e.target.value)}
              disabled={busy}
            />

            <Textarea
              label="Observaciones del cliente"
              placeholder="Preferencias, alergias, notas internas…"
              value={notes}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNotes(e.target.value)}
              disabled={busy}
              rows={4}
            />

            <CustomerLocaleSelect value={locale} onChange={setLocale} disabled={busy} />

            <fieldset className="space-y-3" disabled={busy}>
              <legend className={typography.label}>Miembros</legend>
              <p className={typography.caption}>
                Otras personas que usan este mismo teléfono. El titular de la ficha sigue siendo el
                usuario principal.
              </p>
              {members.length === 0 && (
                <p className={`${typography.caption} text-charcoal-muted`}>
                  Nadie más está asociado a este teléfono.
                </p>
              )}
              {members.map((member) => (
                <div key={member.key} className="space-y-2 rounded border border-gold/20 p-3">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Input
                      label="Nombre"
                      value={member.firstName}
                      onChange={(e) =>
                        setMembers((rows) =>
                          rows.map((row) =>
                            row.key === member.key ? { ...row, firstName: e.target.value } : row,
                          ),
                        )
                      }
                      disabled={busy}
                    />
                    <Input
                      label="Apellidos"
                      value={member.lastName}
                      onChange={(e) =>
                        setMembers((rows) =>
                          rows.map((row) =>
                            row.key === member.key ? { ...row, lastName: e.target.value } : row,
                          ),
                        )
                      }
                      disabled={busy}
                    />
                  </div>
                  <button
                    type="button"
                    className="ui-rounded cursor-pointer border border-gold/30 px-3 py-1.5 text-sm text-charcoal-muted hover:border-red-300 hover:text-red-800 focus:outline-none focus:ring-2 focus:ring-gold/40"
                    onClick={() =>
                      setMembers((rows) => rows.filter((row) => row.key !== member.key))
                    }
                  >
                    Quitar
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="ui-rounded cursor-pointer border border-dashed border-gold/40 px-3 py-2 text-sm text-gold hover:border-gold hover:bg-gold/5 focus:outline-none focus:ring-2 focus:ring-gold/40"
                onClick={() =>
                  setMembers((rows) => [
                    ...rows,
                    { key: crypto.randomUUID(), firstName: '', lastName: '' },
                  ])
                }
              >
                Añadir miembro
              </button>
            </fieldset>

            {error && (
              <p
                className="rounded border border-red-200 bg-red-50 px-3 py-2 text-center text-sm text-red-800"
                role="alert"
              >
                {error}
              </p>
            )}
          </div>

          <footer className="flex shrink-0 flex-col-reverse gap-2 border-t border-gold/15 bg-cream/95 px-5 py-4 sm:flex-row sm:flex-wrap sm:justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={onClose}
              className="w-full sm:w-auto"
            >
              Cancelar
            </Button>
            {onDeleted && !isCreate && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => setDeleteConfirmOpen(true)}
                className="w-full border-red-300 text-red-800 hover:bg-red-50 sm:w-auto"
              >
                {deleting ? 'Eliminando…' : 'Eliminar cliente'}
              </Button>
            )}
            <Button
              type="submit"
              variant="solid"
              size="sm"
              disabled={busy}
              className="w-full sm:w-auto"
            >
              {saving ? 'Guardando…' : isCreate ? 'Crear cliente' : 'Guardar cambios'}
            </Button>
          </footer>
        </form>
      </div>

      <ConfirmDialog
        open={deleteConfirmOpen}
        title="¿Eliminar este cliente?"
        message="Se quitará la ficha del listado de clientes. Las citas ya registradas se conservan en la agenda."
        confirmLabel="Eliminar cliente"
        cancelLabel="Volver"
        destructive
        busy={deleting}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={handleDelete}
      />

      <ConfirmDialog
        open={phoneConflictOpen}
        title="Ese teléfono ya existe"
        message={phoneConflictMessage(phoneConflictName, isCreate)}
        confirmLabel="Sustituir"
        cancelLabel="Cancelar"
        destructive
        busy={saving}
        onClose={() => {
          if (!saving) setPhoneConflictOpen(false)
        }}
        onConfirm={() => void persist(undefined, true)}
      />

      <ForeignPhoneLocaleConfirmDialog
        open={foreignPhonePromptOpen}
        onAccept={() => {
          setForeignPhonePromptOpen(false)
          void persist('en')
        }}
        onDecline={() => {
          setForeignPhonePromptOpen(false)
          void persist('es')
        }}
      />
    </>
  )
}
