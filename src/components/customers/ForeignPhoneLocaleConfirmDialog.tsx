import { ConfirmDialog } from '@/components/ui/ConfirmDialog'

type Props = {
  open: boolean
  onAccept: () => void
  onDecline: () => void
}

export function ForeignPhoneLocaleConfirmDialog({ open, onAccept, onDecline }: Props) {
  return (
    <ConfirmDialog
      open={open}
      title="Número extranjero"
      message="Este teléfono no es de España. ¿Quieres cambiar el idioma del cliente a inglés? Los WhatsApp y avisos irán en inglés."
      confirmLabel="Sí, usar inglés"
      cancelLabel="No, dejar español"
      onConfirm={onAccept}
      onClose={onDecline}
    />
  )
}
