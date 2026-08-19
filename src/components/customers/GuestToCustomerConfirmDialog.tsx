import { ConfirmDialog } from '@/components/ui/ConfirmDialog'

type Props = {
  open: boolean
  onAccept: () => void
  onDecline: () => void
}

export function GuestToCustomerConfirmDialog({ open, onAccept, onDecline }: Props) {
  return (
    <ConfirmDialog
      open={open}
      title="Guardar cliente con teléfono"
      message="Esta cita se creó sin ficha de cliente. Al añadir un móvil se guardará en el listado de clientes con los datos que has indicado. ¿Quieres continuar?"
      confirmLabel="Sí, crear ficha"
      cancelLabel="No, volver"
      onConfirm={onAccept}
      onClose={onDecline}
    />
  )
}
