import { CustomerAppointmentHistoryPanel } from '@/components/customers/CustomerAppointmentHistoryPanel'
import { formatCustomerDisplayName } from '@/lib/customerName'
import { formatPhoneDisplay } from '@/lib/phone'
import { typography } from '@/styles/typography'

type Props = {
  open: boolean
  adminToken: string
  phone: string
  customerLabel?: string
  onClose: () => void
}

export function CustomerAppointmentHistoryModal({
  open,
  adminToken,
  phone,
  customerLabel,
  onClose,
}: Props) {
  if (!open) return null

  const title = customerLabel?.trim() || 'Historial de citas'

  return (
    <div
      className="fixed inset-0 z-[60] flex bg-charcoal/45 sm:items-center sm:justify-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="customer-history-modal-title"
      onClick={onClose}
    >
      <div
        className="flex h-dvh w-full max-w-2xl flex-col overflow-hidden bg-cream sm:h-auto sm:max-h-[90vh] sm:border sm:border-gold/30 sm:shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-gold/15 px-4 py-3">
          <div className="min-w-0">
            <h2 id="customer-history-modal-title" className={`${typography.h3} text-gold`}>
              {title}
            </h2>
            <p className={`${typography.caption} mt-0.5 tabular-nums text-charcoal-muted`}>
              {formatPhoneDisplay(phone)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 cursor-pointer border border-gold/30 px-2.5 py-1.5 text-sm text-charcoal-muted hover:border-gold"
            aria-label="Cerrar historial"
          >
            ✕
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <CustomerAppointmentHistoryPanel adminToken={adminToken} phone={phone} />
        </div>
      </div>
    </div>
  )
}

export function customerHistoryModalTitle(
  firstName: string,
  lastName: string,
): string {
  const name = formatCustomerDisplayName(firstName, lastName)
  return name ? `Historial — ${name}` : 'Historial de citas'
}
