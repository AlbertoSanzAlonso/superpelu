import { useState } from 'react'
import { CustomerAppointmentDetailModal } from '@/components/customers/CustomerAppointmentDetailModal'
import { CustomerAppointmentHistoryFiltersBar } from '@/components/customers/CustomerAppointmentHistoryFilters'
import {
  countListableAppointments,
  CustomerAppointmentHistoryList,
} from '@/components/customers/CustomerAppointmentHistoryList'
import { useCustomerAppointmentHistory } from '@/hooks/useCustomerAppointmentHistory'
import type { Appointment } from '@/types/booking'
import { typography } from '@/styles/typography'

type Props = {
  adminToken: string
  phone: string
  collapsibleFiltersOnMobile?: boolean
}

export function CustomerAppointmentHistoryPanel({
  adminToken,
  phone,
  collapsibleFiltersOnMobile = true,
}: Props) {
  const history = useCustomerAppointmentHistory(adminToken, phone)
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null)

  const listableTotal = countListableAppointments(history.appointments)

  return (
    <>
      {history.error && (
        <p
          className="border-b border-red-200 bg-red-50 px-3 py-1.5 text-center text-xs text-red-800"
          role="alert"
        >
          {history.error}
        </p>
      )}

      <CustomerAppointmentHistoryFiltersBar
        filters={history.filters}
        hasFilters={history.hasFilters}
        serviceOptions={history.serviceOptions}
        staffOptions={history.staffOptions}
        filteredCount={history.filteredAppointments.length}
        totalCount={listableTotal}
        onPatch={history.patchFilters}
        onClear={history.clearFilters}
        collapsibleOnMobile={collapsibleFiltersOnMobile}
      />

      <CustomerAppointmentHistoryList
        appointments={history.filteredAppointments}
        totalAppointments={history.appointments}
        loading={history.loading}
        onSelect={setSelectedAppointment}
      />

      <CustomerAppointmentDetailModal
        appointment={selectedAppointment}
        adminToken={adminToken}
        onClose={() => setSelectedAppointment(null)}
        onChanged={({ id, action }) => {
          if (action === 'deleted') {
            history.updateAppointments((rows) => rows.filter((a) => a.id !== id))
          } else {
            history.updateAppointments((rows) =>
              rows.map((a) => (a.id === id ? { ...a, status: 'cancelled' } : a)),
            )
          }
        }}
      />
    </>
  )
}

export function CustomerAppointmentHistoryPanelHeader({
  subtitle,
}: {
  subtitle?: string
}) {
  if (!subtitle) return null
  return (
    <p className={`${typography.caption} border-b border-gold/15 px-4 py-2 text-charcoal-muted`}>
      {subtitle}
    </p>
  )
}
