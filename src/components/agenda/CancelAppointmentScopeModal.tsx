import { Button } from '@/components/ui/Button'
import { formatDisplayDate } from '@/lib/core/dates'
import type { AppointmentSeriesMeta, AppointmentSeriesMode } from '@/types/appointmentSeries'
import { typography } from '@/styles/typography'

type Props = {
  open: boolean
  series: AppointmentSeriesMeta | null
  viewDate: string
  onClose: () => void
  onConfirm: (mode: AppointmentSeriesMode) => void
  busy?: boolean
  action?: 'cancel' | 'delete'
  /** Número de tratamientos en la misma visita (booking_group_id). Si > 1 se muestra opción "visita completa". */
  bookingGroupCount?: number
  /** Nombres de los servicios en la visita (para mostrarlos en el modal). */
  bookingGroupServices?: string[]
}

function scopeLabel(scope: AppointmentSeriesMeta['scope']): string {
  if (scope === 'weekly') return 'cita semanal periódica'
  return 'cita'
}

export function CancelAppointmentScopeModal({
  open,
  series,
  viewDate,
  onClose,
  onConfirm,
  busy = false,
  action = 'cancel',
  bookingGroupCount,
  bookingGroupServices,
}: Props) {
  if (!open) return null

  const hasSeries = series !== null && series.count > 1
  const hasGroup = (bookingGroupCount ?? 0) > 1
  const verb = action === 'delete' ? 'Eliminar' : 'Cancelar'
  const verbLower = action === 'delete' ? 'eliminar' : 'cancelar'

  const title = hasSeries
    ? `${verb} cita periódica`
    : hasGroup
      ? `${verb} tratamiento`
      : `${verb} cita`

  const firstDate = series?.dates[0]
  const lastDate = series?.dates[series.dates.length - 1]

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-charcoal/45 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md border border-gold/30 bg-cream p-5 shadow-lg sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className={`${typography.h3} mb-1 text-gold`}>{title}</h2>
        {hasSeries && series && (
          <p className={`${typography.caption} mb-4`}>
            {series.serviceName} · {series.startTime} · {scopeLabel(series.scope)} · {series.count}{' '}
            {series.count === 1 ? 'cita' : 'citas'}
            {series.count > 1 && firstDate && (
              <>
                {' '}
                ({formatDisplayDate(firstDate)}
                {lastDate !== firstDate ? ` – ${formatDisplayDate(lastDate)}` : ''})
              </>
            )}
          </p>
        )}

        <div className="space-y-3">
          {/* Opción 1: solo este tratamiento */}
          <button
            type="button"
            disabled={busy}
            onClick={() => onConfirm('single')}
            className="w-full cursor-pointer border border-gold/25 p-3 text-left text-sm transition-colors hover:border-gold hover:bg-gold/5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="font-medium">Solo este tratamiento</span>
            <span className={`${typography.caption} mt-0.5 block capitalize`}>
              {verbLower} únicamente este tratamiento del {formatDisplayDate(viewDate)}.
            </span>
          </button>

          {/* Opción 2: todos los tratamientos de la visita (booking_group_id) */}
          {hasGroup && (
            <button
              type="button"
              disabled={busy}
              onClick={() => onConfirm('group')}
              className="w-full cursor-pointer border border-gold/25 p-3 text-left text-sm transition-colors hover:border-gold hover:bg-gold/5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="font-medium">
                Toda la visita ({bookingGroupCount} tratamientos)
              </span>
              <span className={`${typography.caption} mt-0.5 block`}>
                {verbLower} todos los tratamientos de esta visita
                {bookingGroupServices && bookingGroupServices.length > 0
                  ? `: ${bookingGroupServices.join(', ')}.`
                  : '.'}
              </span>
            </button>
          )}

          {/* Opción 3: toda la serie periódica */}
          {hasSeries && series && (
            <button
              type="button"
              disabled={busy}
              onClick={() => onConfirm('series')}
              className="w-full cursor-pointer border border-gold/25 p-3 text-left text-sm transition-colors hover:border-gold hover:bg-gold/5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="font-medium">{verb} toda la serie</span>
              <span className={`${typography.caption} mt-0.5 block`}>
                {verbLower} las {series.count} citas de esta serie.
              </span>
            </button>
          )}

          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={onClose}>
            Volver
          </Button>
        </div>
      </div>
    </div>
  )
}
