import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'
import { priceEurToCents, serviceCategories } from '../src/data/serviceCategories.ts'
import { salonServices, salonServiceIds } from '../src/data/salonServices.ts'
import {
  defaultWeeklyHoursForStaff,
  legacyMockStaffIds,
  salonStaffMembers,
} from '../src/data/salonStaff.ts'
import { salonSchedule } from '../src/data/schedule.ts'
import { hashPassword } from './password.js'
import { splitCustomerName } from '../src/lib/customerName.ts'
import { normalizePhone } from '../src/lib/phone.ts'

const dataDir = path.resolve(process.cwd(), 'data')
const dbPath = process.env.DATABASE_PATH ?? path.join(dataDir, 'appointments.sqlite')

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true })
}

export const db = new Database(dbPath)
db.pragma('foreign_keys = ON')

db.exec(`
  CREATE TABLE IF NOT EXISTS services (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
    active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_services_active_sort
    ON services (active, sort_order, name);

  CREATE TABLE IF NOT EXISTS service_categories (
    id TEXT PRIMARY KEY,
    name_es TEXT NOT NULL,
    name_en TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_service_categories_active_sort
    ON service_categories (active, sort_order, name_es);

  CREATE TABLE IF NOT EXISTS staff (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT,
    phone TEXT,
    email TEXT,
    active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_staff_active_sort
    ON staff (active, sort_order, name);

  CREATE TABLE IF NOT EXISTS staff_services (
    staff_id TEXT NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    service_id TEXT NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    PRIMARY KEY (staff_id, service_id)
  );

  CREATE INDEX IF NOT EXISTS idx_staff_services_service
    ON staff_services (service_id);

  CREATE TABLE IF NOT EXISTS staff_availability (
    staff_id TEXT NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    PRIMARY KEY (staff_id, day_of_week)
  );

  CREATE TABLE IF NOT EXISTS appointments (
    id TEXT PRIMARY KEY,
    staff_id TEXT REFERENCES staff(id),
    staff_name TEXT,
    service_id TEXT NOT NULL REFERENCES services(id),
    service_name TEXT NOT NULL,
    duration_minutes INTEGER NOT NULL,
    appointment_date TEXT NOT NULL,
    start_time TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    customer_email TEXT,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'confirmed',
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_appointments_date
    ON appointments (appointment_date, status);

  CREATE TABLE IF NOT EXISTS staff_time_blocks (
    id TEXT PRIMARY KEY,
    staff_id TEXT NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    block_date TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    note TEXT,
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_staff_blocks_staff_date
    ON staff_time_blocks (staff_id, block_date);

  CREATE TABLE IF NOT EXISTS staff_sessions (
    token TEXT PRIMARY KEY,
    staff_id TEXT NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS customers (
    phone TEXT PRIMARY KEY,
    first_name TEXT NOT NULL,
    last_name TEXT,
    email TEXT,
    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_customers_name
    ON customers (last_name, first_name);
`)

function columnExists(table: string, column: string): boolean {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]
  return cols.some((c) => c.name === column)
}

function migrateAppointmentsStaffColumns() {
  if (!columnExists('appointments', 'staff_id')) {
    db.exec(`ALTER TABLE appointments ADD COLUMN staff_id TEXT REFERENCES staff(id)`)
  }
  if (!columnExists('appointments', 'staff_name')) {
    db.exec(`ALTER TABLE appointments ADD COLUMN staff_name TEXT`)
  }
}

function migrateStaffPasswordColumn() {
  if (!columnExists('staff', 'password_hash')) {
    db.exec(`ALTER TABLE staff ADD COLUMN password_hash TEXT`)
  }
}

function migrateServicesCategoryColumn() {
  if (!columnExists('services', 'category_id')) {
    db.exec(
      `ALTER TABLE services ADD COLUMN category_id TEXT REFERENCES service_categories(id)`,
    )
  }
  if (!columnExists('services', 'name_en')) {
    db.exec(`ALTER TABLE services ADD COLUMN name_en TEXT`)
  }
  if (!columnExists('services', 'bookable_online')) {
    db.exec(
      `ALTER TABLE services ADD COLUMN bookable_online INTEGER NOT NULL DEFAULT 1 CHECK (bookable_online IN (0, 1))`,
    )
  }
}

function migrateServiceCategoryPrices() {
  if (!columnExists('service_categories', 'price_from_cents')) {
    db.exec(`ALTER TABLE service_categories ADD COLUMN price_from_cents INTEGER`)
  }
  if (!columnExists('service_categories', 'price_note')) {
    db.exec(`ALTER TABLE service_categories ADD COLUMN price_note TEXT`)
  }
}

