import { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { AgendaWorkspaceShell } from '@/components/layout/AgendaWorkspaceShell'
import { CustomerAppointmentDetailModal } from '@/components/customers/CustomerAppointmentDetailModal'
import { CustomerAppointmentHistoryFiltersBar } from '@/components/customers/CustomerAppointmentHistoryFilters'
import {
  countListableAppointments,
  CustomerAppointmentHistoryList,
} from '@/components/customers/CustomerAppointmentHistoryList'
import { CustomerAppointmentHistoryPagination } from '@/components/customers/CustomerAppointmentHistoryPagination'
import { CustomersWorkspaceHeader } from '@/components/customers/CustomersWorkspaceHeader'
import { useSalonAppointmentHistory } from '@/hooks/useSalonAppointmentHistory'
import { useAdminSession } from '@/hooks/useAdminSession'
import type { Appointment } from '@/types/booking'
import { typography } from '@/styles/typography'

const APPOINTMENTS_PAGE_SIZE = 10

export function SalonAppointmentsPage() {
  const { adminToken, authOk, handleLogout } = useAdminSession()
  const history = useSalonAppointmentHistory(adminToken ?? '')
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null)
  const [page, setPage] = useState(1)

  useEffect(() => {
    setPage(1)
  }, [history.filters])

  const filteredCount = history.filteredAppointments.length
  const totalPages = Math.max(1, Math.ceil(filteredCount / APPOINTMENTS_PAGE_SIZE))
  const safePage = Math.min(page, totalPages)

  useEffect(() => {
    if (page !== safePage) setPage(safePage)
  }, [page, safePage])

  const pagedAppointments = useMemo(() => {
    const start = (safePage - 1) * APPOINTMENTS_PAGE_SIZE
    return history.filteredAppointments.slice(start, start + APPOINTMENTS_PAGE_SIZE)
  }, [history.filteredAppointments, safePage])

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
      />

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
          appointments={pagedAppointments}
          totalAppointments={history.appointments}
          loading={history.loading}
          showCustomer
          onSelect={setSelectedAppointment}
        />

        {!history.loading && filteredCount > 0 && (
          <CustomerAppointmentHistoryPagination
            page={safePage}
            pageSize={APPOINTMENTS_PAGE_SIZE}
            totalItems={filteredCount}
            onPageChange={setPage}
          />
        )}
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
