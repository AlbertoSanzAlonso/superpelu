import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { AgendaWorkspaceShell } from '@/components/layout/AgendaWorkspaceShell'
import { BirthdayMessageModal } from '@/components/customers/BirthdayMessageModal'
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
import {
  CUSTOMER_LOCALE_FILTER_OPTIONS,
  CUSTOMER_PHONE_REGION_FILTER_OPTIONS,
  CUSTOMER_UPDATED_FILTER_OPTIONS,
  CUSTOMER_UPDATE_SOURCE_FILTER_OPTIONS,
  filterCustomerList,
  salonDateFromIso,
  type CustomerLocaleFilter,
  type CustomerPhoneRegionFilter,
  type CustomerUpdatedFilter,
  type CustomerUpdateSourceFilter,
} from '@/lib/customer/listFilters'
import {
  CUSTOMER_LIST_SORT_OPTIONS,
  sortCustomerList,
  type CustomerListSort,
} from '@/lib/customer/listSort'
import { formatCustomerDisplayName } from '@/lib/customer/name'
import { formatDisplayDate } from '@/lib/core/dates'
import { formatPhoneDisplay } from '@/lib/customer/phone'
import { customerUpdateSourceLabel } from '@/lib/customer/updateSource'
import { useAdminSession } from '@/hooks/useAdminSession'
import type { Customer } from '@/types/customers'
import { typography } from '@/styles/typography'
import { customerLocaleLabel } from '@/components/customers/CustomerLocaleSelect'

const searchFieldClass =
  'h-9 min-w-0 flex-1 border border-gold/30 bg-cream/40 px-2.5 font-sans text-sm text-charcoal outline-none backdrop-blur-[2px] focus:border-gold'

const sortFieldClass =
  'h-9 w-full cursor-pointer border border-gold/30 bg-cream/40 px-2.5 font-sans text-sm text-charcoal outline-none backdrop-blur-[2px] focus:border-gold sm:w-auto'

const CUSTOMERS_PAGE_SIZE = 15

const customerActionButtonClass = `${customersWorkspaceButtonClass} w-full justify-center px-2.5 text-xs normal-case md:w-auto`

type CustomerListActionsProps = {
  customer: Customer
  adminToken: string | null
  onEdit: () => void
  onHistory: () => void
  onReviewSent: (sentAt: string) => void
}

