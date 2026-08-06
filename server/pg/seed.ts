import { priceEurToCents, serviceCategories } from '@/data/serviceCategories'
import { salonServices } from '@/data/salonServices'
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

/**
 * Una sola vez: clientes con teléfono internacional (no +34) → locale `en`
 * (cumpleaños, reseñas, futuras citas desde ficha). También citas activas de esos teléfonos.
 */
const CUSTOMERS_INTL_LOCALE_EN_KEY = 'customers_intl_locale_en_v1'

function nowIso(): string {
  return new Date().toISOString()
}

/**
 * Catálogo / personal: solo inserta filas que faltan.
 * Un redeploy no pisa ediciones del panel admin (nombres, duraciones, altas, bajas…).
 */
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
      ON CONFLICT (id) DO NOTHING
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
      ON CONFLICT (id) DO NOTHING
    `
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
      ON CONFLICT (id) DO NOTHING
    `
  }

  for (const legacyId of legacyMockStaffIds) {
    await sql`
      UPDATE staff SET active = FALSE, updated_at = ${now}
      WHERE id = ${legacyId} AND active = TRUE
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

/**
 * Una sola vez: números fuera de España → `customers.locale = en`
 * (+ citas no canceladas de esos clientes, para WhatsApp/recordatorios).
 */
export async function applyIntlCustomersLocaleEnOnce(): Promise<void> {
  const existing = await sql<{ value: string }[]>`
    SELECT value FROM salon_settings WHERE key = ${CUSTOMERS_INTL_LOCALE_EN_KEY} LIMIT 1
  `
  if (existing.length > 0) return

  const now = nowIso()
  const updatedCustomers = await sql<{ phone: string }[]>`
    UPDATE customers
    SET locale = 'en', updated_at = ${now}
    WHERE phone NOT LIKE '+34%'
      AND locale IS DISTINCT FROM 'en'
    RETURNING phone
  `

  const updatedAppointments = await sql<{ id: string }[]>`
    UPDATE appointments
    SET locale = 'en'
    WHERE customer_phone NOT LIKE '+34%'
      AND status != 'cancelled'
      AND locale IS DISTINCT FROM 'en'
    RETURNING id
  `

  await sql`
    INSERT INTO salon_settings (key, value, updated_at)
    VALUES (${CUSTOMERS_INTL_LOCALE_EN_KEY}, ${now}, ${now})
    ON CONFLICT (key) DO NOTHING
  `

  console.log(
    `Superpelu: locale en para teléfonos internacionales ` +
      `(clientes=${updatedCustomers.length}, citas=${updatedAppointments.length})`,
  )
}

export async function runSeed(): Promise<void> {
  // Solo inserts de filas ausentes + caches derivadas. No reescribe catálogo/personal/horarios.
  await seedServiceCategories()
  await syncSalonServices()
  await syncSalonStaff()
  await seedStaffCategoriesIfMissing()
  await syncStaffAllServices()
  await seedSalonScheduleIfMissing()
  // Una sola vez: horarios de partida en BD. Luego solo editables en `/horarios`.
  await applyStartingStaffWeeklyHoursOnce()
  // Una sola vez: clientes internacionales → inglés.
  await applyIntlCustomersLocaleEnOnce()
}
