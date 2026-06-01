import { Button } from '@/components/ui/Button'
import { formatAppointmentTimeRange, isColorGroupWashRow } from '@/lib/bookingOccupancy'
import type { DayScheduleAppointment } from '@/types/booking'
import { typography } from '@/styles/typography'

type Props = {
  id?: string
  open: boolean
  onOpenChange: (open: boolean) => void
  appointments: DayScheduleAppointment[]
  onEdit: (apt: DayScheduleAppointment) => void
  onDelete: (id: string) => void
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

export function StaffAppointmentList({
  id = 'staff-appointment-list',
  open,
  onOpenChange,
  appointments,
  onEdit,
  onDelete,
}: Props) {
  const visibleAppointments = appointments.filter((a) => !isColorGroupWashRow(a.colorGroupRole))
  const count = visibleAppointments.length

  return (
    <section
      id={id}
      className={`border transition-colors ${open ? 'border-gold bg-gold/5' : 'border-gold/25'}`}
    >
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        aria-expanded={open}
        aria-controls={`${id}-panel`}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-gold/5"
      >
        <span className={typography.label}>
          Mis citas
          {count > 0 && (
            <span className="ml-2 font-normal text-charcoal-muted">
              · {count} {count === 1 ? 'cita' : 'citas'}
            </span>
          )}
        </span>
        <Chevron expanded={open} />
      </button>

      {open && (
        <div id={`${id}-panel`} className="space-y-3 border-t border-gold/15 p-4">
          {count === 0 ? (
            <p className={typography.caption}>Sin citas este día.</p>
          ) : (
            <ul className="space-y-2">
              {visibleAppointments.map((apt) => (
                <li
                  key={apt.id}
                  className="flex flex-col gap-2 border border-gold/25 bg-cream px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium text-gold">
                      {formatAppointmentTimeRange(apt.serviceId, apt.startTime, apt.durationMinutes, 'es', {
                        colorGroupRole: apt.colorGroupRole,
                      })}
                    </p>
                    <p className="text-sm">
                      {apt.serviceName} · {apt.customerName} · {apt.customerPhone}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => onEdit(apt)}>
                      Editar
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => onDelete(apt.id)}>
                      Borrar
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}
