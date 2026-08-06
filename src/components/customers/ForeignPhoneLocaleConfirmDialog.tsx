import { ConfirmDialog } from '@/components/ui/ConfirmDialog'

type Props = {
  open: boolean
  onAccept: () => void
  onDecline: () => void
  title?: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
}

export function ForeignPhoneLocaleConfirmDialog({
  open,
  onAccept,
  onDecline,
  title = 'Número extranjero',
  message = 'Este teléfono no es de España. ¿Quieres cambiar el idioma del cliente a inglés? Los WhatsApp y avisos irán en inglés.',
  confirmLabel = 'Sí, usar inglés',
  cancelLabel = 'No, dejar español',
}: Props) {
  return (
    <ConfirmDialog
      open={open}
      title={title}
      message={message}
      confirmLabel={confirmLabel}
      cancelLabel={cancelLabel}
      onConfirm={onAccept}
      onClose={onDecline}
    />
  )
}
