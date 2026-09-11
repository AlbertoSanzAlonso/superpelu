import { useCallback, useEffect, useMemo, useState, type SelectHTMLAttributes } from 'react'
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
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { deleteCustomer, fetchCustomers, updateCustomer, ApiError } from '@/lib/api'
import {
  CUSTOMER_LOCALE_FILTER_OPTIONS,
  CUSTOMER_PHONE_REGION_FILTER_OPTIONS,
  CUSTOMER_UPDATED_FILTER_OPTIONS,
  filterCustomerList,
  salonDateFromIso,
  type CustomerLocaleFilter,
  type CustomerPhoneRegionFilter,
  type CustomerUpdatedFilter,
} from '@/lib/customer/listFilters'
import {
  CUSTOMER_LIST_SORT_OPTIONS,
  sortCustomerList,
  type CustomerListSort,
} from '@/lib/customer/listSort'
import { formatCustomerDisplayName } from '@/lib/customer/name'
import { formatDisplayDate } from '@/lib/core/dates'
import { formatPhoneDisplay } from '@/lib/customer/phone'
import { useAdminSession } from '@/hooks/useAdminSession'
import type { Locale } from '@/i18n/types'
import type { Customer } from '@/types/customers'
import { typography } from '@/styles/typography'
import { customerLocaleLabel } from '@/components/customers/CustomerLocaleSelect'

const searchFieldClass =
  'h-9 min-w-0 flex-1 border border-gold/30 bg-cream/40 px-2.5 font-sans text-sm text-charcoal outline-none backdrop-blur-[2px] focus:border-gold'

const selectFieldClass =
  'h-9 w-full cursor-pointer appearance-none border border-gold/30 bg-cream/40 py-0 pl-2.5 pr-9 font-sans text-sm text-charcoal outline-none backdrop-blur-[2px] focus:border-gold'

