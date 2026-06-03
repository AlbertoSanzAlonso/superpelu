import { Button } from '@/components/ui/Button'
import { typography } from '@/styles/typography'

export type WhatsAppNotifyContext = 'edit' | 'move' | 'cancel'

type Props = {
  open: boolean
  context?: WhatsAppNotifyContext
  busy?: boolean
  onClose: () => void
  onNotify: () => void | Promise<void>
  onSaveWithoutNotify: () => void | Promise<void>
}

const copy: Record<
  WhatsAppNotifyContext,
  {
    body: string
    primary: string
    secondary: string
    busyPrimary: string
    back: string
  }
> = {
  edit: {
    body: 'Se guardarán los cambios de día, hora o profesional. ¿Quieres enviar un WhatsApp al cliente informando de la modificación?',
    primary: 'Guardar y avisar por WhatsApp',
    secondary: 'Guardar sin avisar',
    busyPrimary: 'Guardando…',
    back: 'Volver a la cita',
  },
  move: {
    body: 'Se guardarán los cambios de horario o profesional. ¿Quieres enviar un WhatsApp al cliente informando de la modificación?',
    primary: 'Guardar y avisar por WhatsApp',
    secondary: 'Guardar sin avisar',
    busyPrimary: 'Guardando…',
    back: 'Seguir moviendo citas',
  },
  cancel: {
    body: 'La cita quedará cancelada y el salón recibirá un aviso por email. ¿Quieres enviar un WhatsApp al cliente informando de la cancelación?',
    primary: 'Cancelar y avisar por WhatsApp',
    secondary: 'Cancelar sin avisar',
    busyPrimary: 'Cancelando…',
    back: 'Volver',
  },
}

export function WhatsAppNotifyDialog({
  open,
  context = 'edit',
  busy = false,
  onClose,
  onNotify,
  onSaveWithoutNotify,
}: Props) {
  if (!open) return null

  const text = copy[context]

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
        <p className={`${typography.body} mb-5 text-sm`}>{text.body}</p>
        <div className="flex flex-col gap-2">
          <Button
            type="button"
            variant="solid"
            size="sm"
            disabled={busy}
            className="w-full"
            onClick={() => void onNotify()}
          >
            {busy ? text.busyPrimary : text.primary}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            className="w-full"
            onClick={() => void onSaveWithoutNotify()}
          >
            {text.secondary}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            className="w-full border-transparent text-charcoal-muted hover:text-charcoal"
            onClick={onClose}
          >
            {text.back}
          </Button>
        </div>
      </div>
    </div>
  )
}
