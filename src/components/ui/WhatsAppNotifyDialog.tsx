import { Button } from '@/components/ui/Button'
import { typography } from '@/styles/typography'

type Props = {
  open: boolean
  busy?: boolean
  onClose: () => void
  onNotify: () => void | Promise<void>
  onSaveWithoutNotify: () => void | Promise<void>
}

export function WhatsAppNotifyDialog({
  open,
  busy = false,
  onClose,
  onNotify,
  onSaveWithoutNotify,
}: Props) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-charcoal/45 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="whatsapp-notify-dialog-title"
      onClick={busy ? undefined : onClose}
    >
      <div
        className="w-full max-w-md border border-gold/30 bg-cream p-5 shadow-lg sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="whatsapp-notify-dialog-title" className={`${typography.h3} mb-2 text-gold`}>
          ¿Avisar al cliente?
        </h2>
        <p className={`${typography.body} mb-5 text-sm`}>
          La cita se guardará con los cambios. ¿Quieres enviar un WhatsApp al cliente informando de
          la modificación?
        </p>
        <div className="flex flex-col gap-2">
          <Button
            type="button"
            variant="solid"
            size="sm"
            disabled={busy}
            className="w-full"
            onClick={() => void onNotify()}
          >
            {busy ? 'Guardando…' : 'Guardar y avisar por WhatsApp'}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            className="w-full"
            onClick={() => void onSaveWithoutNotify()}
          >
            Guardar sin avisar
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            className="w-full border-transparent text-charcoal-muted hover:text-charcoal"
            onClick={onClose}
          >
            Volver a la cita
          </Button>
        </div>
      </div>
    </div>
  )
}
