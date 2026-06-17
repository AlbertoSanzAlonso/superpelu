import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { formatDisplayDate } from '@/lib/core/dates'
import type { SeriesDateConflict, SeriesConflictResolution } from '@/lib/api/admin'
import { typography } from '@/styles/typography'

type Props = {
  open: boolean
  conflicts: SeriesDateConflict[]
  totalDates: number
  okDatesCount: number
  onResolve: (resolutions: SeriesConflictResolution[]) => void
  onClose: () => void
}

type ResolutionState = {
  date: string
  action: 'skip' | 'reassign' | 'reschedule'
  staffId?: string
  startTime?: string
}

export function SeriesConflictModal({
  open,
  conflicts,
  totalDates,
  okDatesCount,
  onResolve,
  onClose,
}: Props) {
  const [resolutions, setResolutions] = useState<Record<string, ResolutionState>>({})
  const [currentConflictIndex, setCurrentConflictIndex] = useState(0)

  if (!open || conflicts.length === 0) return null

  const conflictDates = [...new Set(conflicts.map((c) => c.date))]
  const currentConflict = conflicts[currentConflictIndex]
  const currentDate = currentConflict?.date

  const conflictsForDate = conflicts.filter((c) => c.date === currentDate)
  const currentResolution = resolutions[currentDate!]

  function handleSkip() {
    if (!currentDate) return
    setResolutions((prev) => ({
      ...prev,
      [currentDate]: { date: currentDate, action: 'skip' },
    }))
    advanceToNextDate()
  }

  function handleReassign(staffId: string) {
    if (!currentDate) return
    setResolutions((prev) => ({
      ...prev,
      [currentDate]: { date: currentDate, action: 'reassign', staffId },
    }))
    advanceToNextDate()
  }

  function handleReschedule(startTime: string) {
    if (!currentDate) return
    setResolutions((prev) => ({
      ...prev,
      [currentDate]: { date: currentDate, action: 'reschedule', startTime },
    }))
    advanceToNextDate()
  }

  function advanceToNextDate() {
    const nextIndex = conflictDates.findIndex((d) => d === currentDate) + 1
    if (nextIndex < conflictDates.length) {
      const nextConflict = conflicts.find((c) => c.date === conflictDates[nextIndex])
      if (nextConflict) {
        setCurrentConflictIndex(conflicts.indexOf(nextConflict))
      }
    }
  }

  function handleSubmit() {
    const resolutionList: SeriesConflictResolution[] = Object.values(resolutions)
    for (const date of conflictDates) {
      if (!resolutions[date]) {
        resolutionList.push({ date, action: 'skip' })
      }
    }
    onResolve(resolutionList)
  }

  const resolvedCount = Object.keys(resolutions).length
  const allResolved = resolvedCount === conflictDates.length

  return (
    <div
      className="fixed inset-0 z-50 flex bg-charcoal/45 sm:items-center sm:justify-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="series-conflict-title"
      onClick={onClose}
    >
      <div
        className="flex h-dvh w-full max-w-lg flex-col overflow-hidden bg-cream sm:h-auto sm:max-h-[90vh] sm:max-w-2xl sm:overflow-visible sm:border sm:border-gold/30 sm:shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-gold/15 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-5 sm:py-3 sm:pt-3">
          <div>
            <h2 id="series-conflict-title" className={`${typography.h3} text-gold`}>
              Conflictos en la serie
            </h2>
            <p className={`${typography.caption} mt-0.5`}>
              {okDatesCount} de {totalDates} días sin conflicto · {conflictDates.length} días con conflicto
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 border border-gold/30 px-2.5 py-1.5 text-sm text-charcoal-muted hover:border-gold"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:flex-none sm:overflow-visible sm:px-5 sm:py-4 sm:pb-4">
          <div className="space-y-4">
            <div className="border border-gold/20 bg-gold/5 p-3">
              <p className={`${typography.label} text-charcoal`}>
                {formatDisplayDate(currentDate!)}
              </p>
              <p className={`${typography.caption} mt-1 text-charcoal-muted`}>
                {conflictsForDate.length} conflicto{conflictsForDate.length > 1 ? 's' : ''} en este día
              </p>
            </div>

            {conflictsForDate.map((conflict, idx) => (
              <div key={idx} className="space-y-2 border-b border-gold/10 pb-3">
                <p className={`${typography.caption} font-medium text-charcoal`}>
                  {conflict.serviceName} · {conflict.staffName} a las {conflict.idealStartTime}
                </p>

                {conflict.availableStaff.length > 0 && (
                  <div>
                    <p className={`${typography.caption} mb-1 text-charcoal-muted`}>
                      Traspasar a otra compañera:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {conflict.availableStaff.map((staff) => (
                        <button
                          key={staff.id}
                          type="button"
                          onClick={() => handleReassign(staff.id)}
                          className="border border-gold/40 bg-cream px-3 py-1.5 text-xs text-charcoal transition-colors hover:border-gold hover:bg-gold/10"
                        >
                          {staff.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {conflict.availableSlots.length > 0 && (
                  <div>
                    <p className={`${typography.caption} mb-1 text-charcoal-muted`}>
                      Cambiar hora ese día:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {conflict.availableSlots.slice(0, 8).map((slot) => (
                        <button
                          key={slot}
                          type="button"
                          onClick={() => handleReschedule(slot)}
                          className="border border-gold/40 bg-cream px-3 py-1.5 text-xs tabular-nums text-charcoal transition-colors hover:border-gold hover:bg-gold/10"
                        >
                          {slot}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {conflict.availableStaff.length === 0 && conflict.availableSlots.length === 0 && (
                  <p className={`${typography.caption} text-red-600`}>
                    No hay disponibilidad alternativa para este tratamiento
                  </p>
                )}
              </div>
            ))}

            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={handleSkip}>
                Saltar este día
              </Button>
            </div>

            {currentResolution && (
              <div className="border border-green-300 bg-green-50 p-2">
                <p className={`${typography.caption} text-green-800`}>
                  {currentResolution.action === 'skip' && 'Se saltará este día'}
                  {currentResolution.action === 'reassign' && `Se traspasará a ${currentResolution.staffId}`}
                  {currentResolution.action === 'reschedule' && `Se cambiará a las ${currentResolution.startTime}`}
                </p>
              </div>
            )}

            <div className="mt-4 flex flex-wrap gap-2 border-t border-gold/15 pt-3">
              <Button
                type="button"
                variant="solid"
                size="sm"
                onClick={handleSubmit}
                disabled={!allResolved}
              >
                {allResolved ? 'Crear serie con ajustes' : `Resuelve ${conflictDates.length - resolvedCount} conflicto(s)`}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={onClose}>
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
