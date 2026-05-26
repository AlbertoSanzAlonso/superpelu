import { Button } from '@/components/ui/Button'
import type { GridSelectionSummary } from '@/lib/timeGrid'

type Props = {
  summary: GridSelectionSummary
  onBlock: () => void
  onUnblock: () => void
  onClear: () => void
  onCreateAppointment: () => void
  busy?: boolean
  /** Botones compactos para la barra superior de la agenda admin. */
  toolbar?: boolean
}

export function StaffGridSelectionActions({
  summary,
  onBlock,
  onUnblock,
  onClear,
  onCreateAppointment,
  busy = false,
  toolbar = false,
}: Props) {
  const canBlock = summary.freeTimes.length > 0 && !summary.hasAppointment
  const canUnblock = summary.blockIds.length > 0
  const canCreate = summary.freeTimes.length === 1 && !summary.hasAppointment

  const btnClass = toolbar ? 'h-8 px-2 text-xs' : undefined

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {canCreate && (
        <Button
          type="button"
          variant="solid"
          size="sm"
          className={btnClass}
          disabled={busy}
          onClick={onCreateAppointment}
        >
          Crear cita
        </Button>
      )}
      {canBlock && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={btnClass}
          disabled={busy}
          onClick={onBlock}
        >
          Bloquear
        </Button>
      )}
      {canUnblock && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={btnClass}
          disabled={busy}
          onClick={onUnblock}
        >
          Quitar bloqueo{summary.blockIds.length > 1 ? 's' : ''}
        </Button>
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={btnClass}
        disabled={busy}
        onClick={onClear}
      >
        Limpiar
      </Button>
    </div>
  )
}
