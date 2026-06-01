import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Input'
import { formatDisplayDate } from '@/lib/dates'
import type { BlockSeriesMeta } from '@/types/blocks'
import type { DayScheduleBlock } from '@/types/booking'
import { typography } from '@/styles/typography'

type Props = {
  open: boolean
  date: string
  staffName: string
  block: DayScheduleBlock
  series: BlockSeriesMeta | null
  seriesLoading?: boolean
  busy?: boolean
  onClose: () => void
  onSave: (note: string, mode: 'single' | 'series') => void | Promise<void>
  onDelete: (mode: 'single' | 'series') => void | Promise<void>
}

export function BlockDetailModal({
  open,
  date,
  staffName,
  block,
  series,
  seriesLoading = false,
  busy = false,
  onClose,
  onSave,
  onDelete,
}: Props) {
  const [note, setNote] = useState('')
  const [saveMode, setSaveMode] = useState<'single' | 'series'>('single')
  const [deleteMode, setDeleteMode] = useState<'single' | 'series'>('single')

  const hasSeries = series != null && series.count > 1 && series.seriesId != null

  useEffect(() => {
    if (!open) return
    setNote(block.note ?? '')
    setSaveMode('single')
    setDeleteMode('single')
  }, [open, block.id, block.note])

  if (!open) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await onSave(note, hasSeries ? saveMode : 'single')
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-charcoal/45 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="block-detail-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md border border-gold/30 bg-cream p-5 shadow-lg sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="block-detail-title" className={`${typography.h3} mb-1 text-gold`}>
          Bloqueo de agenda
        </h2>
        <p className={`${typography.caption} mb-4 capitalize`}>
          {staffName} · {formatDisplayDate(date)} · {block.startTime}–{block.endTime}
        </p>

        {seriesLoading && (
          <p className={`${typography.caption} mb-3 text-charcoal-muted`}>Cargando serie…</p>
        )}

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <Textarea
            id="block-note"
            label="Observaciones"
            rows={4}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Motivo del bloqueo, avisos internos…"
          />

          {hasSeries && (
            <fieldset className="space-y-2 border border-gold/20 p-3">
              <legend className={`${typography.label} px-1`}>Al guardar observaciones</legend>
              <label className="flex cursor-pointer items-start gap-2 text-sm">
                <input
                  type="radio"
                  name="block-save-mode"
                  checked={saveMode === 'single'}
                  onChange={() => setSaveMode('single')}
                  className="mt-1 accent-gold"
                />
                <span>Solo este día ({formatDisplayDate(date)})</span>
              </label>
              <label className="flex cursor-pointer items-start gap-2 text-sm">
                <input
                  type="radio"
                  name="block-save-mode"
                  checked={saveMode === 'series'}
                  onChange={() => setSaveMode('series')}
                  className="mt-1 accent-gold"
                />
                <span>Toda la serie ({series!.count} días)</span>
              </label>
            </fieldset>
          )}

          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="solid" size="sm" disabled={busy}>
              {busy ? 'Guardando…' : 'Guardar'}
            </Button>
            <Button type="button" variant="outline" size="sm" disabled={busy} onClick={onClose}>
              Cerrar
            </Button>
          </div>
        </form>

        <div className="mt-6 border-t border-gold/20 pt-4">
          <p className={`${typography.label} mb-2 text-charcoal-muted`}>Quitar bloqueo</p>
          {hasSeries && (
            <fieldset className="mb-3 space-y-2">
              <label className="flex cursor-pointer items-start gap-2 text-sm">
                <input
                  type="radio"
                  name="block-delete-mode"
                  checked={deleteMode === 'single'}
                  onChange={() => setDeleteMode('single')}
                  className="mt-1 accent-gold"
                />
                <span>Solo este día</span>
              </label>
              <label className="flex cursor-pointer items-start gap-2 text-sm">
                <input
                  type="radio"
                  name="block-delete-mode"
                  checked={deleteMode === 'series'}
                  onChange={() => setDeleteMode('series')}
                  className="mt-1 accent-gold"
                />
                <span>Toda la serie ({series!.count} días)</span>
              </label>
            </fieldset>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            className="border-red-300 text-red-800 hover:bg-red-50"
            onClick={() => void onDelete(hasSeries ? deleteMode : 'single')}
          >
            Quitar bloqueo
          </Button>
        </div>
      </div>
    </div>
  )
}
