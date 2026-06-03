import { useState } from 'react'
import { CustomerLocaleSelect } from '@/components/customers/CustomerLocaleSelect'
import { CustomerSearchPicker } from '@/components/customers/CustomerSearchPicker'
import { Input, Textarea } from '@/components/ui/Input'
import type { AppointmentDraft } from '@/components/agenda/staff/types'
import { formatCustomerDisplayName } from '@/lib/customerName'
import { formatPhoneDisplay } from '@/lib/phone'
import { normalizeLocale } from '@/i18n/types'
import type { CustomerDetail } from '@/types/customers'
import { typography } from '@/styles/typography'

const fieldCompact = '!px-3 !py-2'

const CLEAR_CUSTOMER_PATCH: Partial<AppointmentDraft> = {
  customerFirstName: '',
  customerLastName: '',
  customerPhone: '',
  customerEmail: '',
  customerNotes: '',
}

function customerToDraftPatch(customer: CustomerDetail['customer']): Partial<AppointmentDraft> {
  return {
    customerFirstName: customer.firstName,
    customerLastName: customer.lastName,
    customerPhone: customer.phone,
    customerEmail: customer.email ?? '',
    customerNotes: customer.notes ?? '',
    customerLocale: normalizeLocale(customer.locale),
  }
}

type Props = {
  adminToken: string
  draft: AppointmentDraft
  onDraftChange: (patch: Partial<AppointmentDraft>) => void
  compact?: boolean
}

export function AppointmentCustomerEntry({
  adminToken,
  draft,
  onDraftChange,
  compact = false,
}: Props) {
  const [mode, setMode] = useState<'search' | 'manual'>('search')

  const selectedLabel = formatCustomerDisplayName(
    draft.customerFirstName,
    draft.customerLastName,
  )
  const hasSelection = Boolean(draft.customerPhone.trim() || selectedLabel.trim())

  function selectExisting(customer: CustomerDetail['customer']) {
    onDraftChange(customerToDraftPatch(customer))
  }

  function openManual() {
    onDraftChange(CLEAR_CUSTOMER_PATCH)
    setMode('manual')
  }

  function openSearch() {
    setMode('search')
    onDraftChange(CLEAR_CUSTOMER_PATCH)
  }

  if (mode === 'search') {
    return (
      <div className="space-y-3">
        <div className="flex items-end gap-2">
          <div className="min-w-0 flex-1">
            <CustomerSearchPicker adminToken={adminToken} onSelect={selectExisting} />
          </div>
          <button
            type="button"
            onClick={openManual}
            className="flex h-[34px] w-[34px] shrink-0 cursor-pointer items-center justify-center border border-gold/30 bg-cream text-xl leading-none text-gold transition-colors hover:border-gold hover:bg-gold/10"
            aria-label="Cliente nuevo"
            title="Cliente nuevo"
          >
            +
          </button>
        </div>
        {hasSelection && (
          <p className={`${typography.caption} rounded border border-gold/20 bg-charcoal/[0.04] px-3 py-2 text-charcoal`}>
            <span className="font-medium">{selectedLabel || 'Cliente'}</span>
            {draft.customerPhone.trim() && (
              <span className="tabular-nums text-charcoal-muted">
                {' '}
                · {formatPhoneDisplay(draft.customerPhone)}
              </span>
            )}
          </p>
        )}
        <CustomerLocaleSelect
          compact
          value={draft.customerLocale}
          onChange={(locale) => onDraftChange({ customerLocale: locale })}
        />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={openSearch}
        className={`${typography.caption} cursor-pointer text-gold underline-offset-2 hover:underline`}
      >
        Buscar cliente existente
      </button>
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
          label="Teléfono"
          required
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
      <Textarea
        label="Observaciones del cliente (ficha)"
        rows={compact ? 2 : 2}
        value={draft.customerNotes}
        onChange={(e) => onDraftChange({ customerNotes: e.target.value })}
        className={compact ? fieldCompact : undefined}
      />
      <CustomerLocaleSelect
        compact
        value={draft.customerLocale}
        onChange={(locale) => onDraftChange({ customerLocale: locale })}
      />
    </div>
  )
}
