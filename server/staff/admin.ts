import { sql, type StaffRow } from '@server/db.js'

function slugifyStaffName(name: string): string {
  const base = name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
  return base || 'profesional'
}

async function generateUniqueStaffId(name: string): Promise<string> {
  const slug = slugifyStaffName(name)
  let candidate = slug
  let suffix = 2
  while (true) {
    const rows = await sql<{ id: string }[]>`
      SELECT id FROM staff WHERE id = ${candidate} LIMIT 1
    `
    if (rows.length === 0) return candidate
    candidate = `${slug}-${suffix}`
    suffix += 1
  }
}

async function listActiveCategoryIds(): Promise<string[]> {
  const rows = await sql<{ id: string }[]>`
    SELECT id FROM service_categories WHERE active = TRUE ORDER BY sort_order ASC, name_es ASC
  `
  return rows.map((r) => r.id)
}

/** Deriva `staff_services` desde las categorías del profesional. */
export async function syncStaffServicesForStaff(staffId: string): Promise<void> {
  await sql`DELETE FROM staff_services WHERE staff_id = ${staffId}`
  await sql`
    INSERT INTO staff_services (staff_id, service_id)
    SELECT ${staffId}, svc.id
    FROM services svc
    INNER JOIN staff_categories sc
      ON sc.category_id = svc.category_id AND sc.staff_id = ${staffId}
    WHERE svc.active = TRUE
    ON CONFLICT DO NOTHING
  `
}

export async function setStaffCategories(
  staffId: string,
  categoryIds: string[],
): Promise<void> {
  const unique = [...new Set(categoryIds.map((id) => id.trim()).filter(Boolean))]
  await sql`DELETE FROM staff_categories WHERE staff_id = ${staffId}`
  for (const categoryId of unique) {
    await sql`
      INSERT INTO staff_categories (staff_id, category_id)
      VALUES (${staffId}, ${categoryId})
      ON CONFLICT DO NOTHING
    `
  }
  await syncStaffServicesForStaff(staffId)
}

export type AdminStaffMember = {
  id: string
  name: string
  role: string | null
  phone: string | null
  email: string | null
  active: boolean
  sortOrder: number
  categoryIds: string[]
  createdAt: string
  updatedAt: string
}

function rowToAdmin(row: StaffRow, categoryIds: string[] = []): AdminStaffMember {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    phone: row.phone,
    email: row.email,
    active: row.active,
    sortOrder: row.sort_order,
    categoryIds,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function listAdminStaff(): Promise<AdminStaffMember[]> {
  const rows = await sql<StaffRow[]>`
    SELECT * FROM staff ORDER BY sort_order ASC, name ASC
  `
  const links = await sql<{ staff_id: string; category_id: string }[]>`
    SELECT staff_id, category_id FROM staff_categories
  `
  const byStaff = new Map<string, string[]>()
  for (const link of links) {
    const list = byStaff.get(link.staff_id) ?? []
    list.push(link.category_id)
    byStaff.set(link.staff_id, list)
  }
  return rows.map((row) => rowToAdmin(row, byStaff.get(row.id) ?? []))
}

export async function createStaff(data: {
  id?: string
  name: string
  role: string | null
  phone: string | null
  email: string | null
  sortOrder: number
  categoryIds?: string[]
}): Promise<AdminStaffMember> {
  const id = data.id?.trim() || (await generateUniqueStaffId(data.name))
  const now = new Date().toISOString()
  const row = await sql<StaffRow[]>`
    INSERT INTO staff (id, name, role, phone, email, password_hash, active, sort_order, created_at, updated_at)
    VALUES (${id}, ${data.name}, ${data.role}, ${data.phone}, ${data.email}, NULL, TRUE, ${data.sortOrder}, ${now}, ${now})
    RETURNING *
  `
  const categoryIds =
    data.categoryIds !== undefined ? data.categoryIds : await listActiveCategoryIds()
  await setStaffCategories(id, categoryIds)
  return rowToAdmin(row[0], categoryIds)
}

export async function updateStaff(
  id: string,
  data: {
    name?: string
    role?: string | null
    phone?: string | null
    email?: string | null
    active?: boolean
    sortOrder?: number
    categoryIds?: string[]
  },
): Promise<void> {
  const patch: Record<string, unknown> = {}
  if (data.name !== undefined) patch.name = data.name
  if (data.role !== undefined) patch.role = data.role
  if (data.phone !== undefined) patch.phone = data.phone
  if (data.email !== undefined) patch.email = data.email
  if (data.active !== undefined) patch.active = data.active
  if (data.sortOrder !== undefined) patch.sort_order = data.sortOrder

  if (Object.keys(patch).length > 0 || data.categoryIds !== undefined) {
    patch.updated_at = new Date().toISOString()
  }

  if (Object.keys(patch).length > 0) {
    await sql`
      UPDATE staff
      SET ${sql(patch)}
      WHERE id = ${id}
    `
  }

  if (data.categoryIds !== undefined) {
    await setStaffCategories(id, data.categoryIds)
  }
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

  // Cascades: staff_services, staff_categories, staff_availability,
  // staff_time_blocks, staff_special_availability, staff_sessions
  await sql`DELETE FROM staff WHERE id = ${staffId}`
}
