import { CustomerLocaleSelect } from '@/components/customers/CustomerLocaleSelect'
import { Input, Textarea } from '@/components/ui/Input'
import type { AppointmentDraft } from '@/components/agenda/staff/types'

const fieldCompact = '!px-3 !py-2'

type Props = {
  draft: AppointmentDraft
  onDraftChange: (patch: Partial<AppointmentDraft>) => void
  compact?: boolean
  /** Muestra observaciones de la ficha (`customers.notes`). */
  showCustomerNotes?: boolean
  phoneLabel?: string
  /** Cita sin ficha: el móvil es opcional hasta que se quiera registrar al cliente. */
  guestWithoutProfile?: boolean
  /** Agenda: se puede reservar sin móvil (con confirmación al guardar). */
  allowOptionalPhone?: boolean
}

export function AppointmentCustomerFields({
  draft,
  onDraftChange,
  compact = false,
  showCustomerNotes = true,
  phoneLabel = 'Teléfono',
  guestWithoutProfile = false,
  allowOptionalPhone = false,
}: Props) {
  const phoneOptional = guestWithoutProfile || allowOptionalPhone

  return (
    <div className="space-y-3">
      {guestWithoutProfile && (
        <p className="text-xs text-charcoal-muted">
          Cliente sin ficha. Añade un móvil para guardarlo en el listado de clientes.
        </p>
      )}
      {!guestWithoutProfile && allowOptionalPhone && (
        <p className="text-xs text-charcoal-muted">
          El móvil es opcional. Si no lo indicas, podrás reservar sin crear ficha de cliente.
        </p>
      )}
      <div className={`grid gap-3 ${compact ? 'sm:grid-cols-2' : 'gap-4 sm:grid-cols-2'}`}>
        <Input
          label="Nombre"
          required
          value={draft.customerFirstName}
          onChange={(e) => onDraftChange({ customerFirstName: e.target.value })}
          className={compact ? fieldCompact : undefined}
          autoComplete="given-name"
        />
        <Input
          label="Apellidos"
          value={draft.customerLastName}
          onChange={(e) => onDraftChange({ customerLastName: e.target.value })}
          className={compact ? fieldCompact : undefined}
          autoComplete="family-name"
        />
        <Input
          label={phoneLabel}
          required={!phoneOptional}
          type="tel"
          value={draft.customerPhone}
          onChange={(e) => onDraftChange({ customerPhone: e.target.value })}
          className={compact ? fieldCompact : undefined}
          autoComplete="tel"
        />
        <Input
          label="Email"
          type="email"
          value={draft.customerEmail}
          onChange={(e) => onDraftChange({ customerEmail: e.target.value })}
          className={compact ? fieldCompact : undefined}
          autoComplete="email"
        />
      </div>
      {showCustomerNotes && (
        <Textarea
          label="Observaciones del cliente (ficha)"
          rows={compact ? 2 : 2}
          value={draft.customerNotes}
          onChange={(e) => onDraftChange({ customerNotes: e.target.value })}
          className={compact ? fieldCompact : undefined}
        />
      )}
      <CustomerLocaleSelect
        compact
        value={draft.customerLocale}
        onChange={(locale) => onDraftChange({ customerLocale: locale })}
      />
    </div>
  )
}
