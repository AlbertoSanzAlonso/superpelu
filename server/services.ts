import { salonServiceById } from '@/data/salonServices'
import { sql, type ServiceRow } from '@server/db.js'

export type PublicService = {
  id: string
  nameEs: string
  nameEn: string
  durationMinutes: number
  categoryId: string | null
  showDurationInBooking: boolean
}

function rowToPublic(row: ServiceRow): PublicService {
  const catalog = salonServiceById.get(row.id)
  return {
    id: row.id,
    nameEs: row.name,
    nameEn: row.name_en ?? '',
    durationMinutes: row.duration_minutes,
    categoryId: row.category_id ?? null,
    showDurationInBooking: catalog?.showDurationInBooking !== false,
  }
}

export async function listActiveServices(options?: {
  onlineOnly?: boolean
}): Promise<PublicService[]> {
  const onlineOnly = options?.onlineOnly ?? true
  const rows = onlineOnly
    ? await sql<ServiceRow[]>`
        SELECT * FROM services
        WHERE active = TRUE AND bookable_online = TRUE
        ORDER BY sort_order ASC, name ASC
      `
    : await sql<ServiceRow[]>`
        SELECT * FROM services
        WHERE active = TRUE
        ORDER BY sort_order ASC, name ASC
      `

  return rows.map(rowToPublic)
}

export async function getService(
  id: string,
  options?: { onlineOnly?: boolean },
): Promise<PublicService | undefined> {
  const onlineOnly = options?.onlineOnly ?? false
  const rows = onlineOnly
    ? await sql<ServiceRow[]>`
        SELECT * FROM services
        WHERE id = ${id} AND active = TRUE AND bookable_online = TRUE
      `
    : await sql<ServiceRow[]>`
        SELECT * FROM services WHERE id = ${id} AND active = TRUE
      `

  const row = rows[0]
  if (!row) return undefined
  return rowToPublic(row)
}
