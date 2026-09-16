import { Button } from '@/components/ui/Button'
import { typography } from '@/styles/typography'

type Props = {
  open: boolean
  notes: string
  onAccept: () => void
}

/** Aviso obligatorio: hay que pulsar Aceptar (no se cierra con el fondo). */
export function CustomerNotesWarningModal({ open, notes, onAccept }: Props) {
  const trimmed = notes.trim()
  if (!open || !trimmed) return null

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-charcoal/55 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="customer-notes-warning-title"
    >
      <div
        className="w-full max-w-md border border-amber-500/40 bg-cream p-5 shadow-lg sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="customer-notes-warning-title" className={`${typography.h3} mb-2 text-amber-800`}>
          Observaciones del cliente
        </h2>
        <p className={`${typography.caption} mb-3 text-charcoal-muted`}>
          Este cliente tiene anotaciones en su ficha. Léelas antes de continuar.
        </p>
        <div
          className={`${typography.body} mb-5 max-h-[40vh] overflow-y-auto whitespace-pre-wrap rounded border border-amber-500/25 bg-amber-50/80 px-3 py-2.5 text-sm text-charcoal`}
        >
          {trimmed}
        </div>
        <Button type="button" variant="solid" size="sm" className="w-full" onClick={onAccept}>
          Aceptar
        </Button>
      </div>
    </div>
  )
}
