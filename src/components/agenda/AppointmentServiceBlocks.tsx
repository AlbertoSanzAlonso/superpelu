import { WashPhaseIcon } from '@/components/agenda/WashPhaseIcon'
import { COLOR_GROUP_ROLE, isColorGroupWashRow } from '@/lib/booking/occupancy'
import { appointmentBlockBarClass } from '@/lib/catalog/serviceCategoryColors'
import type { BookableService, DayScheduleAppointment } from '@/types/booking'

type Block = {
  startTime: string
  endTime: string
  serviceName: string
  serviceId: string
  categoryId: string | null
  colorGroupRole?: string | null
  staffLabel: string
  nameEn?: string
}

type Props = {
  appointment: DayScheduleAppointment
  staffName: string
  services: BookableService[]
}

export function AppointmentServiceBlocks({ appointment, staffName, services }: Props) {
  const linked = appointment.colorGroupLinked
  const colorRole = appointment.colorGroupRole === 'color'
  const washRole = appointment.colorGroupRole === 'wash'

  const blocks: Block[] = []

  if (colorRole && linked) {
    const colorEn = services.find((s) => s.id === appointment.serviceId)?.nameEn ?? ''
    const washEn = services.find((s) => s.id === linked.serviceId)?.nameEn ?? ''
    blocks.push({
      startTime: appointment.startTime,
      endTime: appointment.occupiedSlots[0]?.endTime ?? appointment.endTime,
      serviceName: appointment.serviceName,
      serviceId: appointment.serviceId,
      categoryId: appointment.categoryId,
      staffLabel: staffName,
      nameEn: colorEn,
    })
    blocks.push({
      startTime: linked.startTime,
      endTime: linked.endTime,
      serviceName: linked.serviceName,
      serviceId: linked.serviceId,
      categoryId: linked.categoryId,
      colorGroupRole: COLOR_GROUP_ROLE.wash,
      staffLabel: linked.staffName,
      nameEn: washEn,
    })
  } else if (washRole && linked) {
    const colorEn = services.find((s) => s.id === linked.serviceId)?.nameEn ?? ''
    const washEn = services.find((s) => s.id === appointment.serviceId)?.nameEn ?? ''
    blocks.push({
      startTime: linked.startTime,
      endTime: linked.endTime,
      serviceName: linked.serviceName,
      serviceId: linked.serviceId,
      categoryId: linked.categoryId,
      staffLabel: linked.staffName,
      nameEn: colorEn,
    })
    blocks.push({
      startTime: appointment.startTime,
      endTime: appointment.occupiedSlots[0]?.endTime ?? appointment.endTime,
      serviceName: appointment.serviceName,
      serviceId: appointment.serviceId,
      categoryId: appointment.categoryId,
      colorGroupRole: COLOR_GROUP_ROLE.wash,
      staffLabel: staffName,
      nameEn: washEn,
    })
  } else {
    const serviceEn = services.find((s) => s.id === appointment.serviceId)?.nameEn ?? ''
    const slots =
      appointment.occupiedSlots.length > 0
        ? appointment.occupiedSlots
        : [{ startTime: appointment.startTime, endTime: appointment.endTime }]
    for (const slot of slots) {
      blocks.push({
        startTime: slot.startTime,
        endTime: slot.endTime,
        serviceName: appointment.serviceName,
        serviceId: appointment.serviceId,
        categoryId: appointment.categoryId,
        staffLabel: staffName,
        nameEn: serviceEn,
      })
    }
  }

  return (
    <ul className="space-y-2">
      {blocks.map((block, i) => (
        <li
          key={`${block.startTime}-${block.serviceId}-${i}`}
          className={`rounded px-3 py-2 text-sm font-medium leading-snug ${appointmentBlockBarClass(
            block.categoryId,
            block.serviceId,
            block.colorGroupRole,
          )}`}
        >
          <span className="tabular-nums">
            {block.startTime}
            {block.endTime !== block.startTime ? ` – ${block.endTime}` : ''}
          </span>
          {' — '}
          {isColorGroupWashRow(block.colorGroupRole) && (
            <WashPhaseIcon className="mr-0.5 inline h-3.5 w-3.5 align-[-2px] opacity-90" title="Lavado" />
          )}
          {isColorGroupWashRow(block.colorGroupRole) ? 'Lavar color' : block.serviceName}
          {block.nameEn ? ` - ${block.nameEn}` : ''} ({block.staffLabel})
        </li>
      ))}
    </ul>
  )
}
