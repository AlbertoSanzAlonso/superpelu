import type { AppointmentDraft } from '@/components/agenda/staff/types'
import { StaffAppointmentFormFields } from '@/components/agenda/staff/StaffAppointmentFormFields'
import type { BookableService } from '@/types/booking'
import { typography } from '@/styles/typography'

type Props = {
  open: boolean
  staffName?: string
  editingId: string | null
  draft: AppointmentDraft
  services: BookableService[]
  slots: string[]
  onDraftChange: (patch: Partial<AppointmentDraft>) => void
  onSubmit: (e: React.FormEvent) => void
  onClose: () => void
  onCancelAppointment?: () => void
  onMarkNoShow?: () => void
  canMarkNoShow?: boolean
  isNoShow?: boolean
}

export function StaffAppointmentFormModal({
  open,
  staffName,
  editingId,
  draft,
  services,
  slots,
  onDraftChange,
  onSubmit,
  onClose,
  onCancelAppointment,
  onMarkNoShow,
  canMarkNoShow,
  isNoShow,
}: Props) {
  if (!open) return null

  const title = editingId ? 'Editar cita' : 'Nueva cita'
  const hint = editingId
    ? 'Modifica los datos y guarda.'
    : 'Completa especialidad, tratamiento y datos del cliente.'

  return (
    <div
      className="fixed inset-0 z-50 flex bg-charcoal/45 sm:items-center sm:justify-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="appointment-form-modal-title"
      onClick={onClose}
    >
      <div
        className="flex h-dvh w-full max-w-lg flex-col overflow-hidden bg-cream sm:h-auto sm:max-h-none sm:max-w-2xl sm:overflow-visible sm:border sm:border-gold/30 sm:shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-gold/15 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-5 sm:py-3 sm:pt-3">
          <div>
            <h2 id="appointment-form-modal-title" className={`${typography.h3} text-gold`}>
              {title}
              {draft.startTime && !editingId && (
                <span className="ml-2 font-normal text-charcoal-muted tabular-nums">
                  · {draft.startTime}
                </span>
              )}
            </h2>
            {staffName && <p className={`${typography.caption} mt-0.5`}>{staffName}</p>}
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
          <StaffAppointmentFormFields
            compact
            editingId={editingId}
            draft={draft}
            services={services}
            slots={slots}
            onDraftChange={onDraftChange}
            onSubmit={onSubmit}
            onClose={onClose}
            onCancelAppointment={onCancelAppointment}
            onMarkNoShow={onMarkNoShow}
            canMarkNoShow={canMarkNoShow}
            isNoShow={isNoShow}
            hint={hint}
          />
        </div>
      </div>
    </div>
  )
}
