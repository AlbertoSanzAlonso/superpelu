import { Button } from '@/components/ui/Button'
import { typography } from '@/styles/typography'

export type ConfirmDialogState = {
  title: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  /** Etiqueta de una tercera acción secundaria opcional (ej. "Seguir editando"). */
  secondaryLabel?: string
  /** Callback de la acción secundaria. Si no se pasa, `onClose` actúa de backdrop. */
  onSecondary?: () => void
  destructive?: boolean
  onConfirm: () => void | Promise<void>
}

type Props = ConfirmDialogState & {
  open: boolean
  busy?: boolean
  onClose: () => void
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Volver',
  secondaryLabel,
  onSecondary,
  destructive = false,
  busy = false,
  onClose,
  onConfirm,
}: Props) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-charcoal/45 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      onClick={busy ? undefined : onClose}
    >
      <div
        className="w-full max-w-md border border-gold/30 bg-cream p-5 shadow-lg sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="confirm-dialog-title" className={`${typography.h3} mb-2 text-gold`}>
          {title}
        </h2>
        {message && <p className={`${typography.body} mb-5 text-sm`}>{message}</p>}
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={onClose} className="flex-1">
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => void onConfirm()}
            className={`flex-1 ${destructive ? 'border-red-700 text-red-800 hover:bg-red-50' : 'bg-gold/10'}`}
          >
            {busy ? 'Procesando…' : confirmLabel}
          </Button>
          {secondaryLabel && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={onSecondary}
              className="flex-1"
            >
              {secondaryLabel}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
