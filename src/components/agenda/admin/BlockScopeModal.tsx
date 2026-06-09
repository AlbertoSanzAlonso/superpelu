import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Input'
import { formatDisplayDate } from '@/lib/core/dates'
import type { BlockScope } from '@/types/blocks'
import { typography } from '@/styles/typography'

type Props = {
  open: boolean
  anchorDate: string
  /** Un tramo o varios (se aplica el mismo alcance a cada uno). */
  groups: { startTime: string; endTime: string }[]
  staffName: string
  onClose: () => void
  onConfirm: (scope: BlockScope, endDate?: string, note?: string) => void
  busy?: boolean
}

export function BlockScopeModal({
  open,
  anchorDate,
  groups,
  staffName,
  onClose,
  onConfirm,
  busy = false,
}: Props) {
  const [scope, setScope] = useState<BlockScope>('single')
  const [endDate, setEndDate] = useState(anchorDate)
  const [note, setNote] = useState('')

  useEffect(() => {
    if (!open) return
    setScope('single')
    setEndDate(anchorDate)
    setNote('')
  }, [open, anchorDate])

  if (!open) return null

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = note.trim()
    onConfirm(scope, scope === 'range' ? endDate : undefined, trimmed || undefined)
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
          {staffName} · {formatDisplayDate(anchorDate)}
          {groups.length === 1
            ? ` · ${groups[0].startTime}–${groups[0].endTime}`
            : ` · ${groups.length} tramos`}
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <label className="flex cursor-pointer items-start gap-3 border border-gold/25 p-3 has-[:checked]:border-gold has-[:checked]:bg-gold/5">
            <input
              type="radio"
              name="block-scope"
              value="single"
              checked={scope === 'single'}
              onChange={() => setScope('single')}
              className="mt-1 accent-gold"
            />
            <span className="text-sm">
              <span className="font-medium">Solo este día</span>
              <span className={`${typography.caption} mt-0.5 block`}>
                El bloqueo aplica únicamente al día seleccionado.
              </span>
            </span>
          </label>

          <label className="flex cursor-pointer items-start gap-3 border border-gold/25 p-3 has-[:checked]:border-gold has-[:checked]:bg-gold/5">
            <input
              type="radio"
              name="block-scope"
              value="weekly"
              checked={scope === 'weekly'}
              onChange={() => setScope('weekly')}
              className="mt-1 accent-gold"
            />
            <span className="text-sm">
              <span className="font-medium">Permanente (cada semana)</span>
              <span className={`${typography.caption} mt-0.5 block`}>
                Mismo día de la semana y misma franja, todas las semanas.
              </span>
            </span>
          </label>

          <label className="flex cursor-pointer items-start gap-3 border border-gold/25 p-3 has-[:checked]:border-gold has-[:checked]:bg-gold/5">
            <input
              type="radio"
              name="block-scope"
              value="range"
              checked={scope === 'range'}
              onChange={() => setScope('range')}
              className="mt-1 accent-gold"
            />
            <span className="text-sm">
              <span className="font-medium">De una fecha a otra</span>
              <span className={`${typography.caption} mt-0.5 block`}>
                Repite el bloqueo en cada día laborable del rango.
              </span>
            </span>
          </label>

          {scope === 'range' && (
            <div className="pl-1">
              <label className={`${typography.label} mb-1 block`}>Hasta (incluido)</label>
              <input
                type="date"
                required
                min={anchorDate}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full border border-gold/30 bg-cream px-3 py-2 text-sm"
              />
            </div>
          )}

          <Textarea
            id="block-scope-note"
            label="Observaciones (opcional)"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Motivo del bloqueo, avisos internos…"
          />

          <div className="flex flex-wrap gap-2 pt-2">
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
