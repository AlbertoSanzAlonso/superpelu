import { useState } from 'react'
import { AppointmentCustomerFields } from '@/components/agenda/AppointmentCustomerFields'
import { CustomerSearchPicker } from '@/components/customers/CustomerSearchPicker'
import type { AppointmentDraft } from '@/components/agenda/staff/types'
import { formatCustomerDisplayName } from '@/lib/customer/name'
import { formatPhoneDisplay } from '@/lib/customer/phone'
import { normalizeLocale } from '@/i18n/types'
import type { CustomerDetail } from '@/types/customers'
import { typography } from '@/styles/typography'

const customerEntryActionClass = `${typography.caption} flex w-full cursor-pointer items-center justify-center gap-1.5 border border-gold/30 bg-cream px-3 py-2 text-charcoal transition-colors hover:border-gold hover:bg-gold/10`

const CLEAR_CUSTOMER_PATCH: Partial<AppointmentDraft> = {
  customerFirstName: '',
  customerLastName: '',
  customerPhone: '',
  customerEmail: '',
  customerNotes: '',
  customerLocale: 'es',
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

  function clearSelection() {
    onDraftChange(CLEAR_CUSTOMER_PATCH)
  }

  if (mode === 'search') {
    return (
      <div className="space-y-3">
        {hasSelection ? (
          <div
            className={`${typography.caption} flex items-start gap-2 rounded border border-gold/20 bg-charcoal/[0.04] px-3 py-2 text-charcoal`}
          >
            <p className="min-w-0 flex-1">
              <span className="font-medium">{selectedLabel || 'Cliente'}</span>
              {draft.customerPhone.trim() && (
                <span className="tabular-nums text-charcoal-muted">
                  {' '}
                  · {formatPhoneDisplay(draft.customerPhone)}
                </span>
              )}
            </p>
            <button
              type="button"
              onClick={clearSelection}
              className="shrink-0 border border-gold/30 px-2 py-1 text-sm leading-none text-charcoal-muted transition-colors hover:border-gold hover:text-charcoal"
              aria-label="Quitar cliente seleccionado"
              title="Quitar cliente seleccionado"
            >
              ✕
            </button>
          </div>
        ) : (
          <>
            <CustomerSearchPicker adminToken={adminToken} onSelect={selectExisting} />
            <button type="button" onClick={openManual} className={customerEntryActionClass}>
              <span className="text-base leading-none text-gold">+</span>
              Añadir cliente nuevo
            </button>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <button type="button" onClick={openSearch} className={customerEntryActionClass}>
        <span className="text-base leading-none text-gold" aria-hidden>
          ←
        </span>
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
