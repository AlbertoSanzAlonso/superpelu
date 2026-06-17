import { sql, type ServiceRow, type ServiceCategoryRow } from '@server/db.js'

export type AdminService = {
  id: string
  nameEs: string
  nameEn: string
  durationMinutes: number
  categoryId: string | null
  categoryNameEs: string | null
  bookableOnline: boolean
  active: boolean
  sortOrder: number
}

export type AdminServiceCategory = {
  id: string
  nameEs: string
  nameEn: string
  active: boolean
  sortOrder: number
  priceFromCents: number | null
  priceNote: string | null
  serviceCount: number
}

export async function listAdminServices(): Promise<AdminService[]> {
  const rows = await sql<(ServiceRow & { category_name_es: string | null })[]>`
    SELECT s.*, c.name_es AS category_name_es
    FROM services s
    LEFT JOIN service_categories c ON c.id = s.category_id
    ORDER BY s.sort_order ASC, s.name ASC
  `
  return rows.map((row) => ({
    id: row.id,
    nameEs: row.name,
    nameEn: row.name_en ?? '',
    durationMinutes: row.duration_minutes,
    categoryId: row.category_id ?? null,
    categoryNameEs: row.category_name_es ?? null,
    bookableOnline: row.bookable_online,
    active: row.active,
    sortOrder: row.sort_order,
  }))
}

export async function createService(data: {
  id: string
  nameEs: string
  nameEn: string
  durationMinutes: number
  categoryId: string | null
  bookableOnline: boolean
  sortOrder: number
}): Promise<AdminService> {
  const now = new Date().toISOString()
  const row = await sql<AdminService[]>`
    INSERT INTO services (id, name, name_en, duration_minutes, category_id, bookable_online, active, sort_order, created_at, updated_at)
    VALUES (${data.id}, ${data.nameEs}, ${data.nameEn}, ${data.durationMinutes}, ${data.categoryId}, ${data.bookableOnline}, TRUE, ${data.sortOrder}, ${now}, ${now})
    RETURNING id, name AS "nameEs", name_en AS "nameEn", duration_minutes AS "durationMinutes", category_id AS "categoryId", bookable_online AS "bookableOnline", active, sort_order AS "sortOrder"
  `
  return { ...row[0], categoryNameEs: null }
}

export async function updateService(
  id: string,
  data: {
    nameEs?: string
    nameEn?: string
    durationMinutes?: number
    categoryId?: string | null
    bookableOnline?: boolean
    active?: boolean
    sortOrder?: number
  },
): Promise<void> {
  const sets: string[] = []
  const vals: unknown[] = []
  let idx = 1

  if (data.nameEs !== undefined) {
    sets.push(`name = $${idx++}`)
    vals.push(data.nameEs)
  }
  if (data.nameEn !== undefined) {
    sets.push(`name_en = $${idx++}`)
    vals.push(data.nameEn)
  }
  if (data.durationMinutes !== undefined) {
    sets.push(`duration_minutes = $${idx++}`)
    vals.push(data.durationMinutes)
  }
  if (data.categoryId !== undefined) {
    sets.push(`category_id = $${idx++}`)
    vals.push(data.categoryId)
  }
  if (data.bookableOnline !== undefined) {
    sets.push(`bookable_online = $${idx++}`)
    vals.push(data.bookableOnline)
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
    UPDATE services
    SET ${sql.unsafe(sets.join(', '))}
    WHERE id = ${id}
  `
}

export async function deleteService(id: string): Promise<void> {
  await sql`UPDATE services SET active = FALSE, updated_at = ${new Date().toISOString()} WHERE id = ${id}`
}

export async function hardDeleteService(id: string): Promise<void> {
  await sql`DELETE FROM services WHERE id = ${id}`
}

export async function listAdminServiceCategories(): Promise<AdminServiceCategory[]> {
  const rows = await sql<(ServiceCategoryRow & { service_count: number })[]>`
    SELECT c.*, COUNT(s.id)::int AS service_count
    FROM service_categories c
    LEFT JOIN services s ON s.category_id = c.id AND s.active = TRUE
    GROUP BY c.id
    ORDER BY c.sort_order ASC, c.name_es ASC
  `
  return rows.map((row) => ({
    id: row.id,
    nameEs: row.name_es,
    nameEn: row.name_en,
    active: row.active,
    sortOrder: row.sort_order,
    priceFromCents: row.price_from_cents ?? null,
    priceNote: row.price_note ?? null,
    serviceCount: row.service_count,
  }))
}

export async function createServiceCategory(data: {
  id: string
  nameEs: string
  nameEn: string
  sortOrder: number
  priceFromCents?: number | null
  priceNote?: string | null
}): Promise<AdminServiceCategory> {
  const now = new Date().toISOString()
  const row = await sql<(ServiceCategoryRow & { service_count: number })[]>`
    INSERT INTO service_categories (id, name_es, name_en, active, sort_order, price_from_cents, price_note, created_at, updated_at)
    VALUES (${data.id}, ${data.nameEs}, ${data.nameEn}, TRUE, ${data.sortOrder}, ${data.priceFromCents ?? null}, ${data.priceNote ?? null}, ${now}, ${now})
    RETURNING *, 0::int AS service_count
  `
  return {
    id: row[0].id,
    nameEs: row[0].name_es,
    nameEn: row[0].name_en,
    active: row[0].active,
    sortOrder: row[0].sort_order,
    priceFromCents: row[0].price_from_cents ?? null,
    priceNote: row[0].price_note ?? null,
    serviceCount: 0,
  }
}

export async function updateServiceCategory(
  id: string,
  data: {
    nameEs?: string
    nameEn?: string
    active?: boolean
    sortOrder?: number
    priceFromCents?: number | null
    priceNote?: string | null
  },
): Promise<void> {
  const sets: string[] = []
  const vals: unknown[] = []
  let idx = 1

  if (data.nameEs !== undefined) {
    sets.push(`name_es = $${idx++}`)
    vals.push(data.nameEs)
  }
  if (data.nameEn !== undefined) {
    sets.push(`name_en = $${idx++}`)
    vals.push(data.nameEn)
  }
  if (data.active !== undefined) {
    sets.push(`active = $${idx++}`)
    vals.push(data.active)
  }
  if (data.sortOrder !== undefined) {
    sets.push(`sort_order = $${idx++}`)
    vals.push(data.sortOrder)
  }
  if (data.priceFromCents !== undefined) {
    sets.push(`price_from_cents = $${idx++}`)
    vals.push(data.priceFromCents)
  }
  if (data.priceNote !== undefined) {
    sets.push(`price_note = $${idx++}`)
    vals.push(data.priceNote)
  }

  if (sets.length === 0) return

  sets.push(`updated_at = $${idx++}`)
  vals.push(new Date().toISOString())

  vals.push(id)
  await sql`
    UPDATE service_categories
    SET ${sql.unsafe(sets.join(', '))}
    WHERE id = ${id}
  `
}

export async function deleteServiceCategory(id: string): Promise<void> {
  await sql`UPDATE service_categories SET active = FALSE, updated_at = ${new Date().toISOString()} WHERE id = ${id}`
}

export async function hardDeleteServiceCategory(id: string): Promise<void> {
  await sql`DELETE FROM service_categories WHERE id = ${id}`
}
