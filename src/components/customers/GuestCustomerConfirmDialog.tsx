import { ConfirmDialog } from '@/components/ui/ConfirmDialog'

type Props = {
  open: boolean
  onAccept: () => void
  onDecline: () => void
}

export function GuestCustomerConfirmDialog({ open, onAccept, onDecline }: Props) {
  return (
    <ConfirmDialog
      open={open}
      title="Reservar sin teléfono"
      message="No has indicado un móvil. La cita se guardará con el nombre que has puesto, pero no se creará una ficha de cliente en el listado. ¿Quieres continuar así?"
      confirmLabel="Sí, reservar sin teléfono"
      cancelLabel="No, volver"
      onConfirm={onAccept}
      onClose={onDecline}
    />
  )
}
