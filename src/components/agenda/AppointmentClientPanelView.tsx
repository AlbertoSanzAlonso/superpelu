import { useState } from 'react'
import {
  CustomerAppointmentHistoryModal,
  customerHistoryModalTitle,
} from '@/components/customers/CustomerAppointmentHistoryModal'
import { customerLocaleLabel } from '@/components/customers/CustomerLocaleSelect'
import type { AppointmentDraft } from '@/components/agenda/staff/types'
import { dash, whatsappHref } from '@/components/agenda/appointmentModalUtils'
import { Button } from '@/components/ui/Button'
import { formatCustomerDisplayName } from '@/lib/customer/name'
import { formatCustomerPhoneDisplay, isGuestCustomerPhone } from '@/lib/customer/guestPhone'
import { normalizePhone } from '@/lib/customer/phone'
import { typography } from '@/styles/typography'

type Props = {
  draft: AppointmentDraft
  customerRegistered: boolean
  showCustomerHistory: boolean
  adminToken?: string
  /** Origen de la reserva (`backoffice` | `booking_page`). Si se pasa, se muestra. */
  appointmentOrigin?: string | null
  onEditClient: () => void
}

export function AppointmentClientPanelView({
  draft,
  customerRegistered,
  showCustomerHistory,
  adminToken,
  appointmentOrigin,
  onEditClient,
}: Props) {
  const [historyOpen, setHistoryOpen] = useState(false)
  const displayName = formatCustomerDisplayName(
    draft.customerFirstName,
    draft.customerLastName,
  )
  const phone = draft.customerPhone
  const showContactActions = Boolean(phone.trim()) && !isGuestCustomerPhone(phone)
  const showOrigin = appointmentOrigin !== undefined
  const originText = showOrigin
    ? appointmentOrigin === 'booking_page'
      ? 'Web (cliente)'
      : 'Backoffice'
    : null

  return (
    <div className="rounded-lg border border-gold/20 bg-charcoal/[0.04] p-4">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-base font-semibold text-charcoal">{displayName || '—'}</p>
            {customerRegistered && (
              <button
                type="button"
                onClick={onEditClient}
                className="inline-flex cursor-pointer items-center justify-center rounded p-0.5 text-lg leading-none text-charcoal/80 transition-colors hover:bg-gold/10 hover:text-gold"
                aria-label="Editar cliente"
                title="Editar datos del cliente"
              >
                ✎
              </button>
            )}
          </div>
          {customerRegistered && (
            <p className={`${typography.caption} mt-0.5 text-charcoal-muted`}>
              Cliente en tu listado
            </p>
          )}
        </div>
        {showContactActions && (
          <div className="flex shrink-0 gap-1.5">
            <a
              href={whatsappHref(phone)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-gold/35 text-charcoal-muted hover:border-gold hover:text-gold"
              aria-label="WhatsApp"
              title="WhatsApp"
            >
              💬
            </a>
            <a
              href={`tel:${normalizePhone(phone)}`}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-gold/35 text-charcoal-muted hover:border-gold hover:text-gold"
              aria-label="Llamar"
              title="Llamar"
            >
              📞
            </a>
          </div>
        )}
      </div>

      <dl className="space-y-2.5 text-sm">
        {originText && (
          <div>
            <dt className={typography.label}>Reservada desde</dt>
            <dd className="mt-0.5">{originText}</dd>
          </div>
        )}
        <div>
          <dt className={typography.label}>Móvil</dt>
          <dd className="mt-0.5 tabular-nums">{formatCustomerPhoneDisplay(phone)}</dd>
        </div>
        <div>
          <dt className={typography.label}>Idioma</dt>
          <dd className="mt-0.5">{customerLocaleLabel(draft.customerLocale)}</dd>
        </div>
        <div>
          <dt className={typography.label}>Correo electrónico</dt>
          <dd className="mt-0.5 break-all">{dash(draft.customerEmail)}</dd>
        </div>
        <div>
          <dt className={typography.label}>Observaciones del cliente (ficha)</dt>
          <dd className="mt-0.5 whitespace-pre-wrap text-charcoal-muted">
            {dash(draft.customerNotes)}
          </dd>
        </div>
        <div>
          <dt className={typography.label}>Observaciones de la cita</dt>
          <dd className="mt-0.5 whitespace-pre-wrap text-charcoal-muted">{dash(draft.notes)}</dd>
        </div>
      </dl>

      {showCustomerHistory && showContactActions && adminToken && (
        <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setHistoryOpen(true)}
          >
            Historial de citas
          </Button>
          <CustomerAppointmentHistoryModal
            open={historyOpen}
            adminToken={adminToken}
            phone={phone}
            customerLabel={customerHistoryModalTitle(
              draft.customerFirstName,
              draft.customerLastName,
            )}
            onClose={() => setHistoryOpen(false)}
          />
        </div>
      )}
    </div>
  )
}
