import { randomUUID } from 'node:crypto'
import { sql, type StaffRow } from './db.js'
import { verifyPassword } from './password.js'

const SESSION_DAYS = 14

export type PublicStaffSession = {
  id: string
  name: string
  role: string | null
}

function normalizeStaffName(name: string): string {
  return name.trim().toLowerCase()
}

export async function findStaffByLoginName(name: string): Promise<StaffRow | undefined> {
  const normalized = normalizeStaffName(name)
  const rows = await sql<StaffRow[]>`
    SELECT * FROM staff
    WHERE active = TRUE AND lower(trim(name)) = ${normalized}
    LIMIT 1
  `
  return rows[0]
}

export async function loginStaff(
  name: string,
  password: string,
): Promise<{ token: string; staff: PublicStaffSession }> {
  const row = await findStaffByLoginName(name)
  if (!row || !verifyPassword(password, row.password_hash)) {
    throw new Error('CREDENCIALES_INVALIDAS')
  }

  const token = randomUUID()
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + SESSION_DAYS)

  await sql`
    INSERT INTO staff_sessions (token, staff_id, expires_at)
    VALUES (${token}, ${row.id}, ${expiresAt.toISOString()})
  `

  return {
    token,
    staff: { id: row.id, name: row.name, role: row.role },
  }
}

export async function resolveStaffSession(
  token: string | undefined,
): Promise<StaffRow | undefined> {
  if (!token?.trim()) return undefined

  const rows = await sql<StaffRow[]>`
    SELECT s.* FROM staff_sessions ss
    INNER JOIN staff s ON s.id = ss.staff_id
    WHERE ss.token = ${token.trim()}
      AND ss.expires_at > ${new Date().toISOString()}
      AND s.active = TRUE
  `
  return rows[0]
}

export async function logoutStaff(token: string): Promise<void> {
  await sql`DELETE FROM staff_sessions WHERE token = ${token}`
}