function FilterSelect({
  label,
  wrapperClassName,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & {
  label: string
  wrapperClassName?: string
}) {
  return (
    <label className={`relative block shrink-0 ${wrapperClassName ?? ''}`}>
      <span className="sr-only">{label}</span>
      <select {...props} className={selectFieldClass}>
        {children}
      </select>
      <span
        className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-charcoal-muted"
        aria-hidden
      >
        <svg width="12" height="8" viewBox="0 0 12 8" fill="none" aria-hidden>
          <path
            d="M1 1.5L6 6.5L11 1.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    </label>
  )
}

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
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [birthdayMessageOpen, setBirthdayMessageOpen] = useState(false)
  const [page, setPage] = useState(1)
  const [selectedPhones, setSelectedPhones] = useState<Set<string>>(() => new Set())
  const [bulkBusy, setBulkBusy] = useState(false)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [bulkLocaleConfirm, setBulkLocaleConfirm] = useState<Locale | null>(null)

  const loadCustomers = useCallback(async () => {
    if (!adminToken) return
    setLoading(true)
    setError('')
    try {
      const { customers: rows } = await fetchCustomers(adminToken, query)
      setCustomers(rows)
      setSelectedPhones(new Set())
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
      }),
    [customers, localeFilter, phoneRegionFilter, updatedFilter],
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
    setSelectedPhones(new Set())
  }, [sort, localeFilter, phoneRegionFilter, updatedFilter])

  useEffect(() => {
    if (updatedFilter !== 'all' && sort === 'name') {
      setSort('updated')
    }
  }, [updatedFilter, sort])

  const pagedCustomers = useMemo(() => {
    const start = (safePage - 1) * CUSTOMERS_PAGE_SIZE
    return sortedCustomers.slice(start, start + CUSTOMERS_PAGE_SIZE)
  }, [sortedCustomers, safePage])

  const pagePhones = useMemo(() => pagedCustomers.map((c) => c.phone), [pagedCustomers])
  const allPageSelected =
    pagePhones.length > 0 && pagePhones.every((phone) => selectedPhones.has(phone))
  const somePageSelected = pagePhones.some((phone) => selectedPhones.has(phone))

  const hasActiveFilters =
    localeFilter !== 'all' ||
    phoneRegionFilter !== 'all' ||
    updatedFilter !== 'all' ||
    Boolean(query.trim())

  const togglePhone = useCallback((phone: string) => {
    setSelectedPhones((prev) => {
      const next = new Set(prev)
      if (next.has(phone)) next.delete(phone)
      else next.add(phone)
      return next
    })
  }, [])

  const togglePageSelection = useCallback(() => {
    setSelectedPhones((prev) => {
      const next = new Set(prev)
      if (allPageSelected) {
        for (const phone of pagePhones) next.delete(phone)
      } else {
        for (const phone of pagePhones) next.add(phone)
      }
      return next
    })
  }, [allPageSelected, pagePhones])

  const selectAllFiltered = useCallback(() => {
    setSelectedPhones(new Set(sortedCustomers.map((c) => c.phone)))
  }, [sortedCustomers])

  const clearSelection = useCallback(() => {
    setSelectedPhones(new Set())
  }, [])

  const applyBulkLocale = useCallback(
    async (locale: Locale) => {
      if (!adminToken || selectedPhones.size === 0) return
      setBulkBusy(true)
      setError('')
      try {
        const phones = [...selectedPhones]
        const now = new Date().toISOString()
        await Promise.all(
          phones.map(async (phone) => {
            const current = customers.find((row) => row.phone === phone)
            if (!current) return
            await updateCustomer(adminToken, phone, {
              firstName: current.firstName,
              lastName: current.lastName,
              email: current.email,
              notes: current.notes,
              locale,
              birthdate: current.birthdate,
            })
          }),
        )
        setCustomers((rows) =>
          rows.map((row) =>
            selectedPhones.has(row.phone)
              ? {
                  ...row,
                  locale,
                  lastUpdateSource: 'customers',
                  updatedAt: now,
                }
              : row,
          ),
        )
        setSelectedPhones(new Set())
        setBulkLocaleConfirm(null)
      } catch (err) {
        setError(
          err instanceof ApiError
            ? err.message
            : 'No se pudo cambiar el idioma de los seleccionados',
        )
      } finally {
        setBulkBusy(false)
      }
    },
    [adminToken, customers, selectedPhones],
  )

  const applyBulkDelete = useCallback(async () => {
    if (!adminToken || selectedPhones.size === 0) return
    setBulkBusy(true)
    setError('')
    try {
      const phones = [...selectedPhones]
      const results = await Promise.allSettled(
        phones.map((phone) => deleteCustomer(adminToken, phone)),
      )
      const deleted = new Set(
        phones.filter((_, index) => results[index]?.status === 'fulfilled'),
      )
      if (deleted.size === 0) {
        throw new Error('DELETE_FAILED')
      }
      setCustomers((rows) => rows.filter((row) => !deleted.has(row.phone)))
      setSelectedPhones(new Set())
      setBulkDeleteOpen(false)
      if (deleted.size < phones.length) {
        setError(`Se eliminaron ${deleted.size} de ${phones.length} fichas.`)
      }
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'No se pudieron eliminar los seleccionados',
      )
    } finally {
      setBulkBusy(false)
    }
  }, [adminToken, selectedPhones])

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
          className="flex w-full min-w-0 flex-col gap-3 sm:max-w-none sm:flex-1 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4 sm:gap-y-3"
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
            className={`${searchFieldClass} sm:min-w-[12rem]`}
          />
          <FilterSelect
            label="Filtrar por idioma"
            wrapperClassName="sm:w-[10.5rem]"
            value={localeFilter}
            onChange={(e) => setLocaleFilter(e.target.value as CustomerLocaleFilter)}
          >
            {CUSTOMER_LOCALE_FILTER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect
            label="Filtrar por teléfono"
            wrapperClassName="sm:w-[11.5rem]"
            value={phoneRegionFilter}
            onChange={(e) =>
              setPhoneRegionFilter(e.target.value as CustomerPhoneRegionFilter)
            }
          >
            {CUSTOMER_PHONE_REGION_FILTER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect
            label="Filtrar por actualización reciente"
            wrapperClassName="sm:w-[12rem]"
            value={updatedFilter}
            onChange={(e) => setUpdatedFilter(e.target.value as CustomerUpdatedFilter)}
          >
            {CUSTOMER_UPDATED_FILTER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect
            label="Ordenar clientes"
            wrapperClassName="sm:w-[11rem]"
            value={sort}
            onChange={(e) => setSort(e.target.value as CustomerListSort)}
          >
            {CUSTOMER_LIST_SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </FilterSelect>
          <Button
            type="submit"
            variant="outline"
            size="sm"
            className={`${customersWorkspaceButtonClass} w-full sm:ml-1 sm:w-auto`}
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

      {!loading && customers.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gold/10 bg-cream/35 px-3 py-2">
          <p className={`${typography.caption} text-charcoal-muted`}>
            {sortedCustomers.length === 1
              ? '1 cliente'
              : `${sortedCustomers.length} clientes`}
            {hasActiveFilters ? ' con los filtros actuales' : ''}
            {customers.length !== sortedCustomers.length
              ? ` · ${customers.length} en la búsqueda`
              : ''}
          </p>
          {selectedPhones.size > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className={`${typography.caption} text-charcoal`}>
                {selectedPhones.size} seleccionado{selectedPhones.size === 1 ? '' : 's'}
              </span>
              {selectedPhones.size < sortedCustomers.length && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={customersWorkspaceButtonClass}
                  disabled={bulkBusy}
                  onClick={selectAllFiltered}
                >
                  Seleccionar todos ({sortedCustomers.length})
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={customersWorkspaceButtonClass}
                disabled={bulkBusy}
                onClick={() => setBulkLocaleConfirm('es')}
              >
                Español
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={customersWorkspaceButtonClass}
                disabled={bulkBusy}
                onClick={() => setBulkLocaleConfirm('en')}
              >
                English
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={`${customersWorkspaceButtonClass} text-red-800`}
                disabled={bulkBusy}
                onClick={() => setBulkDeleteOpen(true)}
              >
                Eliminar
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={customersWorkspaceButtonClass}
                disabled={bulkBusy}
                onClick={clearSelection}
              >
                Quitar selección
              </Button>
            </div>
          )}
        </div>
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
                const selected = selectedPhones.has(c.phone)
                return (
                  <li key={c.phone} className="px-3 py-3">
                    <div className="flex items-start gap-3">
                      <label
                        className="mt-1 shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span className="sr-only">Seleccionar {label}</span>
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => togglePhone(c.phone)}
                          className="size-4 accent-gold"
                        />
                      </label>
                      <button
                        type="button"
                        className="min-w-0 flex-1 text-left"
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
                        </p>
                      </button>
                    </div>
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
                  <th className="w-10 px-3 py-2 font-normal">
                    <label className="inline-flex items-center">
                      <span className="sr-only">Seleccionar página</span>
                      <input
                        type="checkbox"
                        checked={allPageSelected}
                        ref={(el) => {
                          if (el) el.indeterminate = somePageSelected && !allPageSelected
                        }}
                        onChange={togglePageSelection}
                        className="size-4 accent-gold"
                      />
                    </label>
                  </th>
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
                  const selected = selectedPhones.has(c.phone)
                  return (
                    <tr
                      key={c.phone}
                      className={`border-b border-gold/10 hover:bg-gold/5 ${
                        selected ? 'bg-gold/5' : ''
                      }`}
                    >
                      <td
                        className="px-3 py-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => togglePhone(c.phone)}
                          aria-label={`Seleccionar ${label}`}
                          className="size-4 accent-gold"
                        />
                      </td>
                      <td
                        className="cursor-pointer px-3 py-2 font-medium"
                        onClick={() => navigate(historyHref)}
                      >
                        {label}
                      </td>
                      <td
                        className="cursor-pointer px-3 py-2 tabular-nums text-charcoal-muted"
                        onClick={() => navigate(historyHref)}
                      >
                        {formatPhoneDisplay(c.phone)}
                      </td>
                      <td
                        className="hidden cursor-pointer px-3 py-2 text-charcoal-muted lg:table-cell"
                        onClick={() => navigate(historyHref)}
                      >
                        {customerLocaleLabel(c.locale)}
                      </td>
                      <td
                        className="hidden cursor-pointer px-3 py-2 tabular-nums sm:table-cell"
                        onClick={() => navigate(historyHref)}
                      >
                        {c.appointmentCount}
                      </td>
                      <td
                        className="hidden cursor-pointer px-3 py-2 capitalize xl:table-cell"
                        onClick={() => navigate(historyHref)}
                      >
                        {c.lastAppointmentDate
                          ? formatDisplayDate(c.lastAppointmentDate)
                          : '—'}
                      </td>
                      <td
                        className="hidden cursor-pointer px-3 py-2 capitalize text-charcoal-muted md:table-cell"
                        onClick={() => navigate(historyHref)}
                      >
                        {formatDisplayDate(salonDateFromIso(c.updatedAt))}
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
          setSelectedPhones((prev) => {
            if (!prev.has(deletedPhone)) return prev
            const next = new Set(prev)
            next.delete(deletedPhone)
            return next
          })
        }}
      />

      <ConfirmDialog
        open={bulkLocaleConfirm != null}
        busy={bulkBusy}
        title="Cambiar idioma"
        message={
          bulkLocaleConfirm === 'en'
            ? `¿Poner English en ${selectedPhones.size} cliente${selectedPhones.size === 1 ? '' : 's'}? Los WhatsApp y avisos usarán ese idioma.`
            : `¿Poner Español en ${selectedPhones.size} cliente${selectedPhones.size === 1 ? '' : 's'}? Los WhatsApp y avisos usarán ese idioma.`
        }
        confirmLabel={bulkLocaleConfirm === 'en' ? 'Usar English' : 'Usar español'}
        cancelLabel="Cancelar"
        onClose={() => {
          if (!bulkBusy) setBulkLocaleConfirm(null)
        }}
        onConfirm={() => {
          if (bulkLocaleConfirm) void applyBulkLocale(bulkLocaleConfirm)
        }}
      />

      <ConfirmDialog
        open={bulkDeleteOpen}
        busy={bulkBusy}
        destructive
        title="Eliminar fichas"
        message={`Se eliminarán ${selectedPhones.size} ficha${selectedPhones.size === 1 ? '' : 's'} de cliente. Las citas del historial se conservan.`}
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        onClose={() => {
          if (!bulkBusy) setBulkDeleteOpen(false)
        }}
        onConfirm={() => void applyBulkDelete()}
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
