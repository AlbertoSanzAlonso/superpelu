import { Button } from '@/components/ui/Button'
import { typography } from '@/styles/typography'
import type { SpecialAppointmentConflict } from '@/lib/api/admin'

type Props = {
  open: boolean
  staffName: string
  conflicts: SpecialAppointmentConflict[]
  busy?: boolean
  onContinue: () => void
  onAutoReassign: () => void
  onManual: () => void
  onCancel: () => void
}

function formatConflictDate(date: string): string {
  return new Date(date + 'T12:00:00').toLocaleDateString('es-ES', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

export function SpecialAppointmentConflictModal({
  open,
  staffName,
  conflicts,
  busy = false,
  onContinue,
  onAutoReassign,
  onManual,
  onCancel,
}: Props) {
  if (!open || conflicts.length === 0) return null

  const autoCount = conflicts.filter((c) => c.canAutoReassign).length

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-charcoal/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="special-apt-conflict-title"
      onClick={busy ? undefined : onCancel}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto border border-gold/30 bg-cream p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="special-apt-conflict-title" className={`${typography.h3} mb-3 text-gold`}>
          Citas fuera del horario
        </h2>
        <p className={`${typography.caption} mb-4 text-charcoal`}>
          Con el nuevo horario especial de {staffName},{' '}
          {conflicts.length === 1
            ? '1 cita queda fuera de su disponibilidad'
            : `${conflicts.length} citas quedan fuera de su disponibilidad`}
          . ¿Qué quieres hacer?
        </p>

        <ul className="mb-4 max-h-56 space-y-2 overflow-y-auto">
          {conflicts.map((conflict) => (
            <li
              key={conflict.appointmentId}
              className="border border-gold/15 bg-cream/60 p-3 text-xs text-charcoal"
            >
              <p className={`${typography.label} mb-1`}>
                {formatConflictDate(conflict.date)} · {conflict.startTime}–{conflict.endTime}
              </p>
              <p>
                {conflict.customerName} — {conflict.serviceName}
              </p>
              {conflict.canAutoReassign && conflict.suggestedStaffName ? (
                <p className="mt-1 text-charcoal-muted">
                  Puede reasignarse a {conflict.suggestedStaffName}
                </p>
              ) : (
                <p className="mt-1 text-red-700/80">Sin profesional libre automático</p>
              )}
            </li>
          ))}
        </ul>

        <div className="flex flex-col gap-2 border-t border-gold/20 pt-4">
          <Button type="button" variant="solid" size="sm" onClick={onContinue} disabled={busy}>
            {busy ? 'Guardando...' : 'Seguir con el cambio'}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onAutoReassign}
            disabled={busy || autoCount === 0}
          >
            {busy
              ? 'Reasignando...'
              : autoCount === 0
                ? 'Reasignar automáticamente (no disponible)'
                : autoCount === conflicts.length
                  ? `Reasignar automáticamente (${autoCount})`
                  : `Reasignar las que se pueda (${autoCount}/${conflicts.length})`}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={onManual} disabled={busy}>
            Cambiar manualmente en la agenda
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={busy}>
            Cancelar
          </Button>
        </div>
      </div>
    </div>
  )
}
