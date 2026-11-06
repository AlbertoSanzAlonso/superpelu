import { useEffect, useId, useRef, useState } from 'react'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Input } from '@/components/ui/Input'
import {
  fetchPendingMemberAppointments,
  removeCustomerMember,
  deleteCustomerMember,
  type PendingMemberAppointment,
} from '@/lib/api/admin'
import { ApiError } from '@/lib/api/request'
import { formatDisplayDate } from '@/lib/core/dates'
import { formatCustomerDisplayName } from '@/lib/customer/name'
import { typography } from '@/styles/typography'

export type CustomerMemberDraft = {
  key: string
  id?: string
  firstName: string
  lastName: string
}

type Props = {
  members: CustomerMemberDraft[]
  onChange: (members: CustomerMemberDraft[]) => void
  titularName: string
  /** Teléfono ya guardado. Sin él, los miembros nuevos solo viven en el formulario. */
  phone?: string
  adminToken?: string
  disabled?: boolean
}

export function CustomerMembersField({
  members,
  onChange,
  titularName,
  phone = '',
  adminToken,
  disabled = false,
}: Props) {
  const [open, setOpen] = useState(false)
  const [adding, setAdding] = useState(false)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<CustomerMemberDraft | null>(null)
  const [pendingAppointments, setPendingAppointments] = useState<PendingMemberAppointment[] | null>(
    null,
  )
  const [targetMemberId, setTargetMemberId] = useState('')
  const menuRef = useRef<HTMLDivElement>(null)
  const listId = useId()
  const editing = members.find((member) => member.key === editingKey) ?? null
  const otherMembers = members.filter(
    (member) => member.id && member.key !== pendingDelete?.key && member.firstName.trim(),
  )

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target
      if (!(target instanceof Node) || menuRef.current?.contains(target)) return
      setOpen(false)
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

  function dropLocal(key: string) {
    onChange(members.filter((member) => member.key !== key))
    if (editingKey === key) setEditingKey(null)
  }

  function addMember() {
    const name = firstName.trim()
    if (!name) {
      setError('Indica al menos el nombre')
      return
    }
    const key = crypto.randomUUID()
    onChange([...members, { key, firstName: name, lastName: lastName.trim() }])
    setFirstName('')
    setLastName('')
    setError('')
    setAdding(false)
    setEditingKey(key)
  }

  function closePending() {
    setPendingDelete(null)
    setPendingAppointments(null)
    setTargetMemberId('')
  }

  async function askDelete(member: CustomerMemberDraft) {
    setOpen(false)
    setError('')
    if (!member.id || !phone.trim() || !adminToken) {
      setPendingDelete(member)
      setPendingAppointments([])
      return
    }
    setBusy(true)
    try {
      const { appointments } = await fetchPendingMemberAppointments(adminToken, phone, member.id)
      setPendingDelete(member)
      setPendingAppointments(appointments)
      const nextTarget = members.find(
        (row) => row.id && row.key !== member.key && row.firstName.trim(),
      )
      setTargetMemberId(nextTarget?.id ?? '')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudieron consultar las citas')
    } finally {
      setBusy(false)
    }
  }

  async function confirmDelete(action: 'cancel' | 'titular' | 'member') {
    if (!pendingDelete) return
    setBusy(true)
    setError('')
    try {
      if (pendingDelete.id && phone.trim() && adminToken) {
        const hasAppointments = (pendingAppointments?.length ?? 0) > 0
        if (hasAppointments) {
          await removeCustomerMember(adminToken, phone, pendingDelete.id, action, {
            targetMemberId: action === 'member' ? targetMemberId : undefined,
            titularName,
          })
        } else {
          await deleteCustomerMember(adminToken, phone, pendingDelete.id)
        }
      }
      dropLocal(pendingDelete.key)
      closePending()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo eliminar el miembro')
    } finally {
      setBusy(false)
    }
  }

  const pendingName = pendingDelete
    ? formatCustomerDisplayName(pendingDelete.firstName, pendingDelete.lastName)
    : ''
  const hasPending = (pendingAppointments?.length ?? 0) > 0

  return (
    <fieldset className="space-y-3" disabled={disabled || busy}>
      <legend className={typography.label}>Miembros</legend>
      <p className={typography.caption}>
        Otras personas que usan este mismo teléfono. El titular de la ficha sigue siendo{' '}
        {titularName.trim() || 'el usuario principal'}.
      </p>
      <div ref={menuRef} className="relative text-left">
        <button
          type="button"
          className="flex w-full cursor-pointer items-center justify-between gap-2 border border-gold/30 bg-cream px-3 py-2 text-left text-sm text-charcoal outline-none focus:border-gold disabled:cursor-not-allowed"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listId}
          onClick={() => setOpen((current) => !current)}
        >
          <span className="min-w-0 truncate">
            {members.length === 0
              ? 'Nadie más está asociado a este teléfono'
              : `${members.length} ${members.length === 1 ? 'miembro' : 'miembros'}`}
          </span>
          <span className="text-[10px] text-gold" aria-hidden>
            {open ? '▲' : '▼'}
          </span>
        </button>
        {open && (
          <ul
            id={listId}
            role="listbox"
            className="mt-1 max-h-56 w-full overflow-y-auto border border-gold/30 bg-cream shadow-lg"
          >
            {members.length === 0 && (
              <li className={`${typography.caption} px-3 py-2 text-charcoal-muted`}>
                Nadie más está asociado a este teléfono.
              </li>
            )}
            {members.map((member) => {
              const name = formatCustomerDisplayName(member.firstName, member.lastName)
              return (
                <li key={member.key} className="flex items-stretch border-t border-gold/15 first:border-t-0">
                  <button
                    type="button"
                    className="min-w-0 flex-1 cursor-pointer px-3 py-2 text-left text-sm text-charcoal hover:bg-gold/10"
                    onClick={() => {
                      setEditingKey(member.key)
                      setOpen(false)
                    }}
                  >
                    {name || 'Sin nombre'}
                  </button>
                  <button
                    type="button"
                    className="shrink-0 cursor-pointer border-l border-gold/15 px-3 text-base leading-none text-charcoal-muted hover:bg-red-50 hover:text-red-800 focus:outline-none focus:ring-2 focus:ring-gold/40"
                    aria-label={`Eliminar ${name || 'miembro'}`}
                    title={`Eliminar ${name || 'miembro'}`}
                    onClick={() => void askDelete(member)}
                  >
                    ✕
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {editing && (
        <div className="grid gap-2 sm:grid-cols-2">
          <Input
            label="Nombre"
            value={editing.firstName}
            onChange={(e) =>
              onChange(
                members.map((member) =>
                  member.key === editing.key ? { ...member, firstName: e.target.value } : member,
                ),
              )
            }
          />
          <Input
            label="Apellidos"
            value={editing.lastName}
            onChange={(e) =>
              onChange(
                members.map((member) =>
                  member.key === editing.key ? { ...member, lastName: e.target.value } : member,
                ),
              )
            }
          />
        </div>
      )}

      {adding ? (
        <div className="space-y-2 rounded border border-gold/20 p-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <Input
              label="Nombre"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              autoComplete="given-name"
            />
            <Input
              label="Apellidos"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              autoComplete="family-name"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="ui-rounded cursor-pointer border border-gold bg-gold/10 px-3 py-1.5 text-sm text-charcoal hover:bg-gold/15 focus:outline-none focus:ring-2 focus:ring-gold/40"
              onClick={addMember}
            >
              Añadir
            </button>
            <button
              type="button"
              className="ui-rounded cursor-pointer border border-gold/30 px-3 py-1.5 text-sm text-charcoal-muted hover:border-gold focus:outline-none focus:ring-2 focus:ring-gold/40"
              onClick={() => {
                setAdding(false)
                setError('')
              }}
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="ui-rounded w-full cursor-pointer border border-dashed border-gold/40 px-3 py-2 text-sm text-gold hover:border-gold hover:bg-gold/5 focus:outline-none focus:ring-2 focus:ring-gold/40"
          onClick={() => setAdding(true)}
        >
          + Añadir miembro
        </button>
      )}

      {error && (
        <p className="text-xs text-red-800" role="alert">
          {error}
        </p>
      )}

      <ConfirmDialog
        open={pendingDelete != null && !hasPending}
        title="¿Eliminar este miembro?"
        message={
          pendingName
            ? `${pendingName} dejará de estar asociado a este teléfono.`
            : undefined
        }
        confirmLabel="Eliminar"
        cancelLabel="Volver"
        destructive
        busy={busy}
        onClose={closePending}
        onConfirm={() => void confirmDelete('titular')}
      />

      {pendingDelete != null && hasPending && (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-charcoal/45 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="member-appointments-title"
          onMouseDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation()
            if (!busy && event.target === event.currentTarget) closePending()
          }}
        >
          <div
            className="max-h-[85vh] w-full max-w-md overflow-y-auto border border-gold/30 bg-cream p-5 shadow-lg sm:p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="member-appointments-title" className={`${typography.h3} mb-2 text-gold`}>
              {pendingName} tiene citas pendientes
            </h2>
            <p className={`${typography.body} mb-3 text-sm`}>
              Antes de eliminarlo, elige qué hacer con estas citas. Las que ya pasaron se quedan en
              el historial.
            </p>
            <ul className="mb-4 space-y-1.5">
              {pendingAppointments?.map((appointment) => (
                <li key={appointment.id} className="border border-gold/20 px-3 py-2 text-sm">
                  <span className="font-medium text-charcoal">
                    {formatDisplayDate(appointment.date)} · {appointment.startTime}
                  </span>
                  <span className="block text-charcoal-muted">
                    {appointment.serviceName}
                    {appointment.staffName ? ` · ${appointment.staffName}` : ''}
                  </span>
                </li>
              ))}
            </ul>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                disabled={busy}
                className="ui-rounded cursor-pointer border border-red-300 px-3 py-2 text-sm text-red-800 hover:bg-red-50 disabled:opacity-50"
                onClick={() => void confirmDelete('cancel')}
              >
                Quitar las citas
              </button>
              <button
                type="button"
                disabled={busy}
                className="ui-rounded cursor-pointer border border-gold/40 px-3 py-2 text-sm text-charcoal hover:bg-gold/10 disabled:opacity-50"
                onClick={() => void confirmDelete('titular')}
              >
                Pasarlas al titular{titularName.trim() ? ` (${titularName.trim()})` : ''}
              </button>
              {otherMembers.length > 0 && (
                <div className="space-y-2 border border-gold/20 p-3">
                  <label className="block text-left text-sm text-charcoal">
                    Pasarlas a otro miembro
                    <select
                      value={targetMemberId}
                      onChange={(event) => setTargetMemberId(event.target.value)}
                      className="mt-1 w-full cursor-pointer border border-gold/30 bg-cream px-3 py-2 text-sm outline-none focus:border-gold"
                    >
                      {otherMembers.map((member) => (
                        <option key={member.id} value={member.id}>
                          {formatCustomerDisplayName(member.firstName, member.lastName)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    disabled={busy || !targetMemberId}
                    className="ui-rounded w-full cursor-pointer border border-gold bg-gold/10 px-3 py-2 text-sm text-charcoal hover:bg-gold/15 disabled:opacity-50"
                    onClick={() => void confirmDelete('member')}
                  >
                    Pasar y eliminar
                  </button>
                </div>
              )}
              <button
                type="button"
                disabled={busy}
                className="cursor-pointer py-1 text-sm text-charcoal-muted hover:text-charcoal disabled:opacity-50"
                onClick={closePending}
              >
                Volver
              </button>
            </div>
          </div>
        </div>
      )}
    </fieldset>
  )
}
