import { useCallback, useEffect, useState } from 'react'
import { PageShell } from '@/components/layout/PageShell'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { cancelAppointment, fetchAppointments } from '@/lib/api'
import { formatDisplayDate, formatTimeRange, toDateString } from '@/lib/dates'
import type { Appointment } from '@/types/booking'
import { typography } from '@/styles/typography'

const STORAGE_KEY = 'superpelu-admin-token'

export function AdminAgendaPage() {
  const [token, setToken] = useState(() => sessionStorage.getItem(STORAGE_KEY) ?? '')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [loggingIn, setLoggingIn] = useState(false)
  const [selectedDate, setSelectedDate] = useState(toDateString(new Date()))
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const loadAppointments = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError('')
    try {
      const res = await fetchAppointments(selectedDate, selectedDate, token)
      setAppointments(res.appointments.filter((a) => a.status !== 'cancelled'))
    } catch {
      setError('Sesión expirada o clave incorrecta.')
      sessionStorage.removeItem(STORAGE_KEY)
      setToken('')
    } finally {
      setLoading(false)
    }
  }, [token, selectedDate])

  useEffect(() => {
    loadAppointments()
  }, [loadAppointments])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    const key = password.trim()
    if (!key) {
      setLoginError('Introduce la clave de acceso.')
      return
    }

    setLoggingIn(true)
    setLoginError('')

    try {
      const today = toDateString(new Date())
      await fetchAppointments(today, today, key)
      sessionStorage.setItem(STORAGE_KEY, key)
      setToken(key)
      setPassword('')
    } catch {
      sessionStorage.removeItem(STORAGE_KEY)
      setToken('')
      setLoginError(
        'Clave incorrecta. Debe coincidir exactamente con ADMIN_SECRET en Coolify (sin espacios extra).',
      )
    } finally {
      setLoggingIn(false)
    }
  }

  function handleLogout() {
    sessionStorage.removeItem(STORAGE_KEY)
    setToken('')
    setAppointments([])
    setError('')
  }

  async function handleCancel(id: string) {
    if (!confirm('¿Cancelar esta cita?')) return
    try {
      await cancelAppointment(id, token)
      await loadAppointments()
    } catch {
      setError('No se pudo cancelar la cita')
    }
  }

  if (!token) {
    return (
      <PageShell
        title="Agenda interna"
        subtitle="Acceso solo para el equipo de Superpelu"
      >
        <form
          onSubmit={handleLogin}
          className="mx-auto max-w-sm space-y-6 border border-gold/25 bg-cream p-8"
        >
          <Input
            label="Clave de acceso"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
          {loginError && (
            <p className="text-center text-sm text-red-700" role="alert">
              {loginError}
            </p>
          )}
          <Button
            type="submit"
            variant="solid"
            size="md"
            className="w-full"
            disabled={loggingIn}
          >
            {loggingIn ? 'Comprobando…' : 'Entrar'}
          </Button>
          <p className={`${typography.caption} text-center`}>
            La clave es la variable <code className="text-xs">ADMIN_SECRET</code> del servidor.
          </p>
        </form>
      </PageShell>
    )
  }

  const activeCount = appointments.length

  return (
    <PageShell title="Agenda del día" subtitle="Gestiona las citas confirmadas">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <label htmlFor="agenda-date" className={`${typography.label} mb-2 block`}>
            Fecha
          </label>
          <input
            id="agenda-date"
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="border border-gold/30 bg-cream px-4 py-3 font-sans text-sm outline-none focus:border-gold"
          />
        </div>
        <div className="flex flex-wrap gap-3">
          <Button href="/reservar" variant="solid" size="sm">
            + Nueva reserva
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={handleLogout}>
            Salir
          </Button>
        </div>
      </div>

      <p className={`${typography.body} mb-6 text-center capitalize`}>
        {formatDisplayDate(selectedDate)} · {activeCount}{' '}
        {activeCount === 1 ? 'cita' : 'citas'}
      </p>

      {error && (
        <p className="mb-6 text-center text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <p className={`${typography.caption} text-center`}>Cargando…</p>
      ) : appointments.length === 0 ? (
        <div className="border border-gold/20 bg-cream p-12 text-center">
          <p className={typography.body}>No hay citas este día.</p>
        </div>
      ) : (
        <ul className="space-y-4">
          {appointments.map((apt) => (
            <li
              key={apt.id}
              className="flex flex-col gap-4 border border-gold/20 bg-cream p-6 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="text-left">
                <p className={`${typography.h3} text-gold`}>
                  {formatTimeRange(apt.startTime, apt.durationMinutes)}
                </p>
                <p className={`${typography.body} mt-1 font-medium`}>{apt.customerName}</p>
                <p className={typography.caption}>
                  {apt.serviceName} · {apt.customerPhone}
                  {apt.customerEmail ? ` · ${apt.customerEmail}` : ''}
                </p>
                {apt.notes && (
                  <p className={`${typography.caption} mt-2 italic`}>{apt.notes}</p>
                )}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleCancel(apt.id)}
              >
                Cancelar cita
              </Button>
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  )
}