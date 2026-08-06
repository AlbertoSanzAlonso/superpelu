import { priceEurToCents, serviceCategories } from '@/data/serviceCategories'
import { salonServices, salonServiceIds } from '@/data/salonServices'
import {
  legacyMockStaffIds,
  salonStaffMembers,
} from '@/data/salonStaff'
import { sql } from '@server/pg/client.js'
import { staffWeeklyHoursRestoreV1 } from '@server/pg/staffHoursRestoreV1.js'
import { seedSalonScheduleIfMissing, setStaffSchedule } from '@server/schedule/index.js'

/**
 * Escritura única de horarios de partida (Susana/Mónica/Andrea/Olga).
 * Después solo se cambian desde `/horarios` → BD; el arranque no vuelve a fijarlos.
 */
const STAFF_HOURS_RESTORE_KEY = 'staff_weekly_hours_restored_v1'

function nowIso(): string {
  return new Date().toISOString()
}

export async function seedServiceCategories(): Promise<void> {
  const now = nowIso()
  for (const category of serviceCategories) {
    const priceFromCents = priceEurToCents(
      'priceFromEur' in category ? category.priceFromEur : undefined,
    )
    const priceNote = 'priceNote' in category ? (category.priceNote ?? null) : null
    await sql`
      INSERT INTO service_categories (
        id, name_es, name_en, active, sort_order, price_from_cents, price_note,
        created_at, updated_at
      ) VALUES (
        ${category.id}, ${category.nameEs}, ${category.nameEn}, TRUE,
        ${category.sortOrder}, ${priceFromCents}, ${priceNote}, ${now}, ${now}
      )
      ON CONFLICT (id) DO UPDATE SET
        name_es = EXCLUDED.name_es,
        name_en = EXCLUDED.name_en,
        sort_order = EXCLUDED.sort_order,
        price_from_cents = EXCLUDED.price_from_cents,
        price_note = EXCLUDED.price_note,
        updated_at = EXCLUDED.updated_at
    `
  }
}

export async function syncSalonServices(): Promise<void> {
  const now = nowIso()
  for (const service of salonServices) {
    const bookableOnline = service.bookableOnline !== false
    await sql`
      INSERT INTO services (
        id, name, name_en, duration_minutes, category_id, active, sort_order,
        bookable_online, created_at, updated_at
      ) VALUES (
        ${service.id}, ${service.nameEs}, ${service.nameEn}, ${service.durationMinutes},
        ${service.categoryId}, TRUE, ${service.sortOrder}, ${bookableOnline}, ${now}, ${now}
      )
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        name_en = EXCLUDED.name_en,
        duration_minutes = EXCLUDED.duration_minutes,
        category_id = EXCLUDED.category_id,
        active = TRUE,
        sort_order = EXCLUDED.sort_order,
        bookable_online = EXCLUDED.bookable_online,
        updated_at = EXCLUDED.updated_at
    `
  }

  const activeRows = await sql<{ id: string }[]>`
    SELECT id FROM services WHERE active = TRUE
  `
  const orphanIds = activeRows.map((r) => r.id).filter((id) => !salonServiceIds.has(id))

  for (const id of orphanIds) {
    await sql`
      UPDATE services SET active = FALSE, updated_at = ${now} WHERE id = ${id}
    `
  }
}

export async function purgeServicesWithoutCategory(): Promise<void> {
  const legacyRows = await sql<{ id: string }[]>`
    SELECT id FROM services
    WHERE category_id IS NULL OR trim(category_id) = ''
  `
  for (const { id } of legacyRows) {
    await sql`DELETE FROM staff_services WHERE service_id = ${id}`
    await sql`DELETE FROM appointments WHERE service_id = ${id}`
    await sql`DELETE FROM services WHERE id = ${id}`
  }
}

export async function syncSalonStaff(): Promise<void> {
  const now = nowIso()
  for (const member of salonStaffMembers) {
    await sql`
      INSERT INTO staff (
        id, name, role, phone, email, active, sort_order, password_hash, created_at, updated_at
      ) VALUES (
        ${member.id}, ${member.name}, ${member.role}, ${member.phone}, ${member.email},
        TRUE, ${member.sortOrder}, NULL, ${now}, ${now}
      )
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        role = EXCLUDED.role,
        phone = EXCLUDED.phone,
        email = EXCLUDED.email,
        active = TRUE,
        sort_order = EXCLUDED.sort_order,
        updated_at = EXCLUDED.updated_at
    `
  }

  for (const legacyId of legacyMockStaffIds) {
    await sql`
      UPDATE staff SET active = FALSE, updated_at = ${now} WHERE id = ${legacyId}
    `
  }
}

