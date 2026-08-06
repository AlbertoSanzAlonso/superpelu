import { useCallback } from 'react'
import { CustomerLocaleSelect } from '@/components/customers/CustomerLocaleSelect'
import { ForeignPhoneLocaleConfirmDialog } from '@/components/customers/ForeignPhoneLocaleConfirmDialog'
import { Input, Textarea } from '@/components/ui/Input'
import type { AppointmentDraft } from '@/components/agenda/staff/types'
import { useForeignPhoneLocalePrompt } from '@/hooks/useForeignPhoneLocalePrompt'

const fieldCompact = '!px-3 !py-2'

type Props = {
  draft: AppointmentDraft
  onDraftChange: (patch: Partial<AppointmentDraft>) => void
  compact?: boolean
  /** Muestra observaciones de la ficha (`customers.notes`). */
  showCustomerNotes?: boolean
  phoneLabel?: string
}

export function AppointmentCustomerFields({
  draft,
  onDraftChange,
  compact = false,
  showCustomerNotes = true,
  phoneLabel = 'Teléfono',
}: Props) {
  const switchToEnglish = useCallback(() => {
    onDraftChange({ customerLocale: 'en' })
  }, [onDraftChange])

  const { open, maybePrompt, accept, decline } = useForeignPhoneLocalePrompt(
    draft.customerPhone,
    draft.customerLocale,
    switchToEnglish,
  )

  return (
    <>
      <div className="space-y-3">
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
            required
            type="tel"
            value={draft.customerPhone}
            onChange={(e) => onDraftChange({ customerPhone: e.target.value })}
            onBlur={maybePrompt}
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
      <ForeignPhoneLocaleConfirmDialog open={open} onAccept={accept} onDecline={decline} />
    </>
  )
}
