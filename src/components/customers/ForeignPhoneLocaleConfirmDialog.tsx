import { useEffect, useId, useState } from 'react'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { typography } from '@/styles/typography'

type Props = {
  open: boolean
  onAccept: (dontAskAgain?: boolean) => void
  onDecline: (dontAskAgain?: boolean) => void
  title?: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  /** Agenda: casilla para no volver a mostrar este aviso en este navegador. */
  allowDontAskAgain?: boolean
}

export function ForeignPhoneLocaleConfirmDialog({
  open,
  onAccept,
  onDecline,
  title = 'Número extranjero',
  message = 'Este teléfono no es de España. ¿Quieres cambiar el idioma del cliente a inglés? Los WhatsApp y avisos irán en inglés.',
  confirmLabel = 'Sí, usar inglés',
  cancelLabel = 'No, dejar español',
  allowDontAskAgain = false,
}: Props) {
  const checkboxId = useId()
  const [dontAskAgain, setDontAskAgain] = useState(false)

  useEffect(() => {
    if (!open) setDontAskAgain(false)
  }, [open])

  return (
    <ConfirmDialog
      open={open}
      title={title}
      message={
        <div className="space-y-4">
          <p>{message}</p>
          {allowDontAskAgain && (
            <label
              htmlFor={checkboxId}
              className={`${typography.caption} flex cursor-pointer items-start gap-2 text-charcoal`}
            >
              <input
                id={checkboxId}
                type="checkbox"
                checked={dontAskAgain}
                onChange={(e) => setDontAskAgain(e.target.checked)}
                className="mt-0.5 size-4 shrink-0 accent-gold"
              />
              <span>No volver a preguntar en la agenda</span>
            </label>
          )}
        </div>
      }
      confirmLabel={confirmLabel}
      cancelLabel={cancelLabel}
      onConfirm={() => onAccept(allowDontAskAgain ? dontAskAgain : undefined)}
      onClose={() => onDecline(allowDontAskAgain ? dontAskAgain : undefined)}
    />
  )
}
