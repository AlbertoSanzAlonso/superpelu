import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { fetchStaffAtSlot } from '@/lib/api/client'
import type { StaffMember } from '@/types/booking'
import { typography } from '@/styles/typography'

type Props = {
  open: boolean
  conflict: string | null
  date: string
  serviceIds: string[]
  startTime: string
  currentStaffId: string
  onClose: () => void
  onConfirm: () => void
  onChangeStaff: (staffId: string) => void
}

export function AppointmentAvailabilityWarningModal({
  open,
  conflict,
  date,
  serviceIds,
  startTime,
  currentStaffId,
  onClose,
  onConfirm,
  onChangeStaff,
}: Props) {
  const [availableStaff, setAvailableStaff] = useState<StaffMember[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || !date || !startTime || serviceIds.length === 0) {
      setAvailableStaff([])
      return
    }

    const filteredIds = serviceIds.filter((s) => s !== '')
    if (filteredIds.length === 0) {
      setAvailableStaff([])
      return
    }

    setLoading(true)
    fetchStaffAtSlot(date, filteredIds, startTime)
      .then((res) => {
        // Filtrar el profesional actual
        setAvailableStaff(res.staff.filter((s) => s.id !== currentStaffId))
      })
      .catch(() => setAvailableStaff([]))
      .finally(() => setLoading(false))
  }, [open, date, startTime, serviceIds, currentStaffId])

  if (!open || !conflict) return null

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-charcoal/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="availability-warning-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md border border-gold/30 bg-cream p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="availability-warning-title" className={`${typography.h3} mb-3 text-gold`}>
          Conflicto de disponibilidad
        </h2>
        <p className={`${typography.caption} mb-4 text-charcoal`}>
          {conflict}
        </p>

        {loading ? (
          <p className={`${typography.caption} mb-4 text-charcoal-muted`}>
            Buscando profesionales disponibles...
          </p>
        ) : availableStaff.length > 0 ? (
          <>
            <p className={`${typography.label} mb-2 block text-xs text-charcoal`}>
              Otros profesionales disponibles a las {startTime}:
            </p>
            <div className="mb-4 space-y-2">
              {availableStaff.map((staff) => (
                <Button
                  key={staff.id}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => onChangeStaff(staff.id)}
                >
                  {staff.name}
                </Button>
              ))}
            </div>
          </>
        ) : (
          <p className={`${typography.caption} mb-4 text-charcoal-muted`}>
            No hay otros profesionales disponibles a esa hora.
          </p>
        )}

        <div className="flex flex-col gap-2 border-t border-gold/20 pt-4">
          <Button type="button" variant="solid" size="sm" onClick={onConfirm}>
            Continuar fuera de horario
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancelar
          </Button>
        </div>
      </div>
    </div>
  )
}
