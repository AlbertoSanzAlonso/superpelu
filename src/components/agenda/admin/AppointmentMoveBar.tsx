import { Button } from '@/components/ui/Button'
import type { PendingMoveSummary } from '@/lib/pendingAppointmentMoves'
import { typography } from '@/styles/typography'

type Props = {
  summary: PendingMoveSummary
  busy?: boolean
  onUndo: () => void
  onSave: () => void
  onDiscard: () => void
}

export function AppointmentMoveBar({
  summary,
  busy = false,
  onUndo,
  onSave,
  onDiscard,
}: Props) {
  const { count, byAppointmentId, lastMove } = summary
  const appointmentCount = byAppointmentId.size

  return (
    <div
      className="shrink-0 border-t border-gold/30 bg-gold/10 px-3 py-2.5"
      role="status"
      aria-live="polite"
    >
      <div className="mx-auto flex max-w-4xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className={`${typography.body} min-w-0 text-sm`}>
          <p>
            <span className="font-medium tabular-nums">
              {count} {count === 1 ? 'movimiento' : 'movimientos'}
            </span>
            {appointmentCount > 0 && (
              <span className="text-charcoal-muted">
                {' '}
                · {appointmentCount} {appointmentCount === 1 ? 'cita' : 'citas'}
              </span>
            )}
          </p>
          {lastMove && (
            <p className="mt-0.5 truncate text-charcoal-muted">
              Último: {lastMove.appointment.customerName}
              {' — '}
              {lastMove.fromStartTime} → {lastMove.toStartTime}
              {lastMove.fromStaffId !== lastMove.toStaffId && (
                <span>
                  {' '}
                  · {lastMove.fromStaffName} → {lastMove.toStaffName}
                </span>
              )}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy || count === 0}
            onClick={onUndo}
          >
            Deshacer
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={onDiscard}
          >
            Descartar todo
          </Button>
          <Button
            type="button"
            variant="solid"
            size="sm"
            disabled={busy}
            onClick={onSave}
          >
            {busy ? 'Guardando…' : 'Guardar cambios'}
          </Button>
        </div>
      </div>
    </div>
  )
}
