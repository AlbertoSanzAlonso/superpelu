import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { AgendaWorkspaceShell } from '@/components/layout/AgendaWorkspaceShell'
import { CustomerEditModal } from '@/components/customers/CustomerEditModal'
import {
  CustomersWorkspaceHeader,
  customersWorkspaceButtonClass,
  customersWorkspaceLinkClass,
} from '@/components/customers/CustomersWorkspaceHeader'
import { ReviewRequestButton } from '@/components/customers/ReviewRequestButton'
import { CustomerAppointmentHistoryPagination } from '@/components/customers/CustomerAppointmentHistoryPagination'
import { Button } from '@/components/ui/Button'
import { fetchCustomers, ApiError } from '@/lib/api'
import { formatCustomerDisplayName } from '@/lib/customerName'
import { formatDisplayDate } from '@/lib/dates'
import { formatPhoneDisplay } from '@/lib/phone'
import { useAdminSession } from '@/hooks/useAdminSession'
import type { Customer } from '@/types/customers'
import { typography } from '@/styles/typography'

const searchFieldClass =
  'h-9 min-w-0 flex-1 border border-gold/30 bg-cream px-2.5 font-sans text-sm text-charcoal outline-none focus:border-gold'

const CUSTOMERS_PAGE_SIZE = 10

export function CustomersPage() {
  const navigate = useNavigate()
  const { adminToken, authOk, handleLogout } = useAdminSession()

  const [query, setQuery] = useState('')
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [page, setPage] = useState(1)

  const loadCustomers = useCallback(async () => {
    if (!adminToken) return
    setLoading(true)
    setError('')
    try {
      const { customers: rows } = await fetchCustomers(adminToken, query)
      setCustomers(rows)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cargar la lista')
    } finally {
      setLoading(false)
    }
  }, [adminToken, query])

  useEffect(() => {
    if (authOk) void loadCustomers()
  }, [authOk, loadCustomers])

  const totalPages = Math.max(1, Math.ceil(customers.length / CUSTOMERS_PAGE_SIZE))
  const safePage = Math.min(page, totalPages)

  useEffect(() => {
    if (page !== safePage) setPage(safePage)
  }, [page, safePage])

  const pagedCustomers = useMemo(() => {
    const start = (safePage - 1) * CUSTOMERS_PAGE_SIZE
    return customers.slice(start, start + CUSTOMERS_PAGE_SIZE)
  }, [customers, safePage])

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

  return (
    <AgendaWorkspaceShell>
      <CustomersWorkspaceHeader onLogout={handleLogout}>
        <Link to="/clientes/citas" className={customersWorkspaceLinkClass}>
          Historial de citas
        </Link>
        <Button
          type="button"
          variant="solid"
          size="sm"
          className={customersWorkspaceButtonClass}
          onClick={() => setCreateOpen(true)}
        >
          Cliente nuevo
        </Button>
        <form
          className="flex min-w-[12rem] flex-1 items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            setPage(1)
            void loadCustomers()
          }}
        >
          <label className="sr-only" htmlFor="customers-search">
            Buscar clientes
          </label>
          <input
            id="customers-search"
            type="search"
            placeholder="Buscar nombre, teléfono…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className={searchFieldClass}
          />
          <Button type="submit" variant="outline" size="sm" className={customersWorkspaceButtonClass}>
            Buscar
          </Button>
        </form>
      </CustomersWorkspaceHeader>

      {error && (
        <p
          className="border-b border-red-200 bg-red-50 px-3 py-1.5 text-center text-xs text-red-800"
          role="alert"
        >
          {error}
        </p>
      )}

      <main className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <p className={`${typography.caption} p-6 text-center`}>Cargando…</p>
        ) : customers.length === 0 ? (
          <p className={`${typography.body} p-6 text-center`}>No hay clientes todavía.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 border-b border-gold/15 bg-cream">
              <tr className={typography.caption}>
                <th className="px-3 py-2 font-normal">Cliente</th>
                <th className="px-3 py-2 font-normal">Teléfono</th>
                <th className="hidden px-3 py-2 font-normal sm:table-cell">Citas</th>
                <th className="hidden px-3 py-2 font-normal md:table-cell">Última</th>
                <th className="px-3 py-2 font-normal sr-only">Acción</th>
              </tr>
            </thead>
            <tbody>
              {pagedCustomers.map((c) => {
                const label = formatCustomerDisplayName(c.firstName, c.lastName)
                return (
                  <tr
                    key={c.phone}
                    className="cursor-pointer border-b border-gold/10 hover:bg-gold/5"
                    onClick={() => navigate(`/clientes/${encodeURIComponent(c.phone)}`)}
                  >
                    <td className="px-3 py-2 font-medium">{label}</td>
                    <td className="px-3 py-2 tabular-nums text-charcoal-muted">
                      {formatPhoneDisplay(c.phone)}
                    </td>
                    <td className="hidden px-3 py-2 tabular-nums sm:table-cell">
                      {c.appointmentCount}
                    </td>
                    <td className="hidden px-3 py-2 capitalize md:table-cell">
                      {c.lastAppointmentDate
                        ? formatDisplayDate(c.lastAppointmentDate)
                        : '—'}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className={`${customersWorkspaceButtonClass} px-2.5 text-xs normal-case`}
                          onClick={(e) => {
                            e.stopPropagation()
                            setEditingCustomer(c)
                          }}
                        >
                          Editar
                        </Button>
                        {adminToken && (
                          <ReviewRequestButton
                            adminToken={adminToken}
                            phone={c.phone}
                            reviewRequestSentAt={c.reviewRequestSentAt}
                            inline
                            onSent={(sentAt) =>
                              setCustomers((rows) =>
                                rows.map((row) =>
                                  row.phone === c.phone
                                    ? { ...row, reviewRequestSentAt: sentAt }
                                    : row,
                                ),
                              )
                            }
                          />
                        )}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className={`${customersWorkspaceButtonClass} px-2.5 text-xs normal-case`}
                          onClick={(e) => {
                            e.stopPropagation()
                            navigate(`/clientes/${encodeURIComponent(c.phone)}`)
                          }}
                        >
                          Historial de citas
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}

        {!loading && customers.length > 0 && (
          <CustomerAppointmentHistoryPagination
            page={safePage}
            pageSize={CUSTOMERS_PAGE_SIZE}
            totalItems={customers.length}
            ariaLabel="Paginación de clientes"
            onPageChange={setPage}
          />
        )}
      </main>

      <CustomerEditModal
        open={createOpen}
        mode="create"
        customer={null}
        adminToken={adminToken ?? ''}
        onClose={() => setCreateOpen(false)}
        onSaved={(created) => {
          setCreateOpen(false)
          void loadCustomers()
          navigate(`/clientes/${encodeURIComponent(created.phone)}`)
        }}
      />

      <CustomerEditModal
        open={editingCustomer != null}
        mode="edit"
        customer={editingCustomer}
        adminToken={adminToken ?? ''}
        onClose={() => setEditingCustomer(null)}
        onSaved={(updated) => {
          setCustomers((rows) =>
            rows.map((row) =>
              row.phone === updated.phone
                ? {
                    ...row,
                    firstName: updated.firstName,
                    lastName: updated.lastName,
                    email: updated.email,
                    notes: updated.notes,
                  }
                : row,
            ),
          )
        }}
        onDeleted={(deletedPhone) => {
          setCustomers((rows) => rows.filter((row) => row.phone !== deletedPhone))
        }}
      />
    </AgendaWorkspaceShell>
  )
}
