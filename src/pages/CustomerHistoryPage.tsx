import { useCallback, useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { AgendaWorkspaceShell } from '@/components/layout/AgendaWorkspaceShell'
import {
  CUSTOMER_HISTORY_APPOINTMENT_PARAM,
  CustomerAppointmentHistoryPanel,
} from '@/components/customers/CustomerAppointmentHistoryPanel'
import { CustomerEditModal } from '@/components/customers/CustomerEditModal'
import { ReviewRequestButton } from '@/components/customers/ReviewRequestButton'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { CustomersWorkspaceHeader } from '@/components/customers/CustomersWorkspaceHeader'
import { fetchCustomerDetail, deleteCustomer, ApiError } from '@/lib/api'
import { formatCustomerDisplayName } from '@/lib/customer/name'
import { isColorGroupWashRow } from '@/lib/booking/occupancy'
import { customerLocaleLabel } from '@/components/customers/CustomerLocaleSelect'
import { formatDisplayDate } from '@/lib/core/dates'
import { formatPhoneDisplay } from '@/lib/customer/phone'
import { useAdminSession } from '@/hooks/useAdminSession'
import type { Customer } from '@/types/customers'
import { typography } from '@/styles/typography'

export function CustomerHistoryPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { phone: phoneParam } = useParams<{ phone: string }>()
  const phone = phoneParam ? decodeURIComponent(phoneParam) : ''
  const initialAppointmentId = searchParams.get(CUSTOMER_HISTORY_APPOINTMENT_PARAM) ?? undefined

  const clearAppointmentDeepLink = useCallback(() => {
    setSearchParams(
      (prev) => {
        if (!prev.has(CUSTOMER_HISTORY_APPOINTMENT_PARAM)) return prev
        const next = new URLSearchParams(prev)
        next.delete(CUSTOMER_HISTORY_APPOINTMENT_PARAM)
        return next
      },
      { replace: true },
    )
  }, [setSearchParams])

  const { adminToken, authOk, handleLogout } = useAdminSession()

  const [customer, setCustomer] = useState<Customer | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editOpen, setEditOpen] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const loadDetail = useCallback(async () => {
    if (!adminToken || !phone) return
    setLoading(true)
    setError('')
    try {
      const detail = await fetchCustomerDetail(adminToken, phone)
      setCustomer({
        ...detail.customer,
        appointmentCount: detail.appointments.filter(
          (a) => a.status !== 'cancelled' && !isColorGroupWashRow(a.colorGroupRole),
        ).length,
        lastAppointmentDate: detail.appointments[0]?.date ?? null,
      })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cargar el historial')
    } finally {
      setLoading(false)
    }
  }, [adminToken, phone])

  useEffect(() => {
    if (authOk) void loadDetail()
  }, [authOk, loadDetail])

  async function handleDeleteCustomer() {
    if (!adminToken || !customer) return
    setDeleting(true)
    setError('')
    try {
      await deleteCustomer(adminToken, customer.phone)
      navigate('/clientes', { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo eliminar el cliente')
      setDeleteConfirmOpen(false)
    } finally {
      setDeleting(false)
    }
  }

  if (!phone) {
    return <Navigate to="/clientes" replace />
  }

  if (authOk === false) {
    return <Navigate to="/agenda" replace />
  }

  if (authOk === null) {
    return (
      <AgendaWorkspaceShell>
        <div className="flex flex-1 items-center justify-center">
          <p className={typography.caption}>Comprobando acceso…</p>
        </div>
      </AgendaWorkspaceShell>
    )
  }

  const customerLabel = customer
    ? formatCustomerDisplayName(customer.firstName, customer.lastName)
    : 'Cliente'

  return (
    <AgendaWorkspaceShell>
      <CustomersWorkspaceHeader
        title={customerLabel}
        backTo={{ label: 'Clientes', href: '/clientes' }}
        onLogout={handleLogout}
      />

      {error && (
        <p
          className="border-b border-red-200 bg-red-50 px-3 py-1.5 text-center text-xs text-red-800"
          role="alert"
        >
          {error}
        </p>
      )}

      <main className="min-h-0 flex-1 overflow-y-auto">
        {customer && (
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gold/15 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="tabular-nums text-sm text-charcoal-muted">
                {formatPhoneDisplay(customer.phone)}
                <span className="mx-2 text-gold/40">·</span>
                {customerLocaleLabel(customer.locale)}
                <span className="mx-2 text-gold/40">·</span>
                {customer.appointmentCount} cita{customer.appointmentCount === 1 ? '' : 's'}
              </p>
              {customer.birthdate && (
                <p className="mt-1 text-sm text-charcoal-muted">
                  Cumpleaños: {formatDisplayDate(customer.birthdate, 'es')}
                </p>
              )}
              {customer.email && <p className="mt-1 text-sm break-all">{customer.email}</p>}
              {customer.notes?.trim() && (
                <div className="mt-2">
                  <p className={typography.label}>Observaciones del cliente</p>
                  <p className={`${typography.caption} mt-0.5 whitespace-pre-wrap`}>
                    {customer.notes}
                  </p>
                </div>
              )}
            </div>
            <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
              {adminToken && (
                <ReviewRequestButton
                  adminToken={adminToken}
                  phone={customer.phone}
                  reviewRequestSentAt={customer.reviewRequestSentAt ?? null}
                  onSent={(sentAt) =>
                    setCustomer((prev) => (prev ? { ...prev, reviewRequestSentAt: sentAt } : prev))
                  }
                />
              )}
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setEditOpen(true)}>
                  Editar
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={deleting}
                  onClick={() => setDeleteConfirmOpen(true)}
                  className="border-red-300 text-red-800 hover:border-red-400 hover:bg-red-50 hover:text-red-900"
                >
                  Eliminar
                </Button>
              </div>
            </div>
          </div>
        )}

        {loading && !customer ? (
          <p className={`${typography.caption} p-8 text-center`}>Cargando…</p>
        ) : (
          adminToken && (
            <CustomerAppointmentHistoryPanel
              adminToken={adminToken}
              phone={phone}
              initialAppointmentId={initialAppointmentId}
              onDeepLinkHandled={clearAppointmentDeepLink}
            />
          )
        )}
      </main>

      <CustomerEditModal
        open={editOpen}
        customer={customer}
        adminToken={adminToken ?? ''}
        onClose={() => setEditOpen(false)}
        onSaved={(updated) => {
          setCustomer((prev) =>
            prev
              ? {
                  ...prev,
                  firstName: updated.firstName,
                  lastName: updated.lastName,
                  email: updated.email,
                  notes: updated.notes,
                  locale: updated.locale,
                  birthdate: updated.birthdate,
                }
              : prev,
          )
        }}
        onDeleted={() => navigate('/clientes', { replace: true })}
      />

      <ConfirmDialog
        open={deleteConfirmOpen}
        title="¿Eliminar este cliente?"
        message="Se quitará la ficha del listado de clientes. Las citas ya registradas se conservan en la agenda."
        confirmLabel="Eliminar cliente"
        cancelLabel="Volver"
        destructive
        busy={deleting}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={handleDeleteCustomer}
      />
    </AgendaWorkspaceShell>
  )
}
