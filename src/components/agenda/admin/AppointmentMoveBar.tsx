import { Button } from '@/components/ui/Button'
import type { AppointmentMoveDraft } from '@/hooks/useAdminAgenda'
import { typography } from '@/styles/typography'

type Props = {
  draft: AppointmentMoveDraft
  busy?: boolean
  onSave: () => void
  onDiscard: () => void
}

export function AppointmentMoveBar({ draft, busy = false, onSave, onDiscard }: Props) {
  const staffChanged = draft.fromStaffId !== draft.toStaffId
  const timeChanged = draft.appointment.startTime !== draft.toStartTime

  return (
    <div
      className="shrink-0 border-t border-gold/30 bg-gold/10 px-3 py-2.5"
      role="status"
      aria-live="polite"
    >
      <div className="mx-auto flex max-w-4xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className={`${typography.body} text-sm`}>
          <span className="font-medium">{draft.appointment.customerName}</span>
          {' — mover '}
          {timeChanged && (
            <span className="tabular-nums">
              {draft.appointment.startTime} → {draft.toStartTime}
            </span>
          )}
          {staffChanged && (
            <span>
              {timeChanged ? ' · ' : ''}
              {draft.fromStaffName} → {draft.toStaffName}
            </span>
          )}
          {!timeChanged && !staffChanged && (
            <span className="text-charcoal-muted">sin cambios</span>
          )}
        </p>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={onDiscard}
          >
            Descartar
          </Button>
          <Button
            type="button"
            variant="solid"
            size="sm"
            disabled={busy}
            onClick={onSave}
          >
            {busy ? 'Guardando…' : 'Guardar cambio'}
          </Button>
        </div>
      </div>
    </div>
  )
}
