import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { AgendaWorkspaceShell } from '@/components/layout/AgendaWorkspaceShell'
import { CustomersWorkspaceHeader } from '@/components/customers/CustomersWorkspaceHeader'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { fetchCustomers, ApiError } from '@/lib/api'
import { formatCustomerDisplayName } from '@/lib/customerName'
import { formatDisplayDate } from '@/lib/dates'
import { formatPhoneDisplay } from '@/lib/phone'
import { useAdminSession } from '@/hooks/useAdminSession'
import type { Customer } from '@/types/customers'
import { typography } from '@/styles/typography'

export function CustomersPage() {
  const navigate = useNavigate()
  const { adminToken, authOk, handleLogout } = useAdminSession()

  const [query, setQuery] = useState('')
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

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
        <form
          className="flex min-w-[12rem] flex-1 items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            void loadCustomers()
          }}
        >
          <Input
            label=""
            placeholder="Buscar nombre, teléfono…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="py-1.5 text-sm"
          />
          <Button type="submit" variant="outline" size="sm" className="h-9 shrink-0">
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
              {customers.map((c) => {
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
                      <Link
                        to={`/clientes/${encodeURIComponent(c.phone)}`}
                        className="text-xs text-gold hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Historial →
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </main>
    </AgendaWorkspaceShell>
  )
}
