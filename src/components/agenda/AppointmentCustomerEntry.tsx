import { useState } from 'react'
import { AppointmentCustomerFields } from '@/components/agenda/AppointmentCustomerFields'
import { CustomerSearchPicker } from '@/components/customers/CustomerSearchPicker'
import { CustomerLocaleSelect } from '@/components/customers/CustomerLocaleSelect'
import type { AppointmentDraft } from '@/components/agenda/staff/types'
import { formatCustomerDisplayName } from '@/lib/customerName'
import { formatPhoneDisplay } from '@/lib/phone'
import { normalizeLocale } from '@/i18n/types'
import type { CustomerDetail } from '@/types/customers'
import { typography } from '@/styles/typography'

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
      <AppointmentCustomerFields
        draft={draft}
        onDraftChange={onDraftChange}
        compact={compact}
      />
    </div>
  )
}
