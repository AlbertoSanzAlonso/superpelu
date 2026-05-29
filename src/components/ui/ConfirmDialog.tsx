import { Button } from '@/components/ui/Button'
import { typography } from '@/styles/typography'

export type ConfirmDialogState = {
  title: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
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
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={onClose}>
            {cancelLabel}
          </Button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void onConfirm()}
            className={`inline-flex h-9 items-center justify-center px-4 text-sm font-medium transition-colors disabled:opacity-50 ${
              destructive
                ? 'bg-red-800 text-cream hover:bg-red-900'
                : 'border border-gold bg-gold/10 text-gold hover:border-gold hover:bg-gold/20'
            }`}
          >
            {busy ? 'Procesando…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