function CustomerListActions({
  customer,
  adminToken,
  onEdit,
  onHistory,
  onReviewSent,
}: CustomerListActionsProps) {
  return (
    <div
      className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center md:justify-end"
      onClick={(e) => e.stopPropagation()}
    >
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={customerActionButtonClass}
        onClick={onEdit}
      >
        Editar
      </Button>
      {adminToken && (
        <ReviewRequestButton
          adminToken={adminToken}
          phone={customer.phone}
          reviewRequestSentAt={customer.reviewRequestSentAt}
          inline
          className={customerActionButtonClass}
          onSent={onReviewSent}
        />
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={customerActionButtonClass}
        onClick={onHistory}
      >
        Historial de citas
      </Button>
    </div>
  )
}

export function CustomersPage() {
  const navigate = useNavigate()
  const { adminToken, authOk, handleLogout } = useAdminSession()

  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<CustomerListSort>('name')
  const [localeFilter, setLocaleFilter] = useState<CustomerLocaleFilter>('all')
  const [phoneRegionFilter, setPhoneRegionFilter] =
    useState<CustomerPhoneRegionFilter>('all')
  const [updatedFilter, setUpdatedFilter] = useState<CustomerUpdatedFilter>('all')
  const [updateSourceFilter, setUpdateSourceFilter] =
    useState<CustomerUpdateSourceFilter>('all')
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [birthdayMessageOpen, setBirthdayMessageOpen] = useState(false)
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

  const filteredCustomers = useMemo(
    () =>
      filterCustomerList(customers, {
        locale: localeFilter,
        phoneRegion: phoneRegionFilter,
        updated: updatedFilter,
        updateSource: updateSourceFilter,
      }),
    [customers, localeFilter, phoneRegionFilter, updatedFilter, updateSourceFilter],
  )

  const sortedCustomers = useMemo(
    () => sortCustomerList(filteredCustomers, sort),
    [filteredCustomers, sort],
  )

  const totalPages = Math.max(1, Math.ceil(sortedCustomers.length / CUSTOMERS_PAGE_SIZE))
  const safePage = Math.min(page, totalPages)

  useEffect(() => {
    if (page !== safePage) setPage(safePage)
  }, [page, safePage])

  useEffect(() => {
    setPage(1)
  }, [sort, localeFilter, phoneRegionFilter, updatedFilter, updateSourceFilter])

  useEffect(() => {
    if (updatedFilter !== 'all' && sort === 'name') {
      setSort('updated')
    }
  }, [updatedFilter, sort])

  const pagedCustomers = useMemo(() => {
    const start = (safePage - 1) * CUSTOMERS_PAGE_SIZE
    return sortedCustomers.slice(start, start + CUSTOMERS_PAGE_SIZE)
  }, [sortedCustomers, safePage])

  const hasActiveFilters =
    localeFilter !== 'all' ||
    phoneRegionFilter !== 'all' ||
    updatedFilter !== 'all' ||
    updateSourceFilter !== 'all'

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

  return (
    <AgendaWorkspaceShell>
      <CustomersWorkspaceHeader onLogout={handleLogout}>
        <Link
          to="/clientes/citas"
          className={`${customersWorkspaceLinkClass} w-full justify-center sm:w-auto`}
        >
          Historial de citas
        </Link>
        <Button
          type="button"
          variant="solid"
          size="sm"
          className={`${customersWorkspaceButtonClass} w-full sm:w-auto`}
          onClick={() => setCreateOpen(true)}
        >
          Cliente nuevo
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={`${customersWorkspaceButtonClass} w-full sm:w-auto`}
          onClick={() => setBirthdayMessageOpen(true)}
        >
          Felicitación cumpleaños
        </Button>
        <form
          className="flex w-full min-w-0 flex-col gap-2 sm:max-w-3xl sm:flex-1 sm:flex-row sm:flex-wrap sm:items-center"
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
          <label className="block shrink-0 sm:w-[10.5rem]">
            <span className="sr-only">Filtrar por idioma</span>
            <select
              value={localeFilter}
              onChange={(e) => setLocaleFilter(e.target.value as CustomerLocaleFilter)}
              className={sortFieldClass}
            >
              {CUSTOMER_LOCALE_FILTER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block shrink-0 sm:w-[11.5rem]">
            <span className="sr-only">Filtrar por teléfono</span>
            <select
              value={phoneRegionFilter}
              onChange={(e) =>
                setPhoneRegionFilter(e.target.value as CustomerPhoneRegionFilter)
              }
              className={sortFieldClass}
            >
              {CUSTOMER_PHONE_REGION_FILTER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block shrink-0 sm:w-[12rem]">
            <span className="sr-only">Filtrar por actualización reciente</span>
            <select
              value={updatedFilter}
              onChange={(e) => setUpdatedFilter(e.target.value as CustomerUpdatedFilter)}
              className={sortFieldClass}
            >
              {CUSTOMER_UPDATED_FILTER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block shrink-0 sm:w-[12.5rem]">
            <span className="sr-only">Filtrar por origen de actualización</span>
            <select
              value={updateSourceFilter}
              onChange={(e) =>
                setUpdateSourceFilter(e.target.value as CustomerUpdateSourceFilter)
              }
              className={sortFieldClass}
            >
              {CUSTOMER_UPDATE_SOURCE_FILTER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block shrink-0 sm:w-[11rem]">
            <span className="sr-only">Ordenar clientes</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as CustomerListSort)}
              className={sortFieldClass}
            >
              {CUSTOMER_LIST_SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <Button
            type="submit"
            variant="outline"
            size="sm"
            className={`${customersWorkspaceButtonClass} w-full sm:w-auto`}
          >
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
        ) : sortedCustomers.length === 0 ? (
          <p className={`${typography.body} p-6 text-center`}>
            {hasActiveFilters
              ? 'Ningún cliente coincide con los filtros.'
              : 'No hay clientes todavía.'}
          </p>
        ) : (
          <>
            <ul className="divide-y divide-gold/10 md:hidden">
              {pagedCustomers.map((c) => {
                const label = formatCustomerDisplayName(c.firstName, c.lastName)
                const historyHref = `/clientes/${encodeURIComponent(c.phone)}`
                return (
                  <li key={c.phone} className="px-3 py-3">
                    <button
                      type="button"
                      className="w-full min-w-0 text-left"
                      onClick={() => navigate(historyHref)}
                    >
                      <p className="font-medium">{label}</p>
                      <p className="mt-0.5 tabular-nums text-sm text-charcoal-muted">
                        {formatPhoneDisplay(c.phone)}
                      </p>
                      <p className={`${typography.caption} mt-1 text-charcoal-muted`}>
                        {customerLocaleLabel(c.locale)}
                        {' · '}
                        {c.appointmentCount} cita{c.appointmentCount === 1 ? '' : 's'}
                        {c.lastAppointmentDate
                          ? ` · última ${formatDisplayDate(c.lastAppointmentDate)}`
                          : ''}
                      </p>
                      <p className={`${typography.caption} mt-0.5 text-charcoal-muted`}>
                        Actualizado {formatDisplayDate(salonDateFromIso(c.updatedAt))}
                        {' · '}
                        {customerUpdateSourceLabel(c.lastUpdateSource)}
                      </p>
                    </button>
                    <CustomerListActions
                      customer={c}
                      adminToken={adminToken}
                      onEdit={() => setEditingCustomer(c)}
                      onHistory={() => navigate(historyHref)}
                      onReviewSent={(sentAt) =>
                        setCustomers((rows) =>
                          rows.map((row) =>
                            row.phone === c.phone
                              ? {
                                  ...row,
                                  reviewRequestSentAt: sentAt,
                                  lastUpdateSource: 'review_request',
                                  updatedAt: sentAt,
                                }
                              : row,
                          ),
                        )
                      }
                    />
                  </li>
                )
              })}
            </ul>

            <table className="hidden w-full text-left text-sm md:table">
              <thead className="sticky top-0 border-b border-gold/15 bg-cream/55 backdrop-blur-[2px]">
                <tr className={typography.caption}>
                  <th className="px-3 py-2 font-normal">Cliente</th>
                  <th className="px-3 py-2 font-normal">Teléfono</th>
                  <th className="hidden px-3 py-2 font-normal lg:table-cell">Idioma</th>
                  <th className="hidden px-3 py-2 font-normal sm:table-cell">Citas</th>
                  <th className="hidden px-3 py-2 font-normal xl:table-cell">Última cita</th>
                  <th className="hidden px-3 py-2 font-normal md:table-cell">Actualizado</th>
                  <th className="px-3 py-2 font-normal sr-only">Acción</th>
                </tr>
              </thead>
              <tbody>
                {pagedCustomers.map((c) => {
                  const label = formatCustomerDisplayName(c.firstName, c.lastName)
                  const historyHref = `/clientes/${encodeURIComponent(c.phone)}`
                  return (
                    <tr
                      key={c.phone}
                      className="cursor-pointer border-b border-gold/10 hover:bg-gold/5"
                      onClick={() => navigate(historyHref)}
                    >
                      <td className="px-3 py-2 font-medium">{label}</td>
                      <td className="px-3 py-2 tabular-nums text-charcoal-muted">
                        {formatPhoneDisplay(c.phone)}
                      </td>
                      <td className="hidden px-3 py-2 text-charcoal-muted lg:table-cell">
                        {customerLocaleLabel(c.locale)}
                      </td>
                      <td className="hidden px-3 py-2 tabular-nums sm:table-cell">
                        {c.appointmentCount}
                      </td>
                      <td className="hidden px-3 py-2 capitalize xl:table-cell">
                        {c.lastAppointmentDate
                          ? formatDisplayDate(c.lastAppointmentDate)
                          : '—'}
                      </td>
                      <td className="hidden px-3 py-2 text-charcoal-muted md:table-cell">
                        <span className="block capitalize">
                          {formatDisplayDate(salonDateFromIso(c.updatedAt))}
                        </span>
                        <span className={`${typography.caption} block`}>
                          {customerUpdateSourceLabel(c.lastUpdateSource)}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <CustomerListActions
                          customer={c}
                          adminToken={adminToken}
                          onEdit={() => setEditingCustomer(c)}
                          onHistory={() => navigate(historyHref)}
                          onReviewSent={(sentAt) =>
                            setCustomers((rows) =>
                              rows.map((row) =>
                                row.phone === c.phone
                                  ? {
                                      ...row,
                                      reviewRequestSentAt: sentAt,
                                      lastUpdateSource: 'review_request',
                                      updatedAt: sentAt,
                                    }
                                  : row,
                              ),
                            )
                          }
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </>
        )}

        {!loading && sortedCustomers.length > 0 && (
          <CustomerAppointmentHistoryPagination
            page={safePage}
            pageSize={CUSTOMERS_PAGE_SIZE}
            totalItems={sortedCustomers.length}
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
                    birthdate: updated.birthdate,
                    locale: updated.locale,
                    lastUpdateSource: updated.lastUpdateSource ?? 'customers',
                    updatedAt: updated.updatedAt,
                  }
                : row,
            ),
          )
        }}
        onDeleted={(deletedPhone) => {
          setCustomers((rows) => rows.filter((row) => row.phone !== deletedPhone))
        }}
      />

      {adminToken && (
        <BirthdayMessageModal
          open={birthdayMessageOpen}
          adminToken={adminToken}
          onClose={() => setBirthdayMessageOpen(false)}
        />
      )}
    </AgendaWorkspaceShell>
  )
}
