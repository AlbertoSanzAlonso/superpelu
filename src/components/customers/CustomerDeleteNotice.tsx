import { isColorGroupWashRow } from '@/lib/booking/occupancy'
import { formatDisplayDate } from '@/lib/core/dates'
import { formatCustomerDisplayName } from '@/lib/customer/name'
import { formatPhoneDisplay } from '@/lib/customer/phone'
import type { Appointment } from '@/types/booking'
import type { Customer, CustomerMember } from '@/types/customers'

const MAX_APPOINTMENTS = 6

type Props = {
  titularName: string
  phone: string
  members: Pick<CustomerMember, 'firstName' | 'lastName'>[]
  appointments: Pick<
    Appointment,
    'date' | 'startTime' | 'customerName' | 'serviceName' | 'status' | 'colorGroupRole' | 'customerMemberId'
  >[]
  /** La ficha no pudo cargarse: no afirmar que no hay citas. */
  appointmentsUnknown?: boolean
}

export function CustomerDeleteNotice({
  titularName,
  phone,
  members,
  appointments,
  appointmentsUnknown = false,
}: Props) {
  const memberNames = members
    .map((member) => formatCustomerDisplayName(member.firstName, member.lastName))
    .filter(Boolean)
  const kept = appointments.filter(
    (appointment) =>
      appointment.status !== 'cancelled' && !isColorGroupWashRow(appointment.colorGroupRole),
  )
  const shown = kept.slice(0, MAX_APPOINTMENTS)
  const hiddenCount = kept.length - shown.length

  if (memberNames.length === 0 && kept.length === 0 && !appointmentsUnknown) {
    return (
      <p>
        Se quitará la ficha del listado de clientes. Las citas ya registradas se conservan en la
        agenda.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      <p>
        Se elimina la ficha de {titularName || 'este cliente'} ({formatPhoneDisplay(phone)}). Este
        número deja de tener cliente.
      </p>
      {memberNames.length > 0 ? (
        <div>
          <p>
            Estos miembros se borran con el titular. No se quedan en la base de datos, ni con este
            número ni con otro:
          </p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {memberNames.map((name, index) => (
              <li key={`${name}-${index}`}>{name}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p>No hay miembros en esta ficha.</p>
      )}
      {appointmentsUnknown ? (
        <p>No se pudo comprobar el historial. Las citas que ya existan se conservan en la agenda.</p>
      ) : kept.length > 0 ? (
        <div>
          <p>
            Estas citas sí se quedan, con este teléfono y el nombre de quien figura en cada una:
          </p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {shown.map((appointment, index) => (
              <li key={`${appointment.date}-${appointment.startTime}-${index}`}>
                <span className="capitalize">{formatDisplayDate(appointment.date)}</span>
                {' · '}
                {appointment.startTime.slice(0, 5)}
                {' · '}
                {appointment.customerName}
                {appointment.customerMemberId ? ' (miembro)' : ''}
                {' · '}
                {appointment.serviceName}
              </li>
            ))}
          </ul>
          {hiddenCount > 0 && (
            <p className="mt-1 text-charcoal-muted">
              y {hiddenCount} cita{hiddenCount === 1 ? '' : 's'} más.
            </p>
          )}
        </div>
      ) : (
        <p>No hay citas que conservar.</p>
      )}
    </div>
  )
}

export function BulkCustomerDeleteNotice({
  count,
  customers,
}: {
  count: number
  customers: Customer[]
}) {
  const withMembers = customers.filter((customer) => (customer.members ?? []).length > 0)
  const shown = withMembers.slice(0, 8)
  const hidden = withMembers.length - shown.length

  return (
    <div className="space-y-3">
      <p>
        Se eliminarán {count} ficha{count === 1 ? '' : 's'} de cliente. Las citas se conservan en la
        agenda, con el teléfono y el nombre de cada cita.
      </p>
      {shown.length > 0 && (
        <div>
          <p>
            Los miembros se borran con su titular. No se quedan como clientes, ni con ese número ni
            con otro:
          </p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {shown.map((customer) => (
              <li key={customer.phone}>
                {formatCustomerDisplayName(customer.firstName, customer.lastName)}
                {': '}
                {(customer.members ?? [])
                  .map((member) => formatCustomerDisplayName(member.firstName, member.lastName))
                  .filter(Boolean)
                  .join(', ')}
              </li>
            ))}
          </ul>
          {hidden > 0 && (
            <p className="mt-1 text-charcoal-muted">
              y {hidden} ficha{hidden === 1 ? '' : 's'} más con miembros.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
