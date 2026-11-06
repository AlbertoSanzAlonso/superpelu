import { useState } from 'react'
import { Input } from '@/components/ui/Input'
import {
  NEW_MEMBER_ID_PREFIX,
  type HouseholdMemberDraft,
} from '@/components/agenda/staff/types'
import { formatCustomerDisplayName } from '@/lib/customer/name'
import { typography } from '@/styles/typography'

type Props = {
  titularName: string
  members: HouseholdMemberDraft[]
  onChange: (members: HouseholdMemberDraft[]) => void
  compact?: boolean
}

const choiceClass = (active: boolean) =>
  `ui-rounded w-full cursor-pointer border px-3 py-2 text-left text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-gold/40 ${
    active
      ? 'border-gold bg-gold/10 text-charcoal'
      : 'border-gold/30 text-charcoal hover:border-gold/60'
  }`

export function AppointmentMembersField({
  titularName,
  members,
  onChange,
  compact = false,
}: Props) {
  const [adding, setAdding] = useState(false)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [error, setError] = useState('')
  const fieldCompact = compact ? '!px-3 !py-2' : ''

  function selectMember(id: string) {
    const current = members.find((member) => member.id === id)
    const willAttend = !current?.attendee
    onChange(
      members
        .filter((member) => !member.id.startsWith(NEW_MEMBER_ID_PREFIX) || member.id === id)
        .map((member) => ({ ...member, attendee: willAttend && member.id === id })),
    )
  }

  function addMember() {
    const name = firstName.trim()
    if (!name) {
      setError('Indica al menos el nombre')
      return
    }
    const id = `${NEW_MEMBER_ID_PREFIX}${crypto.randomUUID()}`
    onChange([
      ...members
        .filter((member) => !member.id.startsWith(NEW_MEMBER_ID_PREFIX))
        .map((member) => ({ ...member, attendee: false })),
      { id, firstName: name, lastName: lastName.trim(), attendee: true },
    ])
    setFirstName('')
    setLastName('')
    setError('')
    setAdding(false)
  }

  return (
    <fieldset className="space-y-2">
      <legend className={typography.label}>Miembros</legend>
      <p className={typography.caption}>
        {titularName.trim()
          ? `El titular sigue siendo ${titularName.trim()}. Elige un miembro si la cita es para otra persona.`
          : 'Elige un miembro si la cita es para otra persona. El nombre de arriba es el titular.'}
      </p>
      {members.length === 0 && !adding && (
        <p className={`${typography.caption} text-charcoal-muted`}>
          Nadie más está asociado a este teléfono.
        </p>
      )}
      {members.map((member) => {
        const name = formatCustomerDisplayName(member.firstName, member.lastName)
        return (
          <button
            key={member.id}
            type="button"
            className={choiceClass(member.attendee)}
            aria-pressed={member.attendee}
            onClick={() => selectMember(member.id)}
          >
            {name}
            {member.attendee ? ' · esta cita' : ''}
          </button>
        )
      })}
      {adding ? (
        <div className="space-y-2 rounded border border-gold/20 p-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <Input
              label="Nombre"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className={fieldCompact}
              autoComplete="given-name"
            />
            <Input
              label="Apellidos"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className={fieldCompact}
              autoComplete="family-name"
            />
          </div>
          {error && (
            <p className="text-xs text-red-800" role="alert">
              {error}
            </p>
          )}
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
    </fieldset>
  )
}
