import type { Appointment } from '@/types/booking'
import { formatAppointmentTimeRange, isColorGroupWashRow } from '@/lib/booking/occupancy'
import { customerAppointmentStatusLabel } from '@/lib/customer/appointmentStatus'
import { appointmentOriginLabel } from '@/lib/customer/historyFilters'
import { formatDisplayDate } from '@/lib/core/dates'
import { formatPhoneDisplay } from '@/lib/customer/phone'
import { truncateNotesPreview } from '@/lib/core/notes'
import { typography } from '@/styles/typography'

type Props = {
  appointments: Appointment[]
  totalAppointments: Appointment[]
  loading: boolean
  showCustomer?: boolean
  onSelect: (apt: Appointment) => void
}

export function CustomerAppointmentHistoryList({
  appointments,
  totalAppointments,
  loading,
  showCustomer = false,
  onSelect,
}: Props) {
  if (loading) {
    return <p className={`${typography.caption} p-8 text-center`}>Cargando historial…</p>
  }

  if (appointments.length === 0) {
    return (
      <p className={`${typography.body} p-8 text-center`}>
        {totalAppointments.length === 0
          ? 'Sin citas registradas.'
          : 'Ninguna cita coincide con los filtros.'}
      </p>
    )
  }

  return (
    <ul className="divide-y divide-gold/10">
      {appointments.map((apt) => {
        const notesPreview = truncateNotesPreview(apt.notes)
        const statusLabel = customerAppointmentStatusLabel(apt)
        const originLabel = appointmentOriginLabel(apt.origin)
        return (
          <li key={apt.id}>
            <button
              type="button"
              onClick={() => onSelect(apt)}
              className="flex w-full cursor-pointer flex-col gap-1 px-4 py-4 text-left transition-colors hover:bg-gold/5 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
            >
              <div className="min-w-0 flex-1">
                {showCustomer && (
                  <p className="font-medium text-charcoal">{apt.customerName}</p>
                )}
                {showCustomer && apt.customerPhone && (
                  <p className={`${typography.caption} tabular-nums text-charcoal-muted`}>
                    {formatPhoneDisplay(apt.customerPhone)}
                  </p>
                )}
                <p
                  className={`font-medium capitalize ${showCustomer ? 'mt-0.5 text-sm text-charcoal-muted' : ''}`}
                >
                  {formatDisplayDate(apt.date)}
                </p>
                <p className="tabular-nums text-sm text-charcoal-muted">
                  {formatAppointmentTimeRange(
                    apt.serviceId,
                    apt.startTime,
                    apt.durationMinutes,
                    'es',
                    { colorGroupRole: apt.colorGroupRole },
                  )}
                </p>
                {notesPreview && (
                  <p className={`${typography.caption} mt-1 line-clamp-2 text-charcoal-muted`}>
                    {notesPreview}
                  </p>
                )}
              </div>
              <div className="shrink-0 sm:text-right">
                <p className="font-medium">{apt.serviceName}</p>
                {apt.staffName && (
                  <p className={`${typography.caption} mt-0.5`}>{apt.staffName}</p>
                )}
                {originLabel && (
                  <p className={`${typography.caption} mt-0.5 text-charcoal-muted`}>{originLabel}</p>
                )}
                {statusLabel && (
                  <p
                    className={`${typography.caption} mt-0.5 ${
                      apt.status === 'cancelled'
                        ? 'text-charcoal-muted line-through'
                        : apt.status === 'no_show'
                          ? 'text-amber-900/80'
                          : statusLabel === 'Pendiente' || statusLabel === 'Aún no ha llegado'
                            ? 'text-gold'
                            : 'text-charcoal-muted'
                    }`}
                  >
                    {statusLabel}
                  </p>
                )}
              </div>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

/** Citas visibles en listado (sin filas de lavado enlazadas). */
export function countListableAppointments(appointments: Appointment[]): number {
  return appointments.filter((a) => !isColorGroupWashRow(a.colorGroupRole)).length
}
