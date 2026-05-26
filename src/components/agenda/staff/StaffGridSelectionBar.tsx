import type { GridSelectionSummary } from '@/lib/timeGrid'
import { StaffGridSelectionActions } from '@/components/agenda/staff/StaffGridSelectionActions'
import { typography } from '@/styles/typography'

type Props = {
  count: number
  summary: GridSelectionSummary
  onBlock: () => void
  onUnblock: () => void
  onClear: () => void
  onCreateAppointment: () => void
  busy?: boolean
  compact?: boolean
}

export function StaffGridSelectionBar({
  count,
  summary,
  onBlock,
  onUnblock,
  onClear,
  onCreateAppointment,
  busy = false,
  compact = false,
}: Props) {
  return (
    <div
      className={
        compact
          ? 'flex flex-wrap items-center gap-2 bg-gold/10 py-1'
          : 'flex flex-col gap-3 border border-gold/40 bg-gold/10 p-4'
      }
    >
      <p className={compact ? 'text-xs font-medium text-charcoal' : typography.label}>
        {count} franja{count === 1 ? '' : 's'}
      </p>
      <StaffGridSelectionActions
        summary={summary}
        onBlock={onBlock}
        onUnblock={onUnblock}
        onClear={onClear}
        onCreateAppointment={onCreateAppointment}
        busy={busy}
      />
      {summary.hasAppointment && !compact && (
        <p className={typography.caption}>
          Hay citas en la selección: desmárcalas para bloquear huecos libres.
        </p>
      )}
    </div>
  )
}
