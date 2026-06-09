import { Button } from '@/components/ui/Button'
import { formatDisplayDate } from '@/lib/dates'
import type { AppointmentSeriesMeta } from '@/types/appointmentSeries'
import { typography } from '@/styles/typography'

type Props = {
  open: boolean
  series: AppointmentSeriesMeta
  viewDate: string
  onClose: () => void
  onConfirm: (mode: 'single' | 'series') => void
  busy?: boolean
  action?: 'cancel' | 'delete'
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
}: Props) {
  if (!open) return null

  const firstDate = series.dates[0]
  const lastDate = series.dates[series.dates.length - 1]
  const verb = action === 'delete' ? 'Eliminar' : 'Cancelar'
  const verbLower = action === 'delete' ? 'eliminar' : 'cancelar'

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
        <h2 className={`${typography.h3} mb-1 text-gold`}>{verb} cita periódica</h2>
        <p className={`${typography.caption} mb-4`}>
          {series.serviceName} · {series.startTime} · {scopeLabel(series.scope)} · {series.count}{' '}
          {series.count === 1 ? 'cita' : 'citas'}
          {series.count > 1 && (
            <>
              {' '}
              ({formatDisplayDate(firstDate)}
              {lastDate !== firstDate ? ` – ${formatDisplayDate(lastDate)}` : ''})
            </>
          )}
        </p>

        <div className="space-y-3">
          <button
            type="button"
            disabled={busy}
            onClick={() => onConfirm('single')}
            className="w-full border border-gold/25 p-3 text-left text-sm transition-colors hover:border-gold hover:bg-gold/5 disabled:opacity-50"
          >
            <span className="font-medium">Solo este día</span>
            <span className={`${typography.caption} mt-0.5 block capitalize`}>
              {verbLower} la cita del {formatDisplayDate(viewDate)}.
            </span>
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={() => onConfirm('series')}
            className="w-full border border-gold/25 p-3 text-left text-sm transition-colors hover:border-gold hover:bg-gold/5 disabled:opacity-50"
          >
            <span className="font-medium">{verb} todas</span>
            <span className={`${typography.caption} mt-0.5 block`}>
              {verbLower} las {series.count} citas de esta serie.
            </span>
          </button>

          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={onClose}>
            Volver
          </Button>
        </div>
      </div>
    </div>
  )
}
