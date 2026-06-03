import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { AgendaWorkspaceShell } from '@/components/layout/AgendaWorkspaceShell'
import { CustomerAppointmentDetailModal } from '@/components/customers/CustomerAppointmentDetailModal'
import { CustomerAppointmentHistoryFiltersBar } from '@/components/customers/CustomerAppointmentHistoryFilters'
import {
  countListableAppointments,
  CustomerAppointmentHistoryList,
} from '@/components/customers/CustomerAppointmentHistoryList'
import { CustomersWorkspaceHeader } from '@/components/customers/CustomersWorkspaceHeader'
import { useSalonAppointmentHistory } from '@/hooks/useSalonAppointmentHistory'
import { useAdminSession } from '@/hooks/useAdminSession'
import type { Appointment } from '@/types/booking'
import { typography } from '@/styles/typography'

export function SalonAppointmentsPage() {
  const { adminToken, authOk, handleLogout } = useAdminSession()
  const history = useSalonAppointmentHistory(adminToken ?? '')
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null)

  if (authOk === false) {
    return <Navigate to="/agenda" replace />
  }

  if (authOk === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream">
        <p className={typography.caption}>Comprobando acceso…</p>
      </div>
    )
  }

  const listableTotal = countListableAppointments(history.appointments)

  return (
    <AgendaWorkspaceShell>
      <CustomersWorkspaceHeader
        title="Historial de citas"
        backTo={{ label: 'Clientes', href: '/clientes' }}
        onLogout={handleLogout}
      >
        <Link
          to="/agenda"
          className="border border-gold/30 px-2 py-1 text-xs text-charcoal-muted hover:border-gold"
        >
          Agenda
        </Link>
      </CustomersWorkspaceHeader>

      <p className={`${typography.caption} border-b border-gold/15 px-4 py-2 text-charcoal-muted`}>
        Todas las citas del salón en el rango de fechas. Pulsa una fila para ver el detalle.
      </p>

      {history.error && (
        <p
          className="border-b border-red-200 bg-red-50 px-3 py-1.5 text-center text-xs text-red-800"
          role="alert"
        >
          {history.error}
        </p>
      )}

      <main className="min-h-0 flex-1 overflow-y-auto">
        <CustomerAppointmentHistoryFiltersBar
          filters={history.filters}
          hasFilters={history.hasFilters}
          serviceOptions={history.serviceOptions}
          staffOptions={history.staffOptions}
          filteredCount={history.filteredAppointments.length}
          totalCount={listableTotal}
          onPatch={history.patchFilters}
          onClear={history.clearFilters}
        />

        <CustomerAppointmentHistoryList
          appointments={history.filteredAppointments}
          totalAppointments={history.appointments}
          loading={history.loading}
          showCustomer
          onSelect={setSelectedAppointment}
        />
      </main>

      {adminToken && (
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
      )}
    </AgendaWorkspaceShell>
  )
}
