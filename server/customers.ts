import { db, type CustomerRow } from './db.js'
import {
  formatCustomerDisplayName,
  splitCustomerName,
} from '../src/lib/customerName.ts'
import { normalizePhone, isValidSpanishPhone } from '../src/lib/phone.ts'

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
export function upsertCustomer(input: CustomerInput): CustomerRow {
  const { firstName, lastName, phone } = resolveCustomerFromInput(input)
  const now = new Date().toISOString()
  const email = input.email?.trim() || null
  const notes = input.notes?.trim() || null

  db.prepare(
    `INSERT INTO customers (phone, first_name, last_name, email, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(phone) DO UPDATE SET
       first_name = excluded.first_name,
       last_name = excluded.last_name,
       email = COALESCE(excluded.email, customers.email),
       notes = COALESCE(excluded.notes, customers.notes),
       updated_at = excluded.updated_at`,
  ).run(phone, firstName, lastName || null, email, notes, now, now)

  return db.prepare('SELECT * FROM customers WHERE phone = ?').get(phone) as CustomerRow
}

export function getCustomer(phone: string): CustomerRow | undefined {
  const normalized = normalizePhone(phone)
  if (!normalized) return undefined
  return db.prepare('SELECT * FROM customers WHERE phone = ?').get(normalized) as
    | CustomerRow
    | undefined
}

export function customerNameSnapshot(firstName: string, lastName: string): string {
  return formatCustomerDisplayName(firstName, lastName)
}

export function listCustomers(options: { q?: string; limit?: number } = {}): PublicCustomer[] {
  const q = options.q?.trim().toLowerCase() ?? ''
  const limit = Math.min(Math.max(options.limit ?? 200, 1), 500)

  const rows = db
    .prepare(
      `SELECT c.*,
        (SELECT COUNT(*) FROM appointments a
         WHERE a.customer_phone = c.phone AND a.status != 'cancelled') AS appointment_count,
        (SELECT MAX(a.appointment_date) FROM appointments a
         WHERE a.customer_phone = c.phone AND a.status != 'cancelled') AS last_appointment_date
       FROM customers c
       ORDER BY c.updated_at DESC
       LIMIT ?`,
    )
    .all(limit) as (CustomerRow & {
    appointment_count: number
    last_appointment_date: string | null
  })[]

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

export function listCustomerAppointments(phone: string) {
  const normalized = normalizePhone(phone)
  if (!normalized) return []

  return db
    .prepare(
      `SELECT * FROM appointments
       WHERE customer_phone = ?
       ORDER BY appointment_date DESC, start_time DESC`,
    )
    .all(normalized)
}
