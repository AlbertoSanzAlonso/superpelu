import { useEffect, useId, useRef, useState } from 'react'
import { Input } from '@/components/ui/Input'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import {
  NEW_MEMBER_ID_PREFIX,
  type HouseholdMemberDraft,
} from '@/components/agenda/staff/types'
import { deleteCustomerMember } from '@/lib/api/admin'
import { deleteMyCustomerMember } from '@/lib/api/staff'
import { ApiError } from '@/lib/api/request'
import { MemberRelationshipSelect } from '@/components/customers/MemberRelationshipSelect'
import {
  formatMemberAppointmentName,
  normalizeMemberRelationship,
} from '@/lib/customer/relationship'
import { typography } from '@/styles/typography'

type Props = {
  titularName: string
  titularFirstName: string
  members: HouseholdMemberDraft[]
  onChange: (members: HouseholdMemberDraft[]) => void
  phone?: string
  adminToken?: string
  staffToken?: string
  compact?: boolean
}

export function AppointmentMembersField({
  titularName,
  titularFirstName,
  members,
  onChange,
  phone = '',
  adminToken,
  staffToken,
  compact = false,
}: Props) {
  const [open, setOpen] = useState(false)
  const [adding, setAdding] = useState(false)
  const [firstName, setFirstName] = useState('')
  const [relationship, setRelationship] = useState('')
  const [error, setError] = useState('')
  const [pendingDelete, setPendingDelete] = useState<HouseholdMemberDraft | null>(null)
  const [deleting, setDeleting] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const listId = useId()
  const fieldCompact = compact ? '!px-3 !py-2' : ''
  const attendee = members.find((member) => member.attendee)
  const titularLabel = titularName.trim() ? `Titular · ${titularName.trim()}` : 'Titular'
  const selectedLabel = attendee
    ? formatMemberAppointmentName(attendee.firstName, attendee.relationship, titularFirstName)
    : titularLabel

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

  function selectAttendee(id: string) {
    onChange(members.map((member) => ({ ...member, attendee: id !== '' && member.id === id })))
    setOpen(false)
  }

  function addMember() {
    const name = firstName.trim()
    const kinship = normalizeMemberRelationship(relationship)
    if (!name) {
      setError('Indica al menos el nombre')
      return
    }
    if (!kinship) {
      setError('Elige el parentesco')
      return
    }
    const id = `${NEW_MEMBER_ID_PREFIX}${crypto.randomUUID()}`
    onChange([
      ...members.map((member) => ({ ...member, attendee: false })),
      { id, firstName: name, relationship: kinship, attendee: true },
    ])
    setFirstName('')
    setRelationship('')
    setError('')
    setAdding(false)
  }

  async function confirmDelete() {
    if (!pendingDelete) return
    setDeleting(true)
    setError('')
    try {
      const saved = !pendingDelete.id.startsWith(NEW_MEMBER_ID_PREFIX)
      if (saved) {
        const normalizedPhone = phone.trim()
        if (!normalizedPhone) {
          setError('Indica un teléfono para eliminar el miembro')
          return
        }
        if (adminToken) {
          await deleteCustomerMember(adminToken, normalizedPhone, pendingDelete.id)
        } else if (staffToken) {
          await deleteMyCustomerMember(staffToken, normalizedPhone, pendingDelete.id)
        } else {
          setError('No se pudo eliminar el miembro')
          return
        }
      }
      onChange(members.filter((member) => member.id !== pendingDelete.id))
      setPendingDelete(null)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo eliminar el miembro')
    } finally {
      setDeleting(false)
    }
  }

  const pendingName = pendingDelete
    ? formatMemberAppointmentName(
        pendingDelete.firstName,
        pendingDelete.relationship,
        titularFirstName,
      )
    : ''

  return (
    <fieldset className="space-y-2">
      <legend className={typography.label}>Miembros</legend>
      <p className={typography.caption}>
        {titularName.trim()
          ? `El titular sigue siendo ${titularName.trim()}. Elige un miembro si la cita es para otra persona.`
          : 'Elige un miembro si la cita es para otra persona. El nombre de arriba es el titular.'}
      </p>
      <div ref={menuRef} className="relative text-left">
        <span className={`${typography.label} mb-1 block`}>Esta cita es para</span>
        <button
          type="button"
          className={`${compact ? 'py-1.5' : 'py-2'} flex w-full cursor-pointer items-center justify-between gap-2 border border-gold/30 bg-cream px-3 text-left text-sm text-charcoal outline-none focus:border-gold`}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listId}
          onClick={() => setOpen((current) => !current)}
        >
          <span className="min-w-0 truncate">{selectedLabel}</span>
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
            <li>
              <button
                type="button"
                role="option"
                aria-selected={!attendee}
                className={`w-full cursor-pointer px-3 py-2 text-left text-sm hover:bg-gold/10 ${
                  attendee ? 'text-charcoal' : 'bg-gold/10 text-charcoal'
                }`}
                onClick={() => selectAttendee('')}
              >
                {titularLabel}
              </button>
            </li>
            {members.length === 0 && (
              <li className={`${typography.caption} px-3 py-2 text-charcoal-muted`}>
                Nadie más está asociado a este teléfono.
              </li>
            )}
            {members.map((member) => {
              const name = formatMemberAppointmentName(
                member.firstName,
                member.relationship,
                titularFirstName,
              )
              return (
                <li key={member.id} className="flex items-stretch border-t border-gold/15">
                  <button
                    type="button"
                    role="option"
                    aria-selected={member.attendee}
                    className={`min-w-0 flex-1 cursor-pointer px-3 py-2 text-left text-sm hover:bg-gold/10 ${
                      member.attendee ? 'bg-gold/10 text-charcoal' : 'text-charcoal'
                    }`}
                    onClick={() => selectAttendee(member.id)}
                  >
                    {name}
                    {member.attendee ? ' · esta cita' : ''}
                  </button>
                  <button
                    type="button"
                    className="shrink-0 cursor-pointer border-l border-gold/15 px-3 text-base leading-none text-charcoal-muted hover:bg-red-50 hover:text-red-800 focus:outline-none focus:ring-2 focus:ring-gold/40"
                    aria-label={`Eliminar ${name}`}
                    title={`Eliminar ${name}`}
                    onClick={() => {
                      setOpen(false)
                      setPendingDelete(member)
                    }}
                  >
                    ✕
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
      {adding ? (
        <div className="space-y-2 rounded border border-gold/20 p-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <Input
              id="appointment-member-first-name"
              label="Nombre"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className={fieldCompact}
              autoComplete="given-name"
            />
            <MemberRelationshipSelect
              label="Parentesco"
              value={relationship}
              onChange={setRelationship}
              className={fieldCompact}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="ui-rounded cursor-pointer border border-gold bg-gold/10 px-3 py-1.5 text-sm text-charcoal hover:bg-gold/15 focus:outline-none focus:ring-2 focus:ring-gold/40"
              onClick={addMember}
            >
              Usar en esta cita
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
        open={pendingDelete != null}
        title="¿Eliminar este miembro?"
        message={
          pendingName
            ? `${pendingName} dejará de estar asociado a este teléfono. Las citas ya registradas conservan su nombre.`
            : undefined
        }
        confirmLabel="Eliminar"
        cancelLabel="Volver"
        destructive
        busy={deleting}
        onClose={() => {
          if (!deleting) setPendingDelete(null)
        }}
        onConfirm={confirmDelete}
      />
    </fieldset>
  )
}
