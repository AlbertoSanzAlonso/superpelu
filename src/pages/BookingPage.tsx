import { useState } from 'react'
import { PageShell } from '@/components/layout/PageShell'
import { Button } from '@/components/ui/Button'
import { AppointmentForm } from '@/components/booking/AppointmentForm'
import { formatAppointmentTimeRange } from '@/lib/bookingOccupancy'
import { formatDisplayDate } from '@/lib/dates'
import type { Appointment } from '@/types/booking'
import { typography } from '@/styles/typography'

export function BookingPage() {
  const [confirmed, setConfirmed] = useState<Appointment | null>(null)

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
            {confirmed.staffName && (
              <div>
                <dt className={typography.label}>Profesional</dt>
                <dd>{confirmed.staffName}</dd>
              </div>
            )}
            <div>
              <dt className={typography.label}>Fecha</dt>
              <dd className="capitalize">{formatDisplayDate(confirmed.date)}</dd>
            </div>
            <div>
              <dt className={typography.label}>Horario</dt>
              <dd>
                {formatAppointmentTimeRange(
                  confirmed.serviceId,
                  confirmed.startTime,
                  confirmed.durationMinutes,
                )}
              </dd>
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
      subtitle="Elige servicio, profesional, día y hora. Martes a sábado de 10:00 a 20:00."
    >
      <AppointmentForm onConfirmed={setConfirmed} />
    </PageShell>
  )
}
