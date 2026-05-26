import { db, type ServiceRow } from './db.js'

export type PublicService = {
  id: string
  nameEs: string
  nameEn: string
  durationMinutes: number
  categoryId: string | null
}

function rowToPublic(row: ServiceRow): PublicService {
  return {
    id: row.id,
    nameEs: row.name,
    nameEn: row.name_en ?? '',
    durationMinutes: row.duration_minutes,
    categoryId: row.category_id ?? null,
  }
}

export function listActiveServices(options?: { onlineOnly?: boolean }): PublicService[] {
  const onlineOnly = options?.onlineOnly ?? true
  const rows = db
    .prepare(
      `SELECT * FROM services
       WHERE active = 1${onlineOnly ? ' AND bookable_online = 1' : ''}
       ORDER BY sort_order ASC, name ASC`,
    )
    .all() as ServiceRow[]

  return rows.map(rowToPublic)
}

export function getService(id: string, options?: { onlineOnly?: boolean }): PublicService | undefined {
  const onlineOnly = options?.onlineOnly ?? false
  const row = db
    .prepare(
      `SELECT * FROM services
       WHERE id = ? AND active = 1${onlineOnly ? ' AND bookable_online = 1' : ''}`,
    )
    .get(id) as ServiceRow | undefined

  if (!row) return undefined
  return rowToPublic(row)
}
