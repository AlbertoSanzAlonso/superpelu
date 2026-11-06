import { sql } from '@server/db.js'
import { isColorGroupWashRow } from '@/lib/booking/occupancy'
import { formatCustomerDisplayName } from '@/lib/customer/name'
import { normalizePhone } from '@/lib/customer/phone'
import { cancelAppointment } from '@server/appointments/lifecycle.js'
import { deleteCustomerMember, getCustomerMember } from '@server/customers/members.js'

export type MemberAppointmentAction = 'cancel' | 'titular' | 'member'

export type PendingMemberAppointment = {
  id: string
  date: string
  startTime: string
  serviceName: string
  staffName: string | null
}

export async function listPendingMemberAppointments(
  phone: string,
  memberId: string,
): Promise<PendingMemberAppointment[]> {
  const normalized = normalizePhone(phone)
  const id = memberId.trim()
  if (!normalized || !id) return []
  const rows = await sql<
    {
      id: string
      appointment_date: string
      start_time: string
      service_name: string
      staff_name: string | null
      color_group_role: string | null
    }[]
  >`
    SELECT id, appointment_date, start_time, service_name, staff_name, color_group_role
    FROM appointments
    WHERE customer_phone = ${normalized}
      AND customer_member_id = ${id}
      AND status = 'confirmed'
      AND appointment_date >= (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Madrid')::date
    ORDER BY appointment_date ASC, start_time ASC
  `
  return rows
    .filter((row) => !isColorGroupWashRow(row.color_group_role))
    .map((row) => ({
      id: row.id,
      date: row.appointment_date,
      startTime: row.start_time.slice(0, 5),
      serviceName: row.service_name,
      staffName: row.staff_name,
    }))
}

/**
 * Resuelve las citas pendientes del miembro y luego lo borra.
 * Sin citas pendientes basta con borrar; si las hay, hace falta una acción.
 */
export async function removeCustomerMember(input: {
  phone: string
  memberId: string
  titularName: string
  action?: MemberAppointmentAction
  targetMemberId?: string
}): Promise<void> {
  const phone = normalizePhone(input.phone)
  const memberId = input.memberId.trim()
  if (!phone) throw new Error('TELEFONO_INVALIDO')
  const member = await getCustomerMember(phone, memberId)
  if (!member) throw new Error('MIEMBRO_NO_ENCONTRADO')

  const pending = await listPendingMemberAppointments(phone, memberId)
  if (pending.length > 0 && !input.action) throw new Error('CITAS_PENDIENTES')

  if (pending.length > 0 && input.action === 'cancel') {
    for (const row of pending) {
      await cancelAppointment(row.id, { notifyCustomer: false, notifyAdmin: false })
    }
  } else if (pending.length > 0 && input.action === 'titular') {
    const name = input.titularName.trim()
    if (!name) throw new Error('NOMBRE_INVALIDO')
    await reassignPending(phone, memberId, name, null)
  } else if (pending.length > 0 && input.action === 'member') {
    const targetId = input.targetMemberId?.trim() ?? ''
    if (!targetId || targetId === memberId) throw new Error('MIEMBRO_OBJETIVO_INVALIDO')
    const target = await getCustomerMember(phone, targetId)
    if (!target) throw new Error('MIEMBRO_OBJETIVO_INVALIDO')
    await reassignPending(
      phone,
      memberId,
      formatCustomerDisplayName(target.firstName, target.lastName),
      target.id,
    )
  }

  await deleteCustomerMember(phone, memberId)
}

async function reassignPending(
  phone: string,
  memberId: string,
  name: string,
  targetMemberId: string | null,
): Promise<void> {
  await sql`
    UPDATE appointments
    SET customer_name = ${name},
        customer_member_id = ${targetMemberId}
    WHERE customer_phone = ${phone}
      AND customer_member_id = ${memberId}
      AND status = 'confirmed'
      AND appointment_date >= (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Madrid')::date
  `
}
