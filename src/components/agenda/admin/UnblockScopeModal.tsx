import { Button } from '@/components/ui/Button'
import { formatDisplayDate } from '@/lib/dates'
import type { BlockSeriesMeta } from '@/types/blocks'
import { typography } from '@/styles/typography'

type Props = {
  open: boolean
  series: BlockSeriesMeta
  viewDate: string
  onClose: () => void
  onConfirm: (mode: 'single' | 'series') => void
  busy?: boolean
}

function scopeLabel(scope: BlockSeriesMeta['scope']): string {
  if (scope === 'weekly') return 'bloqueo semanal permanente'
  if (scope === 'range') return 'bloqueo por rango de fechas'
  return 'bloqueo'
}

export function UnblockScopeModal({
  open,
  series,
  viewDate,
  onClose,
  onConfirm,
  busy = false,
}: Props) {
  if (!open) return null

  const firstDate = series.dates[0]
  const lastDate = series.dates[series.dates.length - 1]

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
        <h2 className={`${typography.h3} mb-1 text-gold`}>Quitar bloqueo</h2>
        <p className={`${typography.caption} mb-4`}>
          {series.startTime}–{series.endTime} · {scopeLabel(series.scope)} · {series.count}{' '}
          {series.count === 1 ? 'día' : 'días'}
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
              Quita el bloqueo del {formatDisplayDate(viewDate)}.
            </span>
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={() => onConfirm('series')}
            className="w-full border border-gold/25 p-3 text-left text-sm transition-colors hover:border-gold hover:bg-gold/5 disabled:opacity-50"
          >
            <span className="font-medium">Quitar todos</span>
            <span className={`${typography.caption} mt-0.5 block`}>
              Elimina los {series.count} días de esta serie de bloqueo.
            </span>
          </button>

          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={onClose}>
            Cancelar
          </Button>
        </div>
      </div>
    </div>
  )
}
