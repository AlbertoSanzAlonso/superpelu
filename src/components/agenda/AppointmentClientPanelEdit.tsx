import { useState } from 'react'
import {
  CustomerAppointmentHistoryModal,
  customerHistoryModalTitle,
} from '@/components/customers/CustomerAppointmentHistoryModal'
import { AppointmentCustomerFields } from '@/components/agenda/AppointmentCustomerFields'
import type { AppointmentDraft } from '@/components/agenda/staff/types'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Input'
import { typography } from '@/styles/typography'

type Props = {
  draft: AppointmentDraft
  customerRegistered: boolean
  showCustomerHistory?: boolean
  adminToken?: string
  onDraftChange: (patch: Partial<AppointmentDraft>) => void
  onCustomerRegisteredChange?: (registered: boolean, reviewRequestSentAt?: string | null) => void
  guestWithoutProfile?: boolean
}

export function AppointmentClientPanelEdit({
  draft,
  customerRegistered,
  showCustomerHistory,
  adminToken,
  onDraftChange,
  guestWithoutProfile = false,
}: Props) {
  const [historyOpen, setHistoryOpen] = useState(false)
  const phone = draft.customerPhone
  return (
    <div className="space-y-3 rounded-lg border border-gold/20 bg-charcoal/[0.04] p-4">
      <p className={`${typography.label} text-gold`}>
        {customerRegistered ? 'Datos del cliente' : 'Datos del cliente en esta cita'}
      </p>
      <AppointmentCustomerFields
        draft={draft}
        onDraftChange={onDraftChange}
        compact
        phoneLabel="Móvil"
        guestWithoutProfile={guestWithoutProfile}
      />
      <Textarea
        label="Observaciones de la cita"
        rows={2}
        value={draft.notes}
        onChange={(e) => onDraftChange({ notes: e.target.value })}
        className="!px-3 !py-2"
      />
      {showCustomerHistory && phone && adminToken && (
        <div className="border-t border-gold/15 pt-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => setHistoryOpen(true)}
          >
            Historial de citas del cliente
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
