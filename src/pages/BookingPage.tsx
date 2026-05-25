import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageShell } from '@/components/layout/PageShell'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { createAppointment, fetchServices, fetchSlots } from '@/lib/api'
import { formatDisplayDate, formatTimeRange, getBookableDates } from '@/lib/dates'
import type { Appointment, BookableService } from '@/types/booking'
import { typography } from '@/styles/typography'

const bookableDates = getBookableDates(35)

export function BookingPage() {
  const [services, setServices] = useState<BookableService[]>([])
  const [serviceId, setServiceId] = useState('')
  const [date, setDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [slots, setSlots] = useState<string[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [confirmed, setConfirmed] = useState<Appointment | null>(null)

  const selectedService = services.find((s) => s.id === serviceId)

  useEffect(() => {
    fetchServices()
      .then((res) => {
        setServices(res.services)
        if (res.services[0]) setServiceId(res.services[0].id)
      })
      .catch(() => setError('No se pudo cargar los servicios. ¿Está el servidor en marcha?'))
  }, [])

  useEffect(() => {
    if (!date || !serviceId) {
      setSlots([])
      return
    }

    setLoadingSlots(true)
    setStartTime('')
    fetchSlots(date, serviceId)
      .then((res) => setSlots(res.slots))
      .catch(() => setError('No se pudieron cargar los horarios disponibles'))
      .finally(() => setLoadingSlots(false))
  }, [date, serviceId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      const { appointment } = await createAppointment({
        serviceId,
        date,
        startTime,
        customerName,
        customerPhone,
        customerEmail: customerEmail || undefined,
        notes: notes || undefined,
      })
      setConfirmed(appointment)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo reservar la cita')
    } finally {
      setSubmitting(false)
    }
  }

  if (confirmed) {
    return (
      <PageShell title="¡Cita confirmada!" subtitle="Te esperamos en Superpelu Hair Studio">
        <div className="mx-auto max-w-lg border border-gold/25 bg-cream p-10 text-center">
          <p className={`${typography.body} mb-6`}>
            Hemos registrado tu cita. Si necesitas cambiarla, llámanos o escríbenos por WhatsApp.
          </p>
          <dl className={`${typography.body} space-y-3 text-left`}>
            <div>
              <dt className={typography.label}>Servicio</dt>
              <dd>{confirmed.serviceName}</dd>
            </div>
            <div>
              <dt className={typography.label}>Fecha</dt>
              <dd className="capitalize">{formatDisplayDate(confirmed.date)}</dd>
            </div>
            <div>
              <dt className={typography.label}>Horario</dt>
              <dd>{formatTimeRange(confirmed.startTime, confirmed.durationMinutes)}</dd>
            </div>
            <div>
              <dt className={typography.label}>Nombre</dt>
              <dd>{confirmed.customerName}</dd>
            </div>
          </dl>
          <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:justify-center">
            <Button href="/" variant="outline" size="md">
              Inicio
            </Button>
            <Button href="/reservar" variant="solid" size="md">
              Nueva cita
            </Button>
          </div>
        </div>
      </PageShell>
    )
  }

  return (
    <PageShell
      title="Reserva tu cita"
      subtitle="Elige servicio, día y hora. Martes a sábado de 10:00 a 20:00."
    >
      <form onSubmit={handleSubmit} className="mx-auto max-w-lg space-y-8">
        <fieldset className="space-y-3">
          <legend className={`${typography.label} mb-2 block w-full text-center`}>Servicio</legend>
          <div className="grid gap-3">
            {services.map((service) => (
              <label
                key={service.id}
                className={`flex cursor-pointer items-start gap-3 border p-4 transition-colors ${
                  serviceId === service.id
                    ? 'border-gold bg-gold/5'
                    : 'border-gold/20 hover:border-gold/40'
                }`}
              >
                <input
                  type="radio"
                  name="service"
                  value={service.id}
                  checked={serviceId === service.id}
                  onChange={() => setServiceId(service.id)}
                  className="mt-1 accent-gold"
                />
                <span className="text-left">
                  <span className={`${typography.h3} block text-gold`}>{service.name}</span>
                  <span className={typography.caption}>{service.durationMinutes} min</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div>
          <label htmlFor="date" className={`${typography.label} mb-2 block`}>
            Día
          </label>
          <select
            id="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full border border-gold/30 bg-cream px-4 py-3 font-sans text-sm text-charcoal outline-none focus:border-gold"
          >
            <option value="">Selecciona un día</option>
            {bookableDates.map((d) => (
              <option key={d} value={d}>
                {formatDisplayDate(d)}
              </option>
            ))}
          </select>
        </div>

        <fieldset className="space-y-3">
          <legend className={`${typography.label} mb-2 block w-full text-center`}>Hora</legend>
          {!date ? (
            <p className={`${typography.caption} text-center`}>Primero elige un día</p>
          ) : loadingSlots ? (
            <p className={`${typography.caption} text-center`}>Cargando horarios…</p>
          ) : slots.length === 0 ? (
            <p className={`${typography.caption} text-center`}>
              No hay huecos ese día. Prueba otra fecha.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {slots.map((slot) => (
                <label
                  key={slot}
                  className={`cursor-pointer border py-2 text-center text-sm transition-colors ${
                    startTime === slot
                      ? 'border-gold bg-gold/10 text-gold'
                      : 'border-gold/20 hover:border-gold/50'
                  }`}
                >
                  <input
                    type="radio"
                    name="time"
                    value={slot}
                    checked={startTime === slot}
                    onChange={() => setStartTime(slot)}
                    className="sr-only"
                    required
                  />
                  {slot}
                  {selectedService && (
                    <span className="mt-0.5 block text-[10px] text-charcoal-muted">
                      hasta {formatTimeRange(slot, selectedService.durationMinutes).split('–')[1]?.trim()}
                    </span>
                  )}
                </label>
              ))}
            </div>
          )}
        </fieldset>

        <div className="space-y-4 border-t border-gold/15 pt-8">
          <Input
            label="Nombre completo"
            required
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            autoComplete="name"
          />
          <Input
            label="Teléfono"
            type="tel"
            required
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
            autoComplete="tel"
            placeholder="600 000 000"
          />
          <Input
            label="Email (opcional)"
            type="email"
            value={customerEmail}
            onChange={(e) => setCustomerEmail(e.target.value)}
            autoComplete="email"
          />
          <Textarea
            label="Notas (opcional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Mechas, alergias, preferencias…"
          />
        </div>

        {error && (
          <p className="text-center text-sm text-red-700" role="alert">
            {error}
          </p>
        )}

        <Button
          type="submit"
          variant="solid"
          size="lg"
          className="w-full"
          disabled={submitting || !serviceId || !date || !startTime}
        >
          {submitting ? 'Reservando…' : 'Confirmar cita'}
        </Button>

        <p className={`${typography.caption} text-center`}>
          ¿Eres del equipo?{' '}
          <Link to="/agenda" className="text-gold hover:text-gold-dark">
            Ver agenda interna
          </Link>
        </p>
      </form>
    </PageShell>
  )
}
