import { Button } from '@/components/ui/Button'
import { typography } from '@/styles/typography'
import type { SalonBoundsConflict } from '@/lib/schedule/salonBounds'

type ConflictItem = SalonBoundsConflict & {
  label: string
}

type Props = {
  open: boolean
  staffName: string
  conflicts: ConflictItem[]
  onClose: () => void
  onConfirmExpand: () => void
  onSaveWithoutExpand: () => void
  busy?: boolean
}

function formatRanges(ranges: { start: string; end: string }[]): string {
  if (ranges.length === 0) return 'cerrado'
  return ranges.map((r) => `${r.start}–${r.end}`).join(', ')
}

export function SalonScheduleExpandModal({
  open,
  staffName,
  conflicts,
  onClose,
  onConfirmExpand,
  onSaveWithoutExpand,
  busy = false,
}: Props) {
  if (!open || conflicts.length === 0) return null

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-charcoal/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="salon-expand-title"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto border border-gold/30 bg-cream p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="salon-expand-title" className={`${typography.h3} mb-3 text-gold`}>
          Horario fuera del salón
        </h2>
        <p className={`${typography.caption} mb-4 text-charcoal`}>
          El horario de {staffName} supera los límites del salón en{' '}
          {conflicts.length === 1 ? 'un día' : `${conflicts.length} días`}. ¿Quieres ampliar el
          horario del salón para esos días? El resto del personal mantendrá su disponibilidad
          habitual.
        </p>

        <ul className="mb-4 space-y-3">
          {conflicts.map((conflict) => (
            <li
              key={conflict.label}
              className="border border-gold/15 bg-cream/60 p-3 text-xs text-charcoal"
            >
              <p className={`${typography.label} mb-1`}>{conflict.label}</p>
              <p className="text-charcoal-muted">
                {conflict.messages.map((m) => m.charAt(0).toUpperCase() + m.slice(1)).join('; ')}.
              </p>
              <p className="mt-2">
                <span className="text-charcoal-muted">Salón actual: </span>
                {formatRanges(conflict.salonRanges)}
              </p>
              <p>
                <span className="text-charcoal-muted">Salón propuesto: </span>
                <span className="text-gold-dark">{formatRanges(conflict.proposedSalonRanges)}</span>
              </p>
            </li>
          ))}
        </ul>

        <div className="flex flex-col gap-2 border-t border-gold/20 pt-4">
          <Button type="button" variant="solid" size="sm" onClick={onConfirmExpand} disabled={busy}>
            {busy ? 'Guardando...' : 'Ampliar horario del salón y guardar'}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onSaveWithoutExpand}
            disabled={busy}
          >
            Guardar solo horario de la profesional
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
        </div>
      </div>
    </div>
  )
}
