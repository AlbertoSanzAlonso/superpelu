import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Input'
import { formatDisplayDate } from '@/lib/core/dates'
import { typography } from '@/styles/typography'

type Props = {
  open: boolean
  date: string
  staffName: string
  groups: { startTime: string; endTime: string }[]
  busy?: boolean
  onClose: () => void
  onConfirm: (note?: string) => void
}

/** Modal ligero para observaciones al crear bloqueos (vista profesional). */
export function BlockCreateNoteModal({
  open,
  date,
  staffName,
  groups,
  busy = false,
  onClose,
  onConfirm,
}: Props) {
  const [note, setNote] = useState('')

  useEffect(() => {
    if (!open) return
    setNote('')
  }, [open])

  if (!open) return null

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = note.trim()
    onConfirm(trimmed || undefined)
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-charcoal/45 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md border border-gold/30 bg-cream p-5 shadow-lg sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className={`${typography.h3} mb-1 text-gold`}>Bloquear horario</h2>
        <p className={`${typography.caption} mb-4 capitalize`}>
          {staffName} · {formatDisplayDate(date)}
          {groups.length === 1
            ? ` · ${groups[0].startTime}–${groups[0].endTime}`
            : ` · ${groups.length} tramos`}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Textarea
            id="block-create-note"
            label="Observaciones (opcional)"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Motivo del bloqueo, avisos internos…"
          />

          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="solid" size="sm" disabled={busy}>
              {busy ? 'Bloqueando…' : 'Confirmar bloqueo'}
            </Button>
            <Button type="button" variant="outline" size="sm" disabled={busy} onClick={onClose}>
              Cancelar
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
