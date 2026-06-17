import { sql, type StaffRow } from '@server/db.js'
import { hashPassword } from '@server/password.js'

export type AdminStaffMember = {
  id: string
  name: string
  role: string | null
  phone: string | null
  email: string | null
  active: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
}

function rowToAdmin(row: StaffRow): AdminStaffMember {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    phone: row.phone,
    email: row.email,
    active: row.active,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function listAdminStaff(): Promise<AdminStaffMember[]> {
  const rows = await sql<StaffRow[]>`
    SELECT * FROM staff ORDER BY sort_order ASC, name ASC
  `
  return rows.map(rowToAdmin)
}

export async function createStaff(data: {
  id: string
  name: string
  role: string | null
  phone: string | null
  email: string | null
  password: string
  sortOrder: number
}): Promise<AdminStaffMember> {
  const now = new Date().toISOString()
  const passwordHash = hashPassword(data.password)
  const row = await sql<StaffRow[]>`
    INSERT INTO staff (id, name, role, phone, email, password_hash, active, sort_order, created_at, updated_at)
    VALUES (${data.id}, ${data.name}, ${data.role}, ${data.phone}, ${data.email}, ${passwordHash}, TRUE, ${data.sortOrder}, ${now}, ${now})
    RETURNING *
  `
  return rowToAdmin(row[0])
}

export async function updateStaff(
  id: string,
  data: {
    name?: string
    role?: string | null
    phone?: string | null
    email?: string | null
    password?: string
    active?: boolean
    sortOrder?: number
  },
): Promise<void> {
  const sets: string[] = []
  const vals: unknown[] = []
  let idx = 1

  if (data.name !== undefined) {
    sets.push(`name = $${idx++}`)
    vals.push(data.name)
  }
  if (data.role !== undefined) {
    sets.push(`role = $${idx++}`)
    vals.push(data.role)
  }
  if (data.phone !== undefined) {
    sets.push(`phone = $${idx++}`)
    vals.push(data.phone)
  }
  if (data.email !== undefined) {
    sets.push(`email = $${idx++}`)
    vals.push(data.email)
  }
  if (data.password !== undefined) {
    sets.push(`password_hash = $${idx++}`)
    vals.push(hashPassword(data.password))
  }
  if (data.active !== undefined) {
    sets.push(`active = $${idx++}`)
    vals.push(data.active)
  }
  if (data.sortOrder !== undefined) {
    sets.push(`sort_order = $${idx++}`)
    vals.push(data.sortOrder)
  }

  if (sets.length === 0) return

  sets.push(`updated_at = $${idx++}`)
  vals.push(new Date().toISOString())

  vals.push(id)
  await sql`
    UPDATE staff
    SET ${sql.unsafe(sets.join(', '))}
    WHERE id = ${id}
  `
}

/** Returns the number of future appointments for a staff member. */
export async function countFutureAppointments(staffId: string): Promise<number> {
  const today = new Date().toISOString().slice(0, 10)
  const rows = await sql<{ count: number }[]>`
    SELECT COUNT(*)::int AS count FROM appointments
    WHERE staff_id = ${staffId} AND appointment_date >= ${today} AND status = 'confirmed'
  `
  return rows[0]?.count ?? 0
}

/**
 * Deletes a staff member and cascades all related data.
 * Throws if the member has future confirmed appointments.
 */
export async function deleteStaff(staffId: string): Promise<void> {
  const future = await countFutureAppointments(staffId)
  if (future > 0) {
    throw new Error(
      `No se puede eliminar: tiene ${future} cita${future === 1 ? '' : 's'} futura${future === 1 ? '' : 's'}. Cancela las citas primero.`,
    )
  }

  // Nullify staff_id on past appointments so the FK constraint doesn't block deletion
  await sql`UPDATE appointments SET staff_id = NULL WHERE staff_id = ${staffId}`

  // The rest cascades via ON DELETE CASCADE (staff_services, staff_availability,
  // staff_time_blocks, staff_special_availability, staff_sessions)
  await sql`DELETE FROM staff WHERE id = ${staffId}`
}