/**
 * Si un profesional activo no tiene categorías, le asigna todas las activas
 * (migración / primer arranque). No pisa asociaciones ya editadas en admin.
 */
export async function seedStaffCategoriesIfMissing(): Promise<void> {
  const staffIds = (
    await sql<{ id: string }[]>`SELECT id FROM staff WHERE active = TRUE`
  ).map((r) => r.id)
  const categoryIds = (
    await sql<{ id: string }[]>`
      SELECT id FROM service_categories WHERE active = TRUE
    `
  ).map((r) => r.id)

  for (const staffId of staffIds) {
    const [{ count }] = await sql<{ count: string }[]>`
      SELECT COUNT(*)::text AS count FROM staff_categories WHERE staff_id = ${staffId}
    `
    if (Number(count) > 0) continue
    for (const categoryId of categoryIds) {
      await sql`
        INSERT INTO staff_categories (staff_id, category_id)
        VALUES (${staffId}, ${categoryId})
        ON CONFLICT DO NOTHING
      `
    }
  }

  await sql`
    DELETE FROM staff_categories
    WHERE staff_id IN (SELECT id FROM staff WHERE active = FALSE)
       OR category_id IN (SELECT id FROM service_categories WHERE active = FALSE)
  `
}

/** Reconstruye `staff_services` a partir de `staff_categories` (cache derivada). */
export async function syncStaffAllServices(): Promise<void> {
  await sql`
    DELETE FROM staff_services
    WHERE staff_id IN (SELECT id FROM staff WHERE active = FALSE)
       OR service_id IN (SELECT id FROM services WHERE active = FALSE)
  `

  await sql`
    INSERT INTO staff_services (staff_id, service_id)
    SELECT sc.staff_id, svc.id
    FROM staff_categories sc
    INNER JOIN staff s ON s.id = sc.staff_id AND s.active = TRUE
    INNER JOIN services svc
      ON svc.category_id = sc.category_id AND svc.active = TRUE
    ON CONFLICT DO NOTHING
  `

  await sql`
    DELETE FROM staff_services ss
    WHERE NOT EXISTS (
      SELECT 1
      FROM staff_categories sc
      INNER JOIN services svc ON svc.id = ss.service_id AND svc.category_id = sc.category_id
      WHERE sc.staff_id = ss.staff_id
    )
  `
}

async function writeStaffWeeklyHours(
  staffId: string,
  hours: Partial<Record<number, readonly { start: string; end: string }[]>>,
): Promise<void> {
  const weeklyWindows: Record<number, { start: string; end: string }[]> = {}
  for (const [dayStr, ranges] of Object.entries(hours)) {
    if (!ranges?.length) continue
    weeklyWindows[Number(dayStr)] = ranges.map((r) => ({ start: r.start, end: r.end }))
  }
  await setStaffSchedule(staffId, weeklyWindows)
}

/**
 * Aplica los horarios de partida una sola vez y marca el flag.
 * No hay más escrituras automáticas de `staff_availability` en el seed.
 */
export async function applyStartingStaffWeeklyHoursOnce(): Promise<void> {
  const existing = await sql<{ value: string }[]>`
    SELECT value FROM salon_settings WHERE key = ${STAFF_HOURS_RESTORE_KEY} LIMIT 1
  `
  if (existing.length > 0) return

  for (const [staffId, hours] of Object.entries(staffWeeklyHoursRestoreV1)) {
    await writeStaffWeeklyHours(staffId, hours)
  }

  const now = nowIso()
  await sql`
    INSERT INTO salon_settings (key, value, updated_at)
    VALUES (${STAFF_HOURS_RESTORE_KEY}, ${now}, ${now})
    ON CONFLICT (key) DO NOTHING
  `
}

export async function runSeed(): Promise<void> {
  await seedServiceCategories()
  await syncSalonServices()
  await purgeServicesWithoutCategory()
  await syncSalonStaff()
  await seedStaffCategoriesIfMissing()
  await syncStaffAllServices()
  await seedSalonScheduleIfMissing()
  // Una sola vez: horarios de partida en BD. Luego solo editables en `/horarios`.
  await applyStartingStaffWeeklyHoursOnce()
}