function migrateCustomersAndBackfill() {
  const tableExists = (
    db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='customers'`).get() as
      | { name: string }
      | undefined
  )?.name
  if (!tableExists) return

  const appointments = db
    .prepare(`SELECT id, customer_phone, customer_name, customer_email FROM appointments`)
    .all() as {
    id: string
    customer_phone: string
    customer_name: string
    customer_email: string | null
  }[]

  const upsert = db.prepare(
    `INSERT INTO customers (phone, first_name, last_name, email, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, NULL, ?, ?)
     ON CONFLICT(phone) DO UPDATE SET
       first_name = excluded.first_name,
       last_name = excluded.last_name,
       email = COALESCE(excluded.email, customers.email),
       updated_at = excluded.updated_at`,
  )

  const updateAptPhone = db.prepare(`UPDATE appointments SET customer_phone = ? WHERE id = ?`)
  const now = new Date().toISOString()

  for (const row of appointments) {
    const phone = normalizePhone(row.customer_phone)
    if (!phone) continue
    const { firstName, lastName } = splitCustomerName(row.customer_name)
    if (firstName) {
      upsert.run(phone, firstName, lastName || null, row.customer_email, now, now)
    }
    if (row.customer_phone !== phone) {
      updateAptPhone.run(phone, row.id)
    }
  }

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_appointments_customer_phone
      ON appointments (customer_phone, appointment_date);
  `)
}

