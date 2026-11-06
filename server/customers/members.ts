import { randomUUID } from 'node:crypto'
import { sql } from '@server/db.js'
import type { CustomerMember } from '@/types/customers'
import { formatCustomerDisplayName, splitCustomerName } from '@/lib/customer/name'
import { normalizePhone } from '@/lib/customer/phone'

export type CustomerMemberInput = {
  id?: string
  firstName: string
  lastName?: string
}

/** Cómo enlazar la cita con un miembro tras crearla. */
export type MemberLink =
  | { kind: 'existing'; memberId: string }
  | { kind: 'new'; firstName: string; lastName: string }

type MemberRow = {
  id: string
  phone: string
  first_name: string
  last_name: string | null
}

const NAME_MAX = 80

function clipName(value: string): string {
  return value.trim().slice(0, NAME_MAX)
}

function rowToMember(row: Pick<MemberRow, 'id' | 'first_name' | 'last_name'>): CustomerMember {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name ?? '',
  }
}

export async function listCustomerMembers(phone: string): Promise<CustomerMember[]> {
  const normalized = normalizePhone(phone)
  if (!normalized) return []
  const rows = await sql<MemberRow[]>`
    SELECT id, phone, first_name, last_name
    FROM customer_members
    WHERE phone = ${normalized}
    ORDER BY created_at ASC, first_name ASC
  `
  return rows.map(rowToMember)
}

export async function listMembersForPhones(
  phones: string[],
): Promise<Map<string, CustomerMember[]>> {
  const map = new Map<string, CustomerMember[]>()
  if (phones.length === 0) return map
  const rows = await sql<MemberRow[]>`
    SELECT id, phone, first_name, last_name
    FROM customer_members
    WHERE phone = ANY(${phones}::text[])
    ORDER BY created_at ASC, first_name ASC
  `
  for (const row of rows) {
    const list = map.get(row.phone) ?? []
    list.push(rowToMember(row))
    map.set(row.phone, list)
  }
  return map
}

export async function deleteCustomerMember(phone: string, memberId: string): Promise<void> {
  const normalized = normalizePhone(phone)
  const id = memberId.trim()
  if (!normalized) throw new Error('TELEFONO_INVALIDO')
  if (!id) throw new Error('MIEMBRO_NO_ENCONTRADO')
  const pending = await sql<{ id: string }[]>`
    SELECT id
    FROM appointments
    WHERE customer_phone = ${normalized}
      AND customer_member_id = ${id}
      AND status = 'confirmed'
      AND appointment_date >= (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Madrid')::date
    LIMIT 1
  `
  if (pending.length > 0) throw new Error('CITAS_PENDIENTES')
  const rows = await sql<{ id: string }[]>`
    DELETE FROM customer_members
    WHERE id = ${id} AND phone = ${normalized}
    RETURNING id
  `
  if (rows.length === 0) throw new Error('MIEMBRO_NO_ENCONTRADO')
}

export async function getCustomerMember(
  phone: string,
  memberId: string,
): Promise<CustomerMember | undefined> {
  const normalized = normalizePhone(phone)
  const id = memberId.trim()
  if (!normalized || !id) return undefined
  const rows = await sql<MemberRow[]>`
    SELECT id, phone, first_name, last_name
    FROM customer_members
    WHERE id = ${id} AND phone = ${normalized}
    LIMIT 1
  `
  const row = rows[0]
  return row ? rowToMember(row) : undefined
}

/**
 * Sustituye la lista de miembros del teléfono.
 * Los `id` que ya son de esa ficha se actualizan; el resto se crea.
 * Los que no vengan en la lista se borran (las citas conservan el nombre).
 */
export function readMemberInputs(raw: unknown): CustomerMemberInput[] | undefined {
  if (raw === undefined) return undefined
  if (!Array.isArray(raw)) throw new Error('NOMBRE_INVALIDO')
  return raw.map((item) => {
    if (!item || typeof item !== 'object') throw new Error('NOMBRE_INVALIDO')
    const row = item as { id?: unknown; firstName?: unknown; lastName?: unknown }
    return {
      id: typeof row.id === 'string' ? row.id : undefined,
      firstName: typeof row.firstName === 'string' ? row.firstName : '',
      lastName: typeof row.lastName === 'string' ? row.lastName : '',
    }
  })
}

