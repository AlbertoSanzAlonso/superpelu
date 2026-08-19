import { useCallback, useEffect, useId, useRef, useState } from 'react'
import type { AppointmentDraft } from '@/components/agenda/staff/types'
import { EMPTY_APPOINTMENT_DRAFT } from '@/components/agenda/staff/types'
import { StaffAppointmentFormFields } from '@/components/agenda/staff/StaffAppointmentFormFields'
import { ClockTimeInput } from '@/components/agenda/ClockTimeInput'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
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
  const [unsavedWarningOpen, setUnsavedWarningOpen] = useState(false)
  const draftAtOpen = useRef<string>(JSON.stringify(EMPTY_APPOINTMENT_DRAFT))

  useEffect(() => {
    if (open) {
      draftAtOpen.current = JSON.stringify(draft)
    }
    // Solo al abrir
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (!open) { setTimeOpen(false); setUnsavedWarningOpen(false) }
  }, [open])

  const isDirty = draftAtOpen.current !== JSON.stringify(draft)

  const handleClose = useCallback(() => {
    if (isDirty) {
      setUnsavedWarningOpen(true)
    } else {
      onClose()
    }
  }, [isDirty, onClose])

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
      onClick={handleClose}
    >
      <div
        className="flex h-dvh w-full max-w-lg flex-col overflow-hidden bg-cream sm:h-auto sm:max-h-[92vh] sm:max-w-5xl sm:border sm:border-gold/30 sm:shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-gold/15 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-5 sm:py-3 sm:pt-3">
          <div>
            <h2
              id="appointment-form-modal-title"
              className={`${typography.h3} flex flex-wrap items-center gap-x-2 gap-y-1 text-gold`}
            >
              <span>{title}</span>
              <div ref={timeWrapRef} className="relative inline-flex items-center">
                <button
                  type="button"
                  aria-expanded={timeOpen}
                  aria-controls={timePanelId}
                  onClick={() => setTimeOpen((prev) => !prev)}
                  className={`inline-flex cursor-pointer items-center gap-1.5 border px-2 py-0.5 text-base font-normal tabular-nums transition-colors ${
                    timeOpen
                      ? 'border-gold bg-gold/10 text-charcoal'
                      : 'border-gold/40 text-charcoal-muted hover:border-gold hover:bg-gold/5 hover:text-charcoal'
                  }`}
                  title="Cambiar hora de la cita"
                >
                  <span>{displayTime}</span>
                  <span className="text-[10px] text-gold" aria-hidden>
                    {timeOpen ? '▲' : '▼'}
                  </span>
                </button>
                {timeOpen && (
                  <div
                    id={timePanelId}
                    role="dialog"
                    aria-label="Editar hora de la cita"
                    className="absolute left-0 top-full z-40 mt-2 min-w-[12rem] border border-gold/30 bg-cream p-3 shadow-md"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <p className={`${typography.label} mb-2 text-[10px] text-gold`}>
                      Cambiar hora
                    </p>
                    <ClockTimeInput
                      labeled
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
            onClick={handleClose}
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
      <ConfirmDialog
        open={unsavedWarningOpen}
        title="¿Salir sin guardar?"
        message="Tienes cambios sin guardar en esta cita."
        confirmLabel="Guardar cambios"
        cancelLabel="Salir sin guardar"
        onClose={() => { setUnsavedWarningOpen(false); onClose() }}
        onConfirm={() => {
          setUnsavedWarningOpen(false)
          const fakeEvent = new Event('submit', { bubbles: true, cancelable: true })
          document.querySelector<HTMLFormElement>('#staff-apt-modal-form')?.dispatchEvent(fakeEvent)
        }}
      />
    </div>
  )
}
