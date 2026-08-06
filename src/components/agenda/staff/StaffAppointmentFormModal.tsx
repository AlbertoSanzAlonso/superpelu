import { useEffect, useId, useRef, useState } from 'react'
import type { AppointmentDraft } from '@/components/agenda/staff/types'
import { StaffAppointmentFormFields } from '@/components/agenda/staff/StaffAppointmentFormFields'
import { ClockTimeInput } from '@/components/agenda/ClockTimeInput'
import type { BookableService } from '@/types/booking'
import { typography } from '@/styles/typography'

type Props = {
  open: boolean
  date: string
  staffName?: string
  editingId: string | null
  draft: AppointmentDraft
  services: BookableService[]
  slots: string[]
  slotsOverHours?: string[]
  serviceSlots?: string[][]
  serviceAlternativeStaff?: ({ id: string; name: string } | null)[]
  /** Lista de profesionales para el selector por tratamiento. */
  staffList?: { id: string; name: string }[]
  /** Profesional por defecto al crear cita (p. ej. columna o selector de agenda). */
  defaultStaffId?: string
  onDraftChange: (patch: Partial<AppointmentDraft>) => void
  onSubmit: (e: React.FormEvent) => void
  onClose: () => void
  onCancelAppointment?: () => void
  onMarkNoShow?: () => void
  canMarkNoShow?: boolean
  isNoShow?: boolean
  adminToken?: string
  error?: string
}

export function StaffAppointmentFormModal({
  open,
  date,
  staffName,
  editingId,
  draft,
  services,
  slots,
  slotsOverHours = [],
  serviceSlots,
  serviceAlternativeStaff,
  staffList,
  defaultStaffId,
  onDraftChange,
  onSubmit,
  onClose,
  onCancelAppointment,
  onMarkNoShow,
  canMarkNoShow,
  isNoShow,
  adminToken,
  error,
}: Props) {
  const [timeOpen, setTimeOpen] = useState(false)
  const timeWrapRef = useRef<HTMLDivElement>(null)
  const timePanelId = useId()

  useEffect(() => {
    if (!open) setTimeOpen(false)
  }, [open])

  useEffect(() => {
    if (!timeOpen) return
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null
      if (target && timeWrapRef.current && !timeWrapRef.current.contains(target)) {
        setTimeOpen(false)
      }
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setTimeOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('touchstart', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('touchstart', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [timeOpen])

  if (!open) return null

  const title = editingId ? 'Editar cita' : 'Nueva cita'
  const hint = editingId
    ? 'Modifica los datos y guarda.'
    : 'Completa especialidad, tratamiento y datos del cliente.'
  const displayTime = draft.startTime || '—'

  return (
    <div
      className="fixed inset-0 z-50 flex bg-charcoal/45 sm:items-center sm:justify-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="appointment-form-modal-title"
      onClick={onClose}
    >
      <div
        className="flex h-dvh w-full max-w-lg flex-col overflow-hidden bg-cream sm:h-auto sm:max-h-[92vh] sm:max-w-5xl sm:border sm:border-gold/30 sm:shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-gold/15 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-5 sm:py-3 sm:pt-3">
          <div>
            <h2
              id="appointment-form-modal-title"
              className={`${typography.h3} flex flex-wrap items-baseline gap-x-2 text-gold`}
            >
              <span>{title}</span>
              <div ref={timeWrapRef} className="relative inline-flex items-baseline">
                <button
                  type="button"
                  aria-expanded={timeOpen}
                  aria-controls={timePanelId}
                  onClick={() => setTimeOpen((prev) => !prev)}
                  className="cursor-pointer font-normal tabular-nums text-charcoal-muted underline-offset-4 hover:text-charcoal hover:underline"
                  title="Cambiar hora de la cita"
                >
                  · {displayTime}
                </button>
                {timeOpen && (
                  <div
                    id={timePanelId}
                    role="dialog"
                    aria-label="Editar hora de la cita"
                    className="absolute left-0 top-full z-40 mt-2 border border-gold/30 bg-cream p-3 shadow-md"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <p className={`${typography.label} mb-2 text-[10px] text-gold`}>Hora</p>
                    <ClockTimeInput
                      value={draft.startTime}
                      onChange={(time) => {
                        onDraftChange({ startTime: time, serviceStartTimes: [] })
                      }}
                      defaultTime={draft.startTime || '10:00'}
                      required
                    />
                  </div>
                )}
              </div>
            </h2>
            {staffName && <p className={`${typography.caption} mt-0.5`}>{staffName}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 cursor-pointer border border-gold/30 px-2.5 py-1.5 text-sm text-charcoal-muted hover:border-gold"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        {error && (
          <div
            className="shrink-0 border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800 sm:px-5"
            role="alert"
          >
            {error}
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 pb-[max(1rem,env(safe-area-inset-bottom))] scrollbar-premium sm:px-5 sm:py-4 sm:pb-4">
          <StaffAppointmentFormFields
            compact
            hideVisitTime
            date={date}
            editingId={editingId}
            draft={draft}
            services={services}
            slots={slots}
            slotsOverHours={slotsOverHours}
            serviceSlots={serviceSlots}
            serviceAlternativeStaff={serviceAlternativeStaff}
            staffList={staffList}
            defaultStaffId={defaultStaffId}
            onDraftChange={onDraftChange}
            onSubmit={onSubmit}
            onClose={onClose}
            onCancelAppointment={onCancelAppointment}
            onMarkNoShow={onMarkNoShow}
            canMarkNoShow={canMarkNoShow}
            isNoShow={isNoShow}
            hint={hint}
            adminToken={adminToken}
          />
        </div>
      </div>
    </div>
  )
}
