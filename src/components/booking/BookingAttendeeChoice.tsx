import { Input } from '@/components/ui/Input'
import { formatCustomerDisplayName } from '@/lib/customer/name'
import type { CustomerMember } from '@/types/customers'
import { typography } from '@/styles/typography'

type Props = {
  appointmentFor: 'self' | 'other' | null
  selfName: string
  members: CustomerMember[]
  selectedMemberId: string | 'new' | null
  newMemberName: string
  error?: string
  onAppointmentFor: (value: 'self' | 'other') => void
  onSelectMember: (id: string | 'new') => void
  onNewMemberName: (value: string) => void
  labels: {
    appointmentForQuestion: string
    appointmentForSelf: string
    appointmentForOther: string
    appointmentForMembersHint: string
    appointmentForNewPerson: string
    memberName: string
    memberNameHint: string
  }
}

const choiceClass = (active: boolean) =>
  `ui-rounded w-full cursor-pointer border px-3 py-2.5 text-left text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-gold/40 ${
    active
      ? 'border-gold bg-gold/10 text-charcoal'
      : 'border-gold/30 text-charcoal hover:border-gold/60'
  }`

export function BookingAttendeeChoice({
  appointmentFor,
  selfName,
  members,
  selectedMemberId,
  newMemberName,
  error,
  onAppointmentFor,
  onSelectMember,
  onNewMemberName,
  labels,
}: Props) {
  const showNewName =
    appointmentFor === 'other' && (members.length === 0 || selectedMemberId === 'new')
  const selfLabel = selfName.trim()
    ? `${labels.appointmentForSelf} (${selfName.trim()})`
    : labels.appointmentForSelf

  return (
    <div className="space-y-3">
      <p className={`${typography.label} text-center`}>{labels.appointmentForQuestion}</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          className={choiceClass(appointmentFor === 'self')}
          aria-pressed={appointmentFor === 'self'}
          onClick={() => onAppointmentFor('self')}
        >
          {selfLabel}
        </button>
        <button
          type="button"
          className={choiceClass(appointmentFor === 'other')}
          aria-pressed={appointmentFor === 'other'}
          onClick={() => onAppointmentFor('other')}
        >
          {labels.appointmentForOther}
        </button>
      </div>

      {appointmentFor === 'other' && members.length > 0 && (
        <div className="space-y-2">
          <p className={typography.caption}>{labels.appointmentForMembersHint}</p>
          {members.map((member) => {
            const name = formatCustomerDisplayName(member.firstName, member.lastName)
            const active = selectedMemberId === member.id
            return (
              <button
                key={member.id}
                type="button"
                className={choiceClass(active)}
                aria-pressed={active}
                onClick={() => onSelectMember(member.id)}
              >
                {name}
              </button>
            )
          })}
          <button
            type="button"
            className={choiceClass(selectedMemberId === 'new')}
            aria-pressed={selectedMemberId === 'new'}
            onClick={() => onSelectMember('new')}
          >
            {labels.appointmentForNewPerson}
          </button>
        </div>
      )}

      {showNewName && (
        <div className="space-y-2">
          <Input
            label={labels.memberName}
            required
            value={newMemberName}
            onChange={(e) => onNewMemberName(e.target.value)}
            autoComplete="name"
          />
          <p className={typography.caption}>{labels.memberNameHint}</p>
        </div>
      )}

      {error && (
        <p className="text-center text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
