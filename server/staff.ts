import { db, type ServiceRow, type StaffRow } from './db.js'

export type PublicStaff = {
  id: string
  name: string
  role: string | null
}

function rowToPublic(row: StaffRow): PublicStaff {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
  }
}

export function getStaff(id: string): StaffRow | undefined {
  return db.prepare('SELECT * FROM staff WHERE id = ?').get(id) as StaffRow | undefined
}

export function listActiveStaff(): PublicStaff[] {
  const rows = db
    .prepare(
      `SELECT * FROM staff WHERE active = 1 ORDER BY sort_order ASC, name ASC`,
    )
    .all() as StaffRow[]

  return rows.map(rowToPublic)
}

export function listStaffForService(serviceId: string): PublicStaff[] {
  const rows = db
    .prepare(
      `SELECT s.* FROM staff s
       INNER JOIN staff_services ss ON ss.staff_id = s.id
       WHERE ss.service_id = ? AND s.active = 1
       ORDER BY s.sort_order ASC, s.name ASC`,
    )
    .all(serviceId) as StaffRow[]

  return rows.map(rowToPublic)
}

export function listServicesForStaff(staffId: string) {
  const rows = db
    .prepare(
      `SELECT svc.* FROM services svc
       INNER JOIN staff_services ss ON ss.service_id = svc.id
       WHERE ss.staff_id = ? AND svc.active = 1
       ORDER BY svc.sort_order ASC, svc.name ASC`,
    )
    .all(staffId) as ServiceRow[]

  return rows.map((row) => ({
    id: row.id,
    nameEs: row.name,
    nameEn: row.name_en ?? '',
    durationMinutes: row.duration_minutes,
    categoryId: row.category_id ?? null,
  }))
}

export function staffCanPerformService(staffId: string, serviceId: string): boolean {
  const row = db
    .prepare(
      `SELECT 1 FROM staff_services ss
       INNER JOIN staff s ON s.id = ss.staff_id
       INNER JOIN services svc ON svc.id = ss.service_id
       WHERE ss.staff_id = ? AND ss.service_id = ?
         AND s.active = 1 AND svc.active = 1`,
    )
    .get(staffId, serviceId)

  return Boolean(row)
}
