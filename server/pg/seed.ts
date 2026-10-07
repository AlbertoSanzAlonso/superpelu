import { priceEurToCents, serviceCategories } from '@/data/serviceCategories'
import { salonServices } from '@/data/salonServices'
import {
  legacyMockStaffIds,
  salonStaffMembers,
} from '@/data/salonStaff'
import { COLOR_GROUP_ROLE, COLOR_SPLIT_SERVICE_IDS } from '@/lib/booking/occupancy'
import {
  defaultColorSplitPattern,
  formatTreatmentSegmentLabel,
  parseBookingPattern,
  patternTotalSpanMinutes,
  patternWorkSteps,
  workStepDisplayName,
} from '@/lib/booking/servicePattern'
import type { Locale } from '@/i18n/types'
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
 * Corrige booking_pattern guardados como scalar string JSONB
 * (PATCH admin antiguo con JSON.stringify + postgres.js).
 */
export async function repairDoubleEncodedBookingPatterns(): Promise<void> {
  await sql`
    UPDATE services
    SET
      booking_pattern = (booking_pattern #>> '{}')::jsonb,
      updated_at = ${nowIso()}
    WHERE booking_pattern IS NOT NULL
      AND jsonb_typeof(booking_pattern) = 'string'
  `
}

/**
 * Coloración: escribe el patrón 30+pausa+30 solo si aún no hay booking_pattern.
 * No pisa ediciones del panel.
 */
export async function seedColorSplitPatternsIfMissing(): Promise<void> {
  const now = nowIso()
  const pattern = defaultColorSplitPattern()
  const duration = patternTotalSpanMinutes(pattern)
  const ids = [...COLOR_SPLIT_SERVICE_IDS]
  for (const id of ids) {
    await sql`
      UPDATE services
      SET
        booking_pattern = ${sql.json(pattern)},
        duration_minutes = ${duration},
        updated_at = ${now}
      WHERE id = ${id}
        AND booking_pattern IS NULL
    `
  }
}

/**
 * Citas de grupo color: service_name = «Tratamiento - Tramo».
 */
export async function repairColorGroupAppointmentLabels(): Promise<void> {
  const rows = await sql<
    {
      id: string
      color_group_id: string
      color_group_role: string | null
      locale: string
      service_id: string
      service_name: string
      service_name_es: string
      service_name_en: string | null
      booking_pattern: unknown
    }[]
  >`
    SELECT
      a.id,
      a.color_group_id,
      a.color_group_role,
      a.locale,
      a.service_id,
      a.service_name,
      s.name AS service_name_es,
      s.name_en AS service_name_en,
      s.booking_pattern
    FROM appointments a
    INNER JOIN services s ON s.id = a.service_id
    WHERE a.color_group_id IS NOT NULL
      AND a.color_group_role IS NOT NULL
  `

  const byGroup = new Map<string, typeof rows>()
  for (const row of rows) {
    const list = byGroup.get(row.color_group_id) ?? []
    list.push(row)
    byGroup.set(row.color_group_id, list)
  }

  for (const group of byGroup.values()) {
    const colorRow = group.find((row) => row.color_group_role === COLOR_GROUP_ROLE.color)
    if (!colorRow) continue

    const locale: Locale = colorRow.locale === 'en' ? 'en' : 'es'
    const treatmentName =
      locale === 'en'
        ? colorRow.service_name_en?.trim() || colorRow.service_name_es
        : colorRow.service_name_es
    const pattern = parseBookingPattern(colorRow.booking_pattern)
    const works = pattern ? patternWorkSteps(pattern) : []

    const ordered = [...group].sort((a, b) => {
      if (a.color_group_role === COLOR_GROUP_ROLE.color) return -1
      if (b.color_group_role === COLOR_GROUP_ROLE.color) return 1
      return 0
    })

    let workOrdinal = 0
    for (const row of ordered) {
      const step = works[workOrdinal]
      workOrdinal += 1
      const segmentName =
        step && (step.nameEs?.trim() || step.nameEn?.trim())
          ? workStepDisplayName(step, locale, '')
          : row.color_group_role === COLOR_GROUP_ROLE.color
            ? ''
            : row.service_name.includes(' - ')
              ? row.service_name.slice(row.service_name.indexOf(' - ') + 3)
              : row.service_name
      const nextLabel = formatTreatmentSegmentLabel(treatmentName, segmentName)
      if (nextLabel === row.service_name) continue
      await sql`
        UPDATE appointments
        SET service_name = ${nextLabel}
        WHERE id = ${row.id}
      `
    }
  }
}

export async function runSeed(): Promise<void> {
  // Solo inserts de filas ausentes + caches derivadas. No reescribe catálogo/personal/horarios.
  await seedServiceCategories()
  await syncSalonServices()
  await repairDoubleEncodedBookingPatterns()
  await seedColorSplitPatternsIfMissing()
  await repairColorGroupAppointmentLabels()
  await syncSalonStaff()
  await seedStaffCategoriesIfMissing()
  await syncStaffAllServices()
  await seedSalonScheduleIfMissing()
  // Una sola vez: horarios de partida en BD. Luego solo editables en `/horarios`.
  await applyStartingStaffWeeklyHoursOnce()
}