export async function syncCustomerMembers(
  phone: string,
  members: CustomerMemberInput[],
): Promise<CustomerMember[]> {
  const normalized = normalizePhone(phone)
  if (!normalized) throw new Error('TELEFONO_INVALIDO')
  if (members.length > 50) throw new Error('DEMASIADOS_MIEMBROS')

  const cleaned = members.map((member) => {
    const firstName = clipName(member.firstName ?? '')
    const lastName = clipName(member.lastName ?? '')
    if (!firstName) throw new Error('NOMBRE_INVALIDO')
    const id = member.id?.trim() || undefined
    return { id, firstName, lastName }
  })

  const now = new Date().toISOString()
  await sql.begin(async (tx) => {
    const existing = await tx<{ id: string }[]>`
      SELECT id FROM customer_members WHERE phone = ${normalized}
    `
    const existingIds = new Set(existing.map((row) => row.id))
    const keep: string[] = []

    for (const member of cleaned) {
      if (member.id && existingIds.has(member.id)) {
        await tx`
          UPDATE customer_members SET
            first_name = ${member.firstName},
            last_name = ${member.lastName || null},
            updated_at = ${now}
          WHERE id = ${member.id} AND phone = ${normalized}
        `
        keep.push(member.id)
        continue
      }
      const id = randomUUID()
      await tx`
        INSERT INTO customer_members (
          id, phone, first_name, last_name, created_at, updated_at
        ) VALUES (
          ${id}, ${normalized}, ${member.firstName}, ${member.lastName || null}, ${now}, ${now}
        )
      `
      keep.push(id)
    }

    if (keep.length === 0) {
      await tx`DELETE FROM customer_members WHERE phone = ${normalized}`
    } else {
      await tx`
        DELETE FROM customer_members
        WHERE phone = ${normalized}
          AND NOT (id = ANY(${keep}::text[]))
      `
    }
  })

  return listCustomerMembers(normalized)
}

/**
 * Nombre que debe llevar la cita.
 * Si es para otra persona, no cambia el titular: deja el plan para crear
 * o reutilizar el miembro cuando la cita ya está guardada.
 */
export async function planBookingMember(input: {
  forStaffPortal?: boolean
  phone: string
  primaryFirstName: string
  primaryLastName: string
  appointmentFor?: 'self' | 'other'
  memberId?: string
  memberName?: string
}): Promise<{ nameSnapshot: string; memberLink: MemberLink | null }> {
  const primary = formatCustomerDisplayName(input.primaryFirstName, input.primaryLastName)
  if (input.forStaffPortal || input.appointmentFor !== 'other') {
    return { nameSnapshot: primary, memberLink: null }
  }

  const memberId = input.memberId?.trim() ?? ''
  if (memberId) {
    const member = await getCustomerMember(input.phone, memberId)
    if (!member) throw new Error('MIEMBRO_NO_ENCONTRADO')
    return {
      nameSnapshot: formatCustomerDisplayName(member.firstName, member.lastName),
      memberLink: { kind: 'existing', memberId: member.id },
    }
  }

  const split = splitCustomerName(input.memberName ?? '')
  const firstName = clipName(split.firstName)
  const lastName = clipName(split.lastName)
  if (!firstName) throw new Error('MIEMBRO_NOMBRE_OBLIGATORIO')
  return {
    nameSnapshot: formatCustomerDisplayName(firstName, lastName),
    memberLink: { kind: 'new', firstName, lastName },
  }
}

/** Escribe el miembro nuevo (si hace falta) y lo deja en todas las filas de la visita. */
export async function linkAppointmentMember(input: {
  appointmentId: string
  phone: string
  link: MemberLink
}): Promise<void> {
  const phone = normalizePhone(input.phone)
  if (!phone) throw new Error('TELEFONO_INVALIDO')
  const now = new Date().toISOString()

  await sql.begin(async (tx) => {
    let memberId: string
    if (input.link.kind === 'new') {
      memberId = randomUUID()
      await tx`
        INSERT INTO customer_members (
          id, phone, first_name, last_name, created_at, updated_at
        ) VALUES (
          ${memberId},
          ${phone},
          ${input.link.firstName},
          ${input.link.lastName || null},
          ${now},
          ${now}
        )
      `
    } else {
      memberId = input.link.memberId
      const found = await tx<{ id: string }[]>`
        SELECT id FROM customer_members
        WHERE id = ${memberId} AND phone = ${phone}
        LIMIT 1
      `
      if (found.length === 0) throw new Error('MIEMBRO_NO_ENCONTRADO')
    }

    await tx`
      UPDATE appointments AS target
      SET customer_member_id = ${memberId}
      WHERE target.id = ${input.appointmentId}
         OR target.color_group_id = (
           SELECT color_group_id FROM appointments
           WHERE id = ${input.appointmentId} AND color_group_id IS NOT NULL
         )
         OR target.booking_group_id = (
           SELECT booking_group_id FROM appointments
           WHERE id = ${input.appointmentId} AND booking_group_id IS NOT NULL
         )
         OR target.series_id = (
           SELECT series_id FROM appointments
           WHERE id = ${input.appointmentId} AND series_id IS NOT NULL
         )
    `
  })
}
