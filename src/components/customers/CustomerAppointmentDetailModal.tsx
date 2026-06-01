import { useState } from 'react'
import type { Appointment } from '@/types/booking'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { cancelAppointment, deleteAppointment, ApiError } from '@/lib/api'
import { formatAppointmentTimeRange } from '@/lib/bookingOccupancy'
import { formatDisplayDate } from '@/lib/dates'
import { formatPhoneDisplay } from '@/lib/phone'
import { typography } from '@/styles/typography'

type Props = {
  appointment: Appointment | null
  adminToken: string
  onClose: () => void
  onChanged: (result: { id: string; action: 'cancelled' | 'deleted' }) => void
}

function statusLabel(status: string): string {
  if (status === 'cancelled') return 'Cancelada'
  if (status === 'confirmed' || status === 'active') return 'Confirmada'
  return status
}

export function CustomerAppointmentDetailModal({
  appointment,
  adminToken,
  onClose,
  onChanged,
}: Props) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (!appointment) return null

  const isCancelled = appointment.status === 'cancelled'

  async function handleConfirmDelete() {
    setBusy(true)
    setError('')
    try {
      if (isCancelled) {
        await deleteAppointment(appointment!.id, adminToken)
        onChanged({ id: appointment!.id, action: 'deleted' })
      } else {
        await cancelAppointment(appointment!.id, adminToken)
        onChanged({ id: appointment!.id, action: 'cancelled' })
      }
      setConfirmOpen(false)
      onClose()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo eliminar la cita')
      setConfirmOpen(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex bg-charcoal/45 sm:items-center sm:justify-center sm:p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="customer-apt-detail-title"
        onClick={busy ? undefined : onClose}
      >
        <div
          className="flex h-dvh w-full max-w-lg flex-col overflow-hidden bg-cream sm:h-auto sm:max-h-[90vh] sm:max-w-md sm:border sm:border-gold/30 sm:shadow-lg"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex shrink-0 items-start justify-between gap-3 border-b border-gold/15 px-4 py-3">
            <div>
              <h2 id="customer-apt-detail-title" className={`${typography.h3} text-gold`}>
                Detalle de la cita
              </h2>
              <p className={`${typography.caption} mt-0.5 capitalize`}>
                {formatDisplayDate(appointment.date)}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="shrink-0 cursor-pointer border border-gold/30 px-2.5 py-1.5 text-sm text-charcoal-muted hover:border-gold disabled:opacity-50"
              aria-label="Cerrar"
            >
              ✕
            </button>
          </div>

          <dl className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 text-sm">
            <div>
              <dt className={typography.label}>Horario</dt>
              <dd className="mt-1 tabular-nums">
                {formatAppointmentTimeRange(
                  appointment.serviceId,
                  appointment.startTime,
                  appointment.durationMinutes,
                  'es',
                  { colorGroupRole: appointment.colorGroupRole },
                )}
              </dd>
            </div>
            <div>
              <dt className={typography.label}>Tratamiento</dt>
              <dd className="mt-1 font-medium">{appointment.serviceName}</dd>
            </div>
            {appointment.staffName && (
              <div>
                <dt className={typography.label}>Profesional</dt>
                <dd className="mt-1">{appointment.staffName}</dd>
              </div>
            )}
            <div>
              <dt className={typography.label}>Cliente en cita</dt>
              <dd className="mt-1">{appointment.customerName}</dd>
              {appointment.customerPhone && (
                <dd className="mt-0.5 tabular-nums text-charcoal-muted">
                  {formatPhoneDisplay(appointment.customerPhone)}
                </dd>
              )}
              {appointment.customerEmail && (
                <dd className="mt-0.5 text-charcoal-muted">{appointment.customerEmail}</dd>
              )}
            </div>
            <div>
              <dt className={typography.label}>Estado</dt>
              <dd className="mt-1">{statusLabel(appointment.status)}</dd>
            </div>
            {appointment.notes?.trim() && (
              <div>
                <dt className={typography.label}>Notas</dt>
                <dd className="mt-1 whitespace-pre-wrap text-charcoal-muted">{appointment.notes}</dd>
              </div>
            )}
            <div>
              <dt className={typography.label}>Reservada el</dt>
              <dd className="mt-1 text-charcoal-muted">
                {new Date(appointment.createdAt).toLocaleString('es-ES', {
                  dateStyle: 'long',
                  timeStyle: 'short',
                })}
              </dd>
            </div>
          </dl>

          {error && (
            <p
              className="mx-4 mb-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-center text-sm text-red-800"
              role="alert"
            >
              {error}
            </p>
          )}

          <footer className="flex shrink-0 justify-center border-t border-gold/15 px-4 py-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => setConfirmOpen(true)}
              className="cursor-pointer text-sm text-charcoal-muted underline-offset-2 hover:text-red-800 hover:underline disabled:opacity-50"
            >
              {isCancelled ? 'Eliminar del historial' : 'Eliminar cita'}
            </button>
          </footer>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title={isCancelled ? '¿Eliminar del historial?' : '¿Cancelar esta cita?'}
        message={
          isCancelled
            ? 'La cita se borrará definitivamente del historial de este cliente.'
            : 'Se avisará al cliente por WhatsApp y al salón por email. Si la cita era mañana, no se enviará el recordatorio automático.'
        }
        confirmLabel={isCancelled ? 'Eliminar' : 'Cancelar cita'}
        cancelLabel="Volver"
        destructive
        busy={busy}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleConfirmDelete}
      />
    </>
  )
}
