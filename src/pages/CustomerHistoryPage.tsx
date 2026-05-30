import { useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { AgendaWorkspaceShell } from '@/components/layout/AgendaWorkspaceShell'
import { CustomerAppointmentDetailModal } from '@/components/customers/CustomerAppointmentDetailModal'
import { CustomerEditModal } from '@/components/customers/CustomerEditModal'
import { Button } from '@/components/ui/Button'
import { CustomersWorkspaceHeader } from '@/components/customers/CustomersWorkspaceHeader'
import { fetchCustomerDetail, ApiError } from '@/lib/api'
import { formatCustomerDisplayName } from '@/lib/customerName'
import { formatAppointmentTimeRange } from '@/lib/bookingOccupancy'
import { formatDisplayDate } from '@/lib/dates'
import { formatPhoneDisplay } from '@/lib/phone'
import { useAdminSession } from '@/hooks/useAdminSession'
import type { Appointment } from '@/types/booking'
import type { Customer } from '@/types/customers'
import { typography } from '@/styles/typography'

const fieldClass =
  'w-full border border-gold/30 bg-cream px-3 py-2 font-sans text-sm text-charcoal outline-none focus:border-gold'

export function CustomerHistoryPage() {
  const { phone: phoneParam } = useParams<{ phone: string }>()
  const phone = phoneParam ? decodeURIComponent(phoneParam) : ''

  const { adminToken, authOk, handleLogout } = useAdminSession()

  const [customer, setCustomer] = useState<Customer | null>(null)
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [serviceFilter, setServiceFilter] = useState('')
  const [staffFilter, setStaffFilter] = useState('')

  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null)
  const [editOpen, setEditOpen] = useState(false)

  const loadDetail = useCallback(async () => {
    if (!adminToken || !phone) return
    setLoading(true)
    setError('')
    try {
      const detail = await fetchCustomerDetail(adminToken, phone)
      setCustomer({
        ...detail.customer,
        appointmentCount: detail.appointments.filter((a) => a.status !== 'cancelled').length,
        lastAppointmentDate: detail.appointments[0]?.date ?? null,
      })
      setAppointments(detail.appointments)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cargar el historial')
    } finally {
      setLoading(false)
    }
  }, [adminToken, phone])

  useEffect(() => {
    if (authOk) void loadDetail()
  }, [authOk, loadDetail])

  const serviceOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const apt of appointments) {
      map.set(apt.serviceId, apt.serviceName)
    }
    return [...map.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'))
  }, [appointments])

  const staffOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const apt of appointments) {
      if (apt.staffId && apt.staffName) {
        map.set(apt.staffId, apt.staffName)
      }
    }
    return [...map.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'))
  }, [appointments])

  const filteredAppointments = useMemo(() => {
    return appointments.filter((apt) => {
      if (dateFrom && apt.date < dateFrom) return false
      if (dateTo && apt.date > dateTo) return false
      if (serviceFilter && apt.serviceId !== serviceFilter) return false
      if (staffFilter && apt.staffId !== staffFilter) return false
      return true
    })
  }, [appointments, dateFrom, dateTo, serviceFilter, staffFilter])

  const hasFilters = Boolean(dateFrom || dateTo || serviceFilter || staffFilter)

  if (!phone) {
    return <Navigate to="/clientes" replace />
  }

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
              </p>
              {customer.email && <p className="mt-1 text-sm break-all">{customer.email}</p>}
              {customer.notes && (
                <p className={`${typography.caption} mt-2 whitespace-pre-wrap`}>
                  {customer.notes}
                </p>
              )}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={() => setEditOpen(true)}
            >
              Editar
            </Button>
          </div>
        )}

        <div className="border-b border-gold/15 bg-cream/90 px-3 py-3">
          <p className={`${typography.label} mb-3`}>Filtrar historial</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <label className="block text-left">
              <span className={`${typography.caption} mb-1 block`}>Desde</span>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className={fieldClass}
              />
            </label>
            <label className="block text-left">
              <span className={`${typography.caption} mb-1 block`}>Hasta</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className={fieldClass}
              />
            </label>
            <label className="block text-left">
              <span className={`${typography.caption} mb-1 block`}>Tratamiento</span>
              <select
                value={serviceFilter}
                onChange={(e) => setServiceFilter(e.target.value)}
                className={fieldClass}
              >
                <option value="">Todos los tratamientos</option>
                {serviceOptions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-left">
              <span className={`${typography.caption} mb-1 block`}>Profesional</span>
              <select
                value={staffFilter}
                onChange={(e) => setStaffFilter(e.target.value)}
                className={fieldClass}
              >
                <option value="">Todos los profesionales</option>
                {staffOptions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-end sm:col-span-2 lg:col-span-3 xl:col-span-1">
              <button
                type="button"
                disabled={!hasFilters}
                onClick={() => {
                  setDateFrom('')
                  setDateTo('')
                  setServiceFilter('')
                  setStaffFilter('')
                }}
                className="w-full border border-gold/30 px-3 py-2 text-sm text-charcoal-muted hover:border-gold disabled:opacity-40"
              >
                Quitar filtros
              </button>
            </div>
          </div>
          <p className={`${typography.caption} mt-2`}>
            {filteredAppointments.length} de {appointments.length} citas
          </p>
        </div>

        {loading ? (
          <p className={`${typography.caption} p-8 text-center`}>Cargando historial…</p>
        ) : filteredAppointments.length === 0 ? (
          <p className={`${typography.body} p-8 text-center`}>
            {appointments.length === 0
              ? 'Sin citas registradas.'
              : 'Ninguna cita coincide con los filtros.'}
          </p>
        ) : (
          <ul className="divide-y divide-gold/10">
            {filteredAppointments.map((apt) => (
              <li key={apt.id}>
                <button
                  type="button"
                  onClick={() => setSelectedAppointment(apt)}
                  className="flex w-full cursor-pointer flex-col gap-1 px-4 py-4 text-left transition-colors hover:bg-gold/5 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                >
                  <div>
                    <p className="font-medium capitalize">{formatDisplayDate(apt.date)}</p>
                    <p className="tabular-nums text-sm text-charcoal-muted">
                      {formatAppointmentTimeRange(
                        apt.serviceId,
                        apt.startTime,
                        apt.durationMinutes,
                      )}
                    </p>
                  </div>
                  <div className="sm:text-right">
                    <p className="font-medium">{apt.serviceName}</p>
                    {apt.staffName && (
                      <p className={`${typography.caption} mt-0.5`}>{apt.staffName}</p>
                    )}
                    {apt.status === 'cancelled' && (
                      <p className={`${typography.caption} mt-0.5 text-charcoal-muted`}>
                        Cancelada
                      </p>
                    )}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>

      <CustomerAppointmentDetailModal
        appointment={selectedAppointment}
        onClose={() => setSelectedAppointment(null)}
      />

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
                }
              : prev,
          )
        }}
      />
    </AgendaWorkspaceShell>
  )
}