function migrateStaffBlockSeriesColumns() {
  if (!columnExists('staff_time_blocks', 'series_id')) {
    db.exec(`ALTER TABLE staff_time_blocks ADD COLUMN series_id TEXT`)
  }
  if (!columnExists('staff_time_blocks', 'scope')) {
    db.exec(`ALTER TABLE staff_time_blocks ADD COLUMN scope TEXT`)
  }
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_staff_blocks_series
      ON staff_time_blocks (series_id);
  `)
}

function seedServiceCategories() {
  const now = new Date().toISOString()
  const upsert = db.prepare(
    `INSERT INTO service_categories (
       id, name_es, name_en, active, sort_order, price_from_cents, price_note,
       created_at, updated_at
     ) VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name_es = excluded.name_es,
       name_en = excluded.name_en,
       sort_order = excluded.sort_order,
       price_from_cents = excluded.price_from_cents,
       price_note = excluded.price_note,
       updated_at = excluded.updated_at`,
  )

  for (const category of serviceCategories) {
    const priceFromCents = priceEurToCents(
      'priceFromEur' in category ? category.priceFromEur : undefined,
    )
    const priceNote = 'priceNote' in category ? (category.priceNote ?? null) : null
    upsert.run(
      category.id,
      category.nameEs,
      category.nameEn,
      category.sortOrder,
      priceFromCents,
      priceNote,
      now,
      now,
    )
  }
}

function syncSalonStaff() {
  const now = new Date().toISOString()
  const upsertStaff = db.prepare(
    `INSERT INTO staff (
       id, name, role, phone, email, active, sort_order, password_hash, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       role = excluded.role,
       phone = excluded.phone,
       email = excluded.email,
       active = 1,
       sort_order = excluded.sort_order,
       password_hash = excluded.password_hash,
       updated_at = excluded.updated_at`,
  )
  const insertAvailability = db.prepare(
    `INSERT OR IGNORE INTO staff_availability (staff_id, day_of_week, start_time, end_time)
     VALUES (?, ?, ?, ?)`,
  )
  const deactivateStaff = db.prepare(
    `UPDATE staff SET active = 0, updated_at = ? WHERE id = ?`,
  )

  for (const member of salonStaffMembers) {
    upsertStaff.run(
      member.id,
      member.name,
      member.role,
      member.phone,
      member.email,
      member.sortOrder,
      hashPassword(member.password),
      now,
      now,
    )

    const hours = member.weeklyHours ?? defaultWeeklyHoursForStaff()
    for (const [dayStr, range] of Object.entries(hours)) {
      if (!range) continue
      insertAvailability.run(member.id, Number(dayStr), range.start, range.end)
    }

  }

  for (const legacyId of legacyMockStaffIds) {
    deactivateStaff.run(now, legacyId)
  }
}

function syncSalonServices() {
  const now = new Date().toISOString()
  const upsert = db.prepare(
    `INSERT INTO services (
       id, name, name_en, duration_minutes, category_id, active, sort_order,
       bookable_online, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       name_en = excluded.name_en,
       duration_minutes = excluded.duration_minutes,
       category_id = excluded.category_id,
       active = 1,
       sort_order = excluded.sort_order,
       bookable_online = excluded.bookable_online,
       updated_at = excluded.updated_at`,
  )
  const deactivate = db.prepare(
    `UPDATE services SET active = 0, updated_at = ? WHERE id = ?`,
  )

  for (const service of salonServices) {
    const bookableOnline = service.bookableOnline !== false ? 1 : 0
    upsert.run(
      service.id,
      service.nameEs,
      service.nameEn,
      service.durationMinutes,
      service.categoryId,
      service.sortOrder,
      bookableOnline,
      now,
      now,
    )
  }

  const orphanIds = (
    db.prepare('SELECT id FROM services WHERE active = 1').all() as { id: string }[]
  )
    .map((r) => r.id)
    .filter((id) => !salonServiceIds.has(id))

  for (const id of orphanIds) {
    deactivate.run(now, id)
  }
}

/** Elimina servicios antiguos sin categoría (p. ej. color, corte mock) y sus enlaces. */
function purgeServicesWithoutCategory() {
  const legacyIds = (
    db
      .prepare(`SELECT id FROM services WHERE category_id IS NULL OR trim(category_id) = ''`)
      .all() as { id: string }[]
  ).map((r) => r.id)

  if (legacyIds.length === 0) return

  const deleteStaffLinks = db.prepare('DELETE FROM staff_services WHERE service_id = ?')
  const deleteAppointments = db.prepare('DELETE FROM appointments WHERE service_id = ?')
  const deleteService = db.prepare('DELETE FROM services WHERE id = ?')

  for (const id of legacyIds) {
    deleteStaffLinks.run(id)
    deleteAppointments.run(id)
    deleteService.run(id)
  }
}

/** Cada profesional activo puede realizar todos los servicios activos. */
function syncStaffAllServices() {
  const staffIds = (
    db.prepare('SELECT id FROM staff WHERE active = 1').all() as { id: string }[]
  ).map((r) => r.id)
  const serviceIds = (
    db.prepare('SELECT id FROM services WHERE active = 1').all() as { id: string }[]
  ).map((r) => r.id)

  const insert = db.prepare(
    'INSERT OR IGNORE INTO staff_services (staff_id, service_id) VALUES (?, ?)',
  )

  for (const staffId of staffIds) {
    for (const serviceId of serviceIds) {
      insert.run(staffId, serviceId)
    }
  }

  db.prepare(
    `DELETE FROM staff_services
     WHERE staff_id IN (SELECT id FROM staff WHERE active = 0)
        OR service_id IN (SELECT id FROM services WHERE active = 0)`,
  ).run()
}

/** Horario semanal por profesional (mar–sáb 10:00–20:00 por defecto = franja fija). */
function seedStaffAvailabilityIfMissing() {
  const staffIds = (
    db.prepare('SELECT id FROM staff WHERE active = 1').all() as { id: string }[]
  ).map((r) => r.id)

  const insert = db.prepare(
    `INSERT OR IGNORE INTO staff_availability (staff_id, day_of_week, start_time, end_time)
     VALUES (?, ?, ?, ?)`,
  )

  for (const staffId of staffIds) {
    const { count } = db
      .prepare('SELECT COUNT(*) AS count FROM staff_availability WHERE staff_id = ?')
      .get(staffId) as { count: number }
    if (count > 0) continue

    for (const day of salonSchedule.openDays) {
      insert.run(staffId, day, salonSchedule.openTime, salonSchedule.closeTime)
    }
  }
}

function seedStaffPasswordsIfMissing() {
  for (const member of salonStaffMembers) {
    db.prepare(
      `UPDATE staff SET password_hash = ? WHERE id = ? AND (password_hash IS NULL OR password_hash = '')`,
    ).run(hashPassword(member.password), member.id)
  }
}

migrateAppointmentsStaffColumns()
migrateStaffPasswordColumn()
migrateServicesCategoryColumn()
migrateServiceCategoryPrices()
migrateStaffBlockSeriesColumns()
migrateCustomersAndBackfill()

if (columnExists('appointments', 'staff_id')) {
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_appointments_staff_date
      ON appointments (staff_id, appointment_date, status);
  `)
}

seedServiceCategories()
syncSalonServices()
purgeServicesWithoutCategory()
syncSalonStaff()
syncStaffAllServices()
seedStaffAvailabilityIfMissing()
seedStaffPasswordsIfMissing()

export type CustomerRow = {
  phone: string
  first_name: string
  last_name: string | null
  email: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export type AppointmentRow = {
  id: string
  staff_id: string | null
  staff_name: string | null
  service_id: string
  service_name: string
  duration_minutes: number
  appointment_date: string
  start_time: string
  customer_name: string
  customer_phone: string
  customer_email: string | null
  notes: string | null
  status: string
  created_at: string
}

export type StaffRow = {
  id: string
  name: string
  role: string | null
  phone: string | null
  email: string | null
  password_hash: string | null
  active: 0 | 1
  sort_order: number
  created_at: string
  updated_at: string
}

export type StaffBlockRow = {
  id: string
  staff_id: string
  block_date: string
  start_time: string
  end_time: string
  note: string | null
  series_id: string | null
  scope: string | null
  created_at: string
}

export type ServiceCategoryRow = {
  id: string
  name_es: string
  name_en: string
  active: 0 | 1
  sort_order: number
  price_from_cents: number | null
  price_note: string | null
  created_at: string
  updated_at: string
}

export type ServiceRow = {
  id: string
  name: string
  name_en: string | null
  duration_minutes: number
  category_id: string | null
  bookable_online: 0 | 1
  active: 0 | 1
  sort_order: number
  created_at: string
  updated_at: string
}

export type StaffAvailabilityRow = {
  staff_id: string
  day_of_week: number
  start_time: string
  end_time: string
}
