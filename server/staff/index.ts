import { sql, type ServiceRow, type StaffRow } from '@server/db.js'

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

export async function getStaff(id: string): Promise<StaffRow | undefined> {
  const rows = await sql<StaffRow[]>`SELECT * FROM staff WHERE id = ${id}`
  return rows[0]
}

export async function listActiveStaff(): Promise<PublicStaff[]> {
  const rows = await sql<StaffRow[]>`
    SELECT * FROM staff WHERE active = TRUE ORDER BY sort_order ASC, name ASC
  `
  return rows.map(rowToPublic)
}

export async function listStaffForServices(serviceIds: string[]): Promise<PublicStaff[]> {
  if (serviceIds.length === 0) return []
  const lists = await Promise.all(serviceIds.map((id) => listStaffForService(id)))
  if (lists.length === 0) return []
  return lists[0].filter((member) =>
    lists.every((list) => list.some((other) => other.id === member.id)),
  )
}

/** Profesionales activos asociados a la categoría del servicio (según categorías marcadas en /personal). */
export async function listStaffForService(serviceId: string): Promise<PublicStaff[]> {
  const rows = await sql<StaffRow[]>`
    SELECT s.* FROM staff s
    WHERE s.active = TRUE
      AND EXISTS (
        SELECT 1
        FROM staff_categories sc
        INNER JOIN services svc ON svc.category_id = sc.category_id
        WHERE sc.staff_id = s.id
          AND svc.id = ${serviceId}
          AND svc.active = TRUE
      )
    ORDER BY s.sort_order ASC, s.name ASC
  `
  return rows.map(rowToPublic)
}

/** Servicios activos cuyas categorías tiene asignadas el profesional. */
export async function listServicesForStaff(staffId: string) {
  const rows = await sql<ServiceRow[]>`
    SELECT svc.* FROM services svc
    WHERE svc.active = TRUE
      AND EXISTS (
        SELECT 1 FROM staff_categories sc
        WHERE sc.staff_id = ${staffId}
          AND sc.category_id = svc.category_id
      )
    ORDER BY svc.sort_order ASC, svc.name ASC
  `

  return rows.map((row) => ({
    id: row.id,
    nameEs: row.name,
    nameEn: row.name_en ?? '',
    durationMinutes: row.duration_minutes,
    categoryId: row.category_id ?? null,
  }))
}

export async function staffCanPerformService(
  staffId: string,
  serviceId: string,
): Promise<boolean> {
  const rows = await sql`
    SELECT 1 FROM staff_categories sc
    INNER JOIN staff s ON s.id = sc.staff_id
    INNER JOIN services svc ON svc.category_id = sc.category_id
    WHERE sc.staff_id = ${staffId}
      AND svc.id = ${serviceId}
      AND s.active = TRUE
      AND svc.active = TRUE
  `
  return rows.length > 0
}
