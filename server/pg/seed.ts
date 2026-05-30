import { priceEurToCents, serviceCategories } from '@/data/serviceCategories'
import { salonServices, salonServiceIds } from '@/data/salonServices'
import {
  defaultWeeklyHoursForStaff,
  legacyMockStaffIds,
  salonStaffMembers,
} from '@/data/salonStaff'
import { salonSchedule } from '@/data/schedule'
import { hashPassword } from '../password.js'
import { sql } from './client.js'

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
        TRUE, ${member.sortOrder}, ${hashPassword(member.password)}, ${now}, ${now}
      )
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        role = EXCLUDED.role,
        phone = EXCLUDED.phone,
        email = EXCLUDED.email,
        active = TRUE,
        sort_order = EXCLUDED.sort_order,
        password_hash = EXCLUDED.password_hash,
        updated_at = EXCLUDED.updated_at
    `

    const hours = member.weeklyHours ?? defaultWeeklyHoursForStaff()
    for (const [dayStr, range] of Object.entries(hours)) {
      if (!range) continue
      await sql`
        INSERT INTO staff_availability (staff_id, day_of_week, start_time, end_time)
        VALUES (${member.id}, ${Number(dayStr)}, ${range.start}, ${range.end})
        ON CONFLICT (staff_id, day_of_week) DO NOTHING
      `
    }
  }

  for (const legacyId of legacyMockStaffIds) {
    await sql`
      UPDATE staff SET active = FALSE, updated_at = ${now} WHERE id = ${legacyId}
    `
  }
}

export async function syncStaffAllServices(): Promise<void> {
  const staffIds = (
    await sql<{ id: string }[]>`SELECT id FROM staff WHERE active = TRUE`
  ).map((r) => r.id)
  const serviceIds = (
    await sql<{ id: string }[]>`SELECT id FROM services WHERE active = TRUE`
  ).map((r) => r.id)

  for (const staffId of staffIds) {
    for (const serviceId of serviceIds) {
      await sql`
        INSERT INTO staff_services (staff_id, service_id)
        VALUES (${staffId}, ${serviceId})
        ON CONFLICT DO NOTHING
      `
    }
  }

  await sql`
    DELETE FROM staff_services
    WHERE staff_id IN (SELECT id FROM staff WHERE active = FALSE)
       OR service_id IN (SELECT id FROM services WHERE active = FALSE)
  `
}

export async function seedStaffAvailabilityIfMissing(): Promise<void> {
  const staffIds = (
    await sql<{ id: string }[]>`SELECT id FROM staff WHERE active = TRUE`
  ).map((r) => r.id)

  for (const staffId of staffIds) {
    const [{ count }] = await sql<{ count: string }[]>`
      SELECT COUNT(*)::text AS count FROM staff_availability WHERE staff_id = ${staffId}
    `
    if (Number(count) > 0) continue

    for (const day of salonSchedule.openDays) {
      await sql`
        INSERT INTO staff_availability (staff_id, day_of_week, start_time, end_time)
        VALUES (${staffId}, ${day}, ${salonSchedule.openTime}, ${salonSchedule.closeTime})
        ON CONFLICT (staff_id, day_of_week) DO NOTHING
      `
    }
  }
}

export async function seedStaffPasswordsIfMissing(): Promise<void> {
  for (const member of salonStaffMembers) {
    await sql`
      UPDATE staff SET password_hash = ${hashPassword(member.password)}
      WHERE id = ${member.id}
        AND (password_hash IS NULL OR password_hash = '')
    `
  }
}

export async function runSeed(): Promise<void> {
  await seedServiceCategories()
  await syncSalonServices()
  await purgeServicesWithoutCategory()
  await syncSalonStaff()
  await syncStaffAllServices()
  await seedStaffAvailabilityIfMissing()
  await seedStaffPasswordsIfMissing()
}
