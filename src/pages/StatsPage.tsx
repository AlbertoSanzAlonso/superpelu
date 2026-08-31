import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAdminSession } from '@/hooks/useAdminSession'
import { AgendaWorkspaceShell } from '@/components/layout/AgendaWorkspaceShell'
import { typography } from '@/styles/typography'
import {
  customersWorkspaceLinkClass,
  customersWorkspaceNavRowClass,
} from '@/components/customers/CustomersWorkspaceHeader'
import { fetchStats, type StatsResponse } from '@/lib/api/admin'
import { todaySalon } from '@/lib/core/dates'

type PeriodMode = 'all' | 'month' | 'range'

const MONTH_LABELS: Record<string, string> = {
  '01': 'Enero', '02': 'Febrero', '03': 'Marzo', '04': 'Abril',
  '05': 'Mayo', '06': 'Junio', '07': 'Julio', '08': 'Agosto',
  '09': 'Septiembre', '10': 'Octubre', '11': 'Noviembre', '12': 'Diciembre',
}

const fieldClass =
  'h-9 w-full cursor-pointer border border-gold/30 bg-cream/40 px-2.5 font-sans text-sm text-charcoal outline-none backdrop-blur-[2px] focus:border-gold'

const selectClass = `${fieldClass} cursor-pointer`

function lastDayOfMonth(month: string) {
  const [y, m] = month.split('-').map(Number)
  const last = new Date(y, m, 0)
  return `${y}-${String(m).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`
}

function formatMonth(month: string) {
  const [, m] = month.split('-')
  return MONTH_LABELS[m] ?? month
}

function formatDate(iso: string) {
  const [y, m, d] = iso.split('-')
  return `${parseInt(d)}/${parseInt(m)}/${y}`
}

function formatPeriodLabel(from: string, to: string) {
  if (from.slice(0, 7) === to.slice(0, 7) && from.endsWith('-01')) {
    const last = lastDayOfMonth(from.slice(0, 7))
    if (to === last) {
      const [y, m] = from.split('-')
      return `${formatMonth(`${y}-${m}`)} ${y}`
    }
  }
  return `${formatDate(from)} – ${formatDate(to)}`
}

