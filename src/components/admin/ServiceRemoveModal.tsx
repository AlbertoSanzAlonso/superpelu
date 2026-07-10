import { Button } from '@/components/ui/Button'
import { typography } from '@/styles/typography'

export type ServiceRemoveAction = 'deactivate' | 'delete'

type Props = {
  open: boolean
  serviceName: string
  onClose: () => void
  onConfirm: (action: ServiceRemoveAction) => void
  busy?: boolean
}

export function ServiceRemoveModal({
  open,
  serviceName,
  onClose,
  onConfirm,
  busy = false,
}: Props) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-charcoal/45 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="service-remove-title"
      onClick={busy ? undefined : onClose}
    >
      <div
        className="w-full max-w-md border border-gold/30 bg-cream p-5 shadow-lg sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="service-remove-title" className={`${typography.h3} mb-1 text-gold`}>
          ¿Qué hacer con este servicio?
        </h2>
        <p className={`${typography.caption} mb-4`}>{serviceName}</p>

        <div className="space-y-3">
          <button
            type="button"
            disabled={busy}
            onClick={() => onConfirm('deactivate')}
            className="w-full border border-gold/25 p-3 text-left text-sm transition-colors hover:border-gold hover:bg-gold/5 disabled:opacity-50"
          >
            <span className="font-medium">Desactivar</span>
            <span className={`${typography.caption} mt-0.5 block`}>
              Oculta el servicio de reservas y agenda. Se puede reactivar más adelante.
            </span>
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={() => onConfirm('delete')}
            className="w-full border border-red-200 p-3 text-left text-sm transition-colors hover:border-red-400 hover:bg-red-50 disabled:opacity-50"
          >
            <span className="font-medium text-red-800">Eliminar permanentemente</span>
            <span className={`${typography.caption} mt-0.5 block text-red-700/80`}>
              Borra el servicio de la base de datos. No se puede deshacer. Fallará si tiene citas
              asociadas.
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
