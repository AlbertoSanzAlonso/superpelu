import { forwardRef } from 'react'
import { StaffAppointmentFormFields } from '@/components/agenda/staff/StaffAppointmentFormFields'
import type { AppointmentDraft } from '@/components/agenda/staff/types'
import type { BookableService } from '@/types/booking'
import { typography } from '@/styles/typography'

type Props = {
  id?: string
  open: boolean
  onOpenChange: (open: boolean) => void
  editingId: string | null
  draft: AppointmentDraft
  services: BookableService[]
  slots: string[]
  onDraftChange: (patch: Partial<AppointmentDraft>) => void
  onSubmit: (e: React.FormEvent) => void
  onCancel: () => void
  onCancelAppointment?: () => void
}

function Chevron({ expanded }: { expanded: boolean }) {
  return (
    <svg
      className={`h-5 w-5 shrink-0 text-gold transition-transform ${expanded ? 'rotate-180' : ''}`}
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden
    >
      <path
        fillRule="evenodd"
        d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
        clipRule="evenodd"
      />
    </svg>
  )
}

export const StaffAppointmentFormCollapsible = forwardRef<HTMLElement, Props>(
  function StaffAppointmentFormCollapsible(
    {
      id = 'staff-appointment-form',
      open,
      onOpenChange,
      editingId,
      draft,
      services,
      slots,
      onDraftChange,
      onSubmit,
      onCancel,
      onCancelAppointment,
    },
    ref,
  ) {
    const title = editingId ? 'Editar cita' : 'Nueva cita'

    function handleToggle() {
      onOpenChange(!open)
    }

    function handleClose() {
      onCancel()
      onOpenChange(false)
    }

    return (
      <section
        ref={ref}
        id={id}
        className={`border transition-colors ${open ? 'border-gold bg-gold/5' : 'border-gold/25'}`}
      >
        <button
          type="button"
          onClick={handleToggle}
          aria-expanded={open}
          aria-controls={`${id}-panel`}
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-gold/5"
        >
          <span className={typography.label}>
            {title}
            {draft.startTime && !editingId && (
              <span className="ml-2 font-normal text-charcoal-muted">· {draft.startTime}</span>
            )}
          </span>
          <Chevron expanded={open} />
        </button>

        {open && (
          <div id={`${id}-panel`} className="border-t border-gold/15 p-4">
            <StaffAppointmentFormFields
              editingId={editingId}
              draft={draft}
              services={services}
              slots={slots}
              onDraftChange={onDraftChange}
              onSubmit={onSubmit}
              onClose={handleClose}
              onCancelAppointment={onCancelAppointment}
              hint={
                editingId
                  ? 'Modifica los datos y guarda.'
                  : 'Rellena los datos o elige un hueco en la grilla y pulsa «Crear cita».'
              }
            />
          </div>
        )}
      </section>
    )
  },
)
