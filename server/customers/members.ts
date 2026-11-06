import { randomUUID } from 'node:crypto'
import { sql } from '@server/db.js'
import type { CustomerMember } from '@/types/customers'
import { formatCustomerDisplayName } from '@/lib/customer/name'
import { normalizePhone } from '@/lib/customer/phone'
import {
  clipMemberRelationship,
  formatMemberAppointmentName,
} from '@/lib/customer/relationship'

export type CustomerMemberInput = {
  id?: string
  firstName: string
  relationship?: string
}

/** Cómo enlazar la cita con un miembro tras crearla. */
export type MemberLink =
  | { kind: 'existing'; memberId: string }
  | { kind: 'new'; firstName: string; relationship: string }

type MemberRow = {
  id: string
  phone: string
  first_name: string
  relationship: string | null
}

const NAME_MAX = 80

function clipName(value: string): string {
  return value.trim().slice(0, NAME_MAX)
}

function rowToMember(row: Pick<MemberRow, 'id' | 'first_name' | 'relationship'>): CustomerMember {
  return {
    id: row.id,
    firstName: row.first_name,
    relationship: row.relationship ?? '',
  }
}

export async function listCustomerMembers(phone: string): Promise<CustomerMember[]> {
  const normalized = normalizePhone(phone)
  if (!normalized) return []
  const rows = await sql<MemberRow[]>`
    SELECT id, phone, first_name, relationship
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
    SELECT id, phone, first_name, relationship
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
    SELECT id, phone, first_name, relationship
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
    const row = item as { id?: unknown; firstName?: unknown; relationship?: unknown }
    return {
      id: typeof row.id === 'string' ? row.id : undefined,
      firstName: typeof row.firstName === 'string' ? row.firstName : '',
      relationship: typeof row.relationship === 'string' ? row.relationship : '',
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
    const relationship = clipMemberRelationship(member.relationship ?? '')
    if (!firstName) throw new Error('NOMBRE_INVALIDO')
    if (!relationship) throw new Error('PARENTESCO_OBLIGATORIO')
    const id = member.id?.trim() || undefined
    return { id, firstName, relationship }
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
            last_name = NULL,
            relationship = ${member.relationship},
            updated_at = ${now}
          WHERE id = ${member.id} AND phone = ${normalized}
        `
        keep.push(member.id)
        continue
      }
      const id = randomUUID()
      await tx`
        INSERT INTO customer_members (
          id, phone, first_name, last_name, relationship, created_at, updated_at
        ) VALUES (
          ${id}, ${normalized}, ${member.firstName}, ${null}, ${member.relationship}, ${now}, ${now}
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

  const saved = await listCustomerMembers(normalized)
  await refreshMemberAppointmentNames(normalized)
  return saved
}

/** Reescribe el nombre de las citas del miembro: «Antonio (hijo) de Luis». */
export async function refreshMemberAppointmentNames(phone: string): Promise<void> {
  const normalized = normalizePhone(phone)
  if (!normalized) return
  const profiles = await sql<{ first_name: string }[]>`
    SELECT first_name FROM customers WHERE phone = ${normalized}
  `
  const titular = profiles[0]?.first_name?.trim() ?? ''
  if (!titular) return
  const members = await listCustomerMembers(normalized)
  for (const member of members) {
    if (!clipMemberRelationship(member.relationship)) continue
    const name = formatMemberAppointmentName(member.firstName, member.relationship, titular)
    await sql`
      UPDATE appointments
      SET customer_name = ${name}
      WHERE customer_phone = ${normalized}
        AND customer_member_id = ${member.id}
    `
  }
}

/**
 * Nombre que debe llevar la cita.
 * Si es para otra persona, no cambia el titular: deja el plan para crear
 * o reutilizar el miembro cuando la cita ya está guardada.
 */
export async function planBookingMember(input: {
  phone: string
  primaryFirstName: string
  primaryLastName: string
  appointmentFor?: 'self' | 'other'
  memberId?: string
  memberName?: string
  memberRelationship?: string
}): Promise<{ nameSnapshot: string; memberLink: MemberLink | null }> {
  const primary = formatCustomerDisplayName(input.primaryFirstName, input.primaryLastName)
  if (input.appointmentFor !== 'other') {
    return { nameSnapshot: primary, memberLink: null }
  }

  const titularFirst = input.primaryFirstName.trim()
  const memberId = input.memberId?.trim() ?? ''
  if (memberId) {
    const member = await getCustomerMember(input.phone, memberId)
    if (!member) throw new Error('MIEMBRO_NO_ENCONTRADO')
    return {
      nameSnapshot: formatMemberAppointmentName(
        member.firstName,
        member.relationship,
        titularFirst,
      ),
      memberLink: { kind: 'existing', memberId: member.id },
    }
  }

  const firstName = clipName(input.memberName ?? '')
  const relationship = clipMemberRelationship(input.memberRelationship ?? '')
  if (!firstName) throw new Error('MIEMBRO_NOMBRE_OBLIGATORIO')
  if (!relationship) throw new Error('PARENTESCO_OBLIGATORIO')
  return {
    nameSnapshot: formatMemberAppointmentName(firstName, relationship, titularFirst),
    memberLink: { kind: 'new', firstName, relationship },
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
          id, phone, first_name, last_name, relationship, created_at, updated_at
        ) VALUES (
          ${memberId},
          ${phone},
          ${input.link.firstName},
          ${null},
          ${input.link.relationship},
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
