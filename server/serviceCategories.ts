import { db, type ServiceCategoryRow } from './db.js'
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

export function listActiveServiceCategories(): PublicServiceCategory[] {
  const rows = db
    .prepare(
      `SELECT * FROM service_categories
       WHERE active = 1
       ORDER BY sort_order ASC, name_es ASC`,
    )
    .all() as ServiceCategoryRow[]

  if (rows.length > 0) {
    return rows.map(rowToPublic)
  }

  return serviceCategories.map(seedToPublic)
}

export function getServiceCategory(id: string): PublicServiceCategory | undefined {
  const row = db
    .prepare('SELECT * FROM service_categories WHERE id = ? AND active = 1')
    .get(id) as ServiceCategoryRow | undefined

  if (row) return rowToPublic(row)

  const fallback = serviceCategories.find((c) => c.id === id)
  if (!fallback) return undefined

  return seedToPublic(fallback)
}