function Bar({ value, max, label, color = 'bg-gold' }: { value: number; max: number; label: string; color?: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0
  return (
    <div className="flex items-center gap-2">
      <span className="w-24 shrink-0 text-right text-xs text-charcoal-muted">{label}</span>
      <div className="h-5 flex-1 rounded-sm bg-charcoal/5">
        <div className={`h-full rounded-sm ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-10 text-right text-xs tabular-nums text-charcoal">{value}</span>
    </div>
  )
}

const cardClass = 'rounded border border-gold/15 bg-white p-4'
const kpiClass = 'rounded border border-gold/15 bg-white p-4 text-center'
const tableHeaderClass = 'border-b border-gold/15 px-3 py-2 text-left text-xs font-medium text-charcoal-muted uppercase tracking-wider'
const tableCellClass = 'border-b border-gold/15 px-3 py-2 text-sm text-charcoal'

export default function StatsPage() {
  const navigate = useNavigate()
  const { adminToken, authOk } = useAdminSession()
  const [data, setData] = useState<StatsResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const [mode, setMode] = useState<PeriodMode>('month')
  const [month, setMonth] = useState(() => todaySalon().slice(0, 7))
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const filterParams = useMemo(() => {
    if (mode === 'all') return null
    if (mode === 'month') {
      return { from: `${month}-01`, to: lastDayOfMonth(month) }
    }
    if (dateFrom && dateTo) return { from: dateFrom, to: dateTo }
    return undefined
  }, [mode, month, dateFrom, dateTo])

  const loadStats = useCallback(async () => {
    if (!adminToken) return
    if (filterParams === undefined) return

    setLoading(true)
    setError(null)
    try {
      const stats = await fetchStats(
        adminToken,
        filterParams?.from,
        filterParams?.to,
      )
      setData(stats)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar estadísticas')
    } finally {
      setLoading(false)
    }
  }, [adminToken, filterParams])

  useEffect(() => {
    loadStats()
  }, [loadStats])

  if (!authOk) {
    return (
      <AgendaWorkspaceShell>
        <div className="flex flex-1 items-center justify-center">
          <p className={typography.caption}>Comprobando acceso…</p>
        </div>
      </AgendaWorkspaceShell>
    )
  }

  const maxByDay = Math.max(...(data?.appointmentsByDay.map((d) => d.count) ?? [1]), 1)
  const maxByMonth = Math.max(...(data?.appointmentsByMonth.map((m) => m.count) ?? [1]), 1)
  const periodLabel = data?.period ? formatPeriodLabel(data.period.from, data.period.to) : null
  const rangeIncomplete = mode === 'range' && (!dateFrom || !dateTo)

  return (
    <AgendaWorkspaceShell>
      <header className="shrink-0 border-b border-gold/15 bg-cream/55 px-3 py-2 backdrop-blur-[2px]">
        <div className={customersWorkspaceNavRowClass}>
          <a
            href="/agenda"
            className={customersWorkspaceLinkClass}
            onClick={(e) => { e.preventDefault(); navigate('/agenda') }}
          >
            ← Agenda
          </a>
          <h1 className={`${typography.label} shrink-0 text-gold`}>Estadísticas</h1>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <a
              href="/servicios"
              className={customersWorkspaceLinkClass}
              onClick={(e) => { e.preventDefault(); navigate('/servicios') }}
            >
              Servicios
            </a>
            <a
              href="/personal"
              className={customersWorkspaceLinkClass}
              onClick={(e) => { e.preventDefault(); navigate('/personal') }}
            >
              Personal
            </a>
            <a
              href="/horarios"
              className={customersWorkspaceLinkClass}
              onClick={(e) => { e.preventDefault(); navigate('/horarios') }}
            >
              Horarios
            </a>
            <a
              href="/clientes"
              className={customersWorkspaceLinkClass}
              onClick={(e) => { e.preventDefault(); navigate('/clientes') }}
            >
              Clientes
            </a>
          </div>
        </div>
      </header>

      <div className="border-b border-gold/15 bg-cream/55 px-3 py-2 backdrop-blur-[2px] md:px-6">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-end gap-2">
          <label className="block min-w-[9rem]">
            <span className={`${typography.caption} mb-0.5 block text-[11px]`}>Periodo</span>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as PeriodMode)}
              className={selectClass}
            >
              <option value="month">Mes</option>
              <option value="range">Rango de fechas</option>
              <option value="all">Todo el historial</option>
            </select>
          </label>

          {mode === 'month' && (
            <label className="block min-w-[10rem] flex-1 sm:max-w-[12rem]">
              <span className={`${typography.caption} mb-0.5 block text-[11px]`}>Mes</span>
              <input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className={fieldClass}
              />
            </label>
          )}

          {mode === 'range' && (
            <>
              <label className="block min-w-[9rem] flex-1 sm:max-w-[11rem]">
                <span className={`${typography.caption} mb-0.5 block text-[11px]`}>Desde</span>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className={fieldClass}
                />
              </label>
              <label className="block min-w-[9rem] flex-1 sm:max-w-[11rem]">
                <span className={`${typography.caption} mb-0.5 block text-[11px]`}>Hasta</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className={fieldClass}
                />
              </label>
            </>
          )}

          {periodLabel && (
            <p className={`${typography.caption} pb-2 text-charcoal-muted`}>
              {periodLabel}
            </p>
          )}

          {loading && (
            <p className={`${typography.caption} pb-2 text-charcoal-muted`}>Actualizando…</p>
          )}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 py-4 md:px-6">
        {error && (
          <div className="mb-4 border border-red-300 bg-red-50 p-3 text-xs text-red-700">{error}</div>
        )}

        {rangeIncomplete ? (
          <div className="flex flex-1 items-center justify-center">
            <p className={typography.body}>Indica fecha de inicio y fin para ver las estadísticas.</p>
          </div>
        ) : !data ? (
          <div className="flex flex-1 items-center justify-center">
            <p className={typography.body}>Cargando estadísticas…</p>
          </div>
        ) : (
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
            <div className={`grid gap-4 ${data.period ? 'grid-cols-2 md:grid-cols-3' : 'grid-cols-2 md:grid-cols-4'}`}>
              {!data.period && data.appointmentsThisMonth != null && (
                <div className={kpiClass}>
                  <p className="text-2xl font-bold tabular-nums text-gold">{data.appointmentsThisMonth}</p>
                  <p className="text-xs text-charcoal-muted">Citas (este mes)</p>
                </div>
              )}
              <div className={kpiClass}>
                <p className="text-2xl font-bold tabular-nums text-gold">{data.appointmentCount}</p>
                <p className="text-xs text-charcoal-muted">
                  {data.period ? 'Citas en el periodo' : 'Total citas'}
                </p>
              </div>
              <div className={kpiClass}>
                <p className="text-2xl font-bold tabular-nums text-gold">{data.newCustomers}</p>
                <p className="text-xs text-charcoal-muted">
                  {data.period ? 'Nuevos clientes' : 'Nuevos clientes (30d)'}
                </p>
              </div>
              <div className={kpiClass}>
                <p className="text-2xl font-bold tabular-nums text-gold">
                  {data.originDistribution.find((o) => o.origin === 'booking_page')?.percentage ?? 0}%
                </p>
                <p className="text-xs text-charcoal-muted">Booking page</p>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className={cardClass}>
                <h2 className={`${typography.label} mb-3`}>
                  {data.period ? 'Citas por día' : 'Citas por día (últimos 30 días)'}
                </h2>
                {data.appointmentsByDay.length === 0 ? (
                  <p className={`${typography.caption} text-charcoal-muted`}>Sin citas en este periodo.</p>
                ) : (
                  <div className="space-y-1">
                    {data.appointmentsByDay.map((d) => (
                      <Bar key={d.date} value={d.count} max={maxByDay} label={formatDate(d.date)} />
                    ))}
                  </div>
                )}
              </div>

              <div className={cardClass}>
                <h2 className={`${typography.label} mb-3`}>
                  {data.period ? 'Citas por mes (periodo)' : 'Citas por mes'}
                </h2>
                {data.appointmentsByMonth.length === 0 ? (
                  <p className={`${typography.caption} text-charcoal-muted`}>Sin citas en este periodo.</p>
                ) : (
                  <div className="space-y-1">
                    {data.appointmentsByMonth.map((m) => (
                      <Bar key={m.month} value={m.count} max={maxByMonth} label={formatMonth(m.month)} color="bg-gold/70" />
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className={cardClass}>
                <h2 className={`${typography.label} mb-3`}>Top servicios</h2>
                {data.topServices.length === 0 ? (
                  <p className={`${typography.caption} text-charcoal-muted`}>Sin datos.</p>
                ) : (
                  <table className="w-full">
                    <thead>
                      <tr>
                        <th className={tableHeaderClass}>Servicio</th>
                        <th className={`${tableHeaderClass} text-right`}>Citas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.topServices.map((s) => (
                        <tr key={s.id}>
                          <td className={tableCellClass}>{s.name}</td>
                          <td className={`${tableCellClass} text-right tabular-nums`}>{s.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <div className={cardClass}>
                <h2 className={`${typography.label} mb-3`}>Top miembros del personal</h2>
                {data.topStaff.length === 0 ? (
                  <p className={`${typography.caption} text-charcoal-muted`}>Sin datos.</p>
                ) : (
                  <table className="w-full">
                    <thead>
                      <tr>
                        <th className={tableHeaderClass}>Profesional</th>
                        <th className={`${tableHeaderClass} text-right`}>Citas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.topStaff.map((s) => (
                        <tr key={s.id}>
                          <td className={tableCellClass}>{s.name}</td>
                          <td className={`${tableCellClass} text-right tabular-nums`}>{s.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            <div className={cardClass}>
              <h2 className={`${typography.label} mb-3`}>Origen de la cita</h2>
              {data.originDistribution.length === 0 ? (
                <p className={`${typography.caption} text-charcoal-muted`}>Sin datos.</p>
              ) : (
                <div className="space-y-2">
                  {data.originDistribution.map((o) => (
                    <div key={o.origin} className="flex items-center gap-3">
                      <span className="w-28 text-sm text-charcoal">
                        {o.origin === 'booking_page' ? 'Booking Page' : o.origin === 'backoffice' ? 'Backoffice' : 'Desconocido'}
                      </span>
                      <div className="h-6 flex-1 rounded-sm bg-charcoal/5">
                        <div className="h-full rounded-sm bg-gold" style={{ width: `${o.percentage}%` }} />
                      </div>
                      <span className="w-16 text-right text-xs tabular-nums text-charcoal-muted">{o.count}</span>
                      <span className="w-10 text-right text-sm font-medium tabular-nums text-charcoal">{o.percentage}%</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AgendaWorkspaceShell>
  )
}
