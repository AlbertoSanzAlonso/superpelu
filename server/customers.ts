import { sql, type CustomerRow } from '@server/db.js'
import {
  formatCustomerDisplayName,
  splitCustomerName,
} from '@/lib/customerName'
import { normalizePhone, isValidSpanishPhone } from '@/lib/phone'

export type CustomerInput = {
  firstName: string
  lastName?: string
  phone: string
  email?: string | null
  notes?: string | null
}

export type PublicCustomer = {
  phone: string
  firstName: string
  lastName: string
  email: string | null
  notes: string | null
  appointmentCount: number
  lastAppointmentDate: string | null
  createdAt: string
  updatedAt: string
}

function rowToPublic(row: CustomerRow, stats?: { count: number; lastDate: string | null }): PublicCustomer {
  return {
    phone: row.phone,
    firstName: row.first_name,
    lastName: row.last_name ?? '',
    email: row.email,
    notes: row.notes,
    appointmentCount: stats?.count ?? 0,
    lastAppointmentDate: stats?.lastDate ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function resolveCustomerFromInput(input: {
  firstName?: string
  lastName?: string
  customerName?: string
  phone: string
}): { firstName: string; lastName: string; phone: string } {
  const phone = normalizePhone(input.phone)
  if (!isValidSpanishPhone(input.phone)) {
    throw new Error('TELEFONO_INVALIDO')
  }

  let firstName = input.firstName?.trim() ?? ''
  let lastName = input.lastName?.trim() ?? ''

  if (!firstName && input.customerName) {
    const split = splitCustomerName(input.customerName)
    firstName = split.firstName
    lastName = split.lastName
  }

  if (!firstName) throw new Error('NOMBRE_INVALIDO')

  return { firstName, lastName, phone }
}

/** Crea o actualiza ficha de cliente (PK = teléfono normalizado). */
export async function upsertCustomer(input: CustomerInput): Promise<CustomerRow> {
  const { firstName, lastName, phone } = resolveCustomerFromInput(input)
  const now = new Date().toISOString()
  const email = input.email?.trim() || null
  const notes = input.notes?.trim() || null

  await sql`
    INSERT INTO customers (phone, first_name, last_name, email, notes, created_at, updated_at)
    VALUES (${phone}, ${firstName}, ${lastName || null}, ${email}, ${notes}, ${now}, ${now})
    ON CONFLICT (phone) DO UPDATE SET
      first_name = EXCLUDED.first_name,
      last_name = EXCLUDED.last_name,
      email = COALESCE(EXCLUDED.email, customers.email),
      notes = COALESCE(EXCLUDED.notes, customers.notes),
      updated_at = EXCLUDED.updated_at
  `

  const rows = await sql<CustomerRow[]>`
    SELECT * FROM customers WHERE phone = ${phone}
  `
  return rows[0]!
}

export type CustomerUpdateInput = {
  firstName: string
  lastName?: string
  email?: string | null
  notes?: string | null
}

/** Actualiza ficha existente (el teléfono / PK no cambia). */
export async function updateCustomer(
  phone: string,
  input: CustomerUpdateInput,
): Promise<CustomerRow> {
  const normalized = normalizePhone(phone)
  if (!normalized) throw new Error('TELEFONO_INVALIDO')

  const existing = await getCustomer(normalized)
  if (!existing) throw new Error('CLIENTE_NO_ENCONTRADO')

  const firstName = input.firstName?.trim() ?? ''
  if (!firstName) throw new Error('NOMBRE_INVALIDO')

  const lastName = input.lastName?.trim() ?? ''
  const email = input.email === undefined ? existing.email : input.email?.trim() || null
  const notes = input.notes === undefined ? existing.notes : input.notes?.trim() || null
  const now = new Date().toISOString()

  await sql`
    UPDATE customers SET
      first_name = ${firstName},
      last_name = ${lastName || null},
      email = ${email},
      notes = ${notes},
      updated_at = ${now}
    WHERE phone = ${normalized}
  `

  const rows = await sql<CustomerRow[]>`
    SELECT * FROM customers WHERE phone = ${normalized}
  `
  return rows[0]!
}

export async function getCustomer(phone: string): Promise<CustomerRow | undefined> {
  const normalized = normalizePhone(phone)
  if (!normalized) return undefined
  const rows = await sql<CustomerRow[]>`
    SELECT * FROM customers WHERE phone = ${normalized}
  `
  return rows[0]
}

export function customerNameSnapshot(firstName: string, lastName: string): string {
  return formatCustomerDisplayName(firstName, lastName)
}

export async function listCustomers(
  options: { q?: string; limit?: number } = {},
): Promise<PublicCustomer[]> {
  const q = options.q?.trim().toLowerCase() ?? ''
  const limit = Math.min(Math.max(options.limit ?? 200, 1), 500)

  const rows = await sql<
    (CustomerRow & {
      appointment_count: number
      last_appointment_date: string | null
    })[]
  >`
    SELECT c.*,
      (SELECT COUNT(*)::int FROM appointments a
       WHERE a.customer_phone = c.phone AND a.status != 'cancelled') AS appointment_count,
      (SELECT MAX(a.appointment_date) FROM appointments a
       WHERE a.customer_phone = c.phone AND a.status != 'cancelled') AS last_appointment_date
    FROM customers c
    ORDER BY c.updated_at DESC
    LIMIT ${limit}
  `

  const filtered = q
    ? rows.filter((row) => {
        const haystack = [
          row.first_name,
          row.last_name ?? '',
          row.phone,
          row.email ?? '',
        ]
          .join(' ')
          .toLowerCase()
        return haystack.includes(q)
      })
    : rows

  return filtered.map((row) =>
    rowToPublic(row, {
      count: row.appointment_count,
      lastDate: row.last_appointment_date,
    }),
  )
}

/** Elimina la ficha del cliente (las citas en agenda/historial se conservan). */
export async function deleteCustomer(phone: string): Promise<boolean> {
  const normalized = normalizePhone(phone)
  if (!normalized) return false
  const result = await sql`DELETE FROM customers WHERE phone = ${normalized}`
  return result.count > 0
}

export async function listCustomerAppointments(phone: string) {
  const normalized = normalizePhone(phone)
  if (!normalized) return []

  return sql`
    SELECT * FROM appointments
    WHERE customer_phone = ${normalized}
    ORDER BY appointment_date DESC, start_time DESC
  `
}
