import { randomUUID } from 'node:crypto'
import { db, type StaffRow } from './db.js'
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

export function findStaffByLoginName(name: string): StaffRow | undefined {
  const normalized = normalizeStaffName(name)
  return db
    .prepare(
      `SELECT * FROM staff
       WHERE active = 1 AND lower(trim(name)) = ?
       LIMIT 1`,
    )
    .get(normalized) as StaffRow | undefined
}

export function loginStaff(name: string, password: string): { token: string; staff: PublicStaffSession } {
  const row = findStaffByLoginName(name)
  if (!row || !verifyPassword(password, row.password_hash)) {
    throw new Error('CREDENCIALES_INVALIDAS')
  }

  const token = randomUUID()
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + SESSION_DAYS)

  db.prepare(
    `INSERT INTO staff_sessions (token, staff_id, expires_at) VALUES (?, ?, ?)`,
  ).run(token, row.id, expiresAt.toISOString())

  return {
    token,
    staff: { id: row.id, name: row.name, role: row.role },
  }
}

export function resolveStaffSession(token: string | undefined): StaffRow | undefined {
  if (!token?.trim()) return undefined

  const row = db
    .prepare(
      `SELECT s.* FROM staff_sessions ss
       INNER JOIN staff s ON s.id = ss.staff_id
       WHERE ss.token = ? AND ss.expires_at > ? AND s.active = 1`,
    )
    .get(token.trim(), new Date().toISOString()) as StaffRow | undefined

  return row
}

export function logoutStaff(token: string): void {
  db.prepare('DELETE FROM staff_sessions WHERE token = ?').run(token)
}
