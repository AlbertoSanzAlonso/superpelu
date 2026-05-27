import { sql, type ServiceCategoryRow } from './db.js'
import { priceEurToCents, serviceCategories } from '../src/data/serviceCategories.ts'

export type PublicServiceCategory = {
  id: string
  nameEs: string
  nameEn: string
  sortOrder: number
  priceFromCents: number | null
  priceNote: string | null
}

function seedToPublic(
  c: (typeof serviceCategories)[number],
): PublicServiceCategory {
  const priceFromCents = priceEurToCents(
    'priceFromEur' in c ? c.priceFromEur : undefined,
  )
  const priceNote = 'priceNote' in c ? (c.priceNote ?? null) : null
  return {
    id: c.id,
    nameEs: c.nameEs,
    nameEn: c.nameEn,
    sortOrder: c.sortOrder,
    priceFromCents,
    priceNote,
  }
}

function rowToPublic(row: ServiceCategoryRow): PublicServiceCategory {
  return {
    id: row.id,
    nameEs: row.name_es,
    nameEn: row.name_en,
    sortOrder: row.sort_order,
    priceFromCents: row.price_from_cents ?? null,
    priceNote: row.price_note ?? null,
  }
}

export async function listActiveServiceCategories(): Promise<PublicServiceCategory[]> {
  const rows = await sql<ServiceCategoryRow[]>`
    SELECT * FROM service_categories
    WHERE active = TRUE
    ORDER BY sort_order ASC, name_es ASC
  `

  if (rows.length > 0) {
    return rows.map(rowToPublic)
  }

  return serviceCategories.map(seedToPublic)
}

export async function getServiceCategory(
  id: string,
): Promise<PublicServiceCategory | undefined> {
  const rows = await sql<ServiceCategoryRow[]>`
    SELECT * FROM service_categories WHERE id = ${id} AND active = TRUE
  `
  const row = rows[0]
  if (row) return rowToPublic(row)

  const fallback = serviceCategories.find((c) => c.id === id)
  if (!fallback) return undefined

  return seedToPublic(fallback)
}
