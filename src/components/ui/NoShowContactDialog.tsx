import { Button } from '@/components/ui/Button'
import { typography } from '@/styles/typography'

type Props = {
  open: boolean
  busy?: boolean
  onClose: () => void
  onMarkContacted: () => void | Promise<void>
  onSendWhatsApp: () => void | Promise<void>
}

export function NoShowContactDialog({
  open,
  busy = false,
  onClose,
  onMarkContacted,
  onSendWhatsApp,
}: Props) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-charcoal/45 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="no-show-dialog-title"
      onClick={busy ? undefined : onClose}
    >
      <div
        className="w-full max-w-md border border-gold/30 bg-cream p-5 shadow-lg sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="no-show-dialog-title" className={`${typography.h3} mb-2 text-gold`}>
          Inasistencia
        </h2>
        <p className={`${typography.body} mb-5 text-sm`}>
          La cita quedará registrada como inasistencia. ¿Has podido contactar con la persona o
          quieres que le enviemos un mensaje de WhatsApp?
        </p>
        <div className="flex flex-col gap-2">
          <Button
            type="button"
            variant="solid"
            size="sm"
            disabled={busy}
            className="w-full"
            onClick={() => void onSendWhatsApp()}
          >
            {busy ? 'Enviando…' : 'Enviar WhatsApp de seguimiento'}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            className="w-full"
            onClick={() => void onMarkContacted()}
          >
            Ya la he contactado
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            className="w-full border-transparent text-charcoal-muted hover:text-charcoal"
            onClick={onClose}
          >
            Volver
          </Button>
        </div>
      </div>
    </div>
  )
}
