-- Superpelu — esquema PostgreSQL (Supabase)
-- Ejecutar en SQL Editor de Supabase o vía init al arrancar el servidor.

CREATE TABLE IF NOT EXISTS service_categories (
  id TEXT PRIMARY KEY,
  name_es TEXT NOT NULL,
  name_en TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  price_from_cents INTEGER,
  price_note TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_service_categories_active_sort
  ON service_categories (active, sort_order, name_es);

CREATE TABLE IF NOT EXISTS services (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_en TEXT,
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
  category_id TEXT REFERENCES service_categories(id),
  bookable_online BOOLEAN NOT NULL DEFAULT TRUE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_services_active_sort
  ON services (active, sort_order, name);

CREATE TABLE IF NOT EXISTS staff (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT,
  phone TEXT,
  email TEXT,
  password_hash TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
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
  PRIMARY KEY (staff_id, day_of_week, start_time)
);

-- Varias franjas por día (migración desde PK solo staff_id + day_of_week)
ALTER TABLE staff_availability DROP CONSTRAINT IF EXISTS staff_availability_pkey;
ALTER TABLE staff_availability ADD PRIMARY KEY (staff_id, day_of_week, start_time);

CREATE TABLE IF NOT EXISTS customers (
  phone TEXT PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT,
  email TEXT,
  notes TEXT,
  locale TEXT NOT NULL DEFAULT 'es',
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

ALTER TABLE customers ADD COLUMN IF NOT EXISTS locale TEXT NOT NULL DEFAULT 'es';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS review_request_sent_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_customers_name
  ON customers (last_name, first_name);

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
  created_at TIMESTAMPTZ NOT NULL
);

ALTER TABLE appointments ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS locale TEXT NOT NULL DEFAULT 'es';
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS color_group_id TEXT;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS color_group_role TEXT;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS booking_group_id TEXT;

CREATE INDEX IF NOT EXISTS idx_appointments_booking_group
  ON appointments (booking_group_id)
  WHERE booking_group_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_appointments_color_group
  ON appointments (color_group_id)
  WHERE color_group_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_appointments_date
  ON appointments (appointment_date, status);

CREATE INDEX IF NOT EXISTS idx_appointments_reminder
  ON appointments (appointment_date, start_time)
  WHERE status = 'confirmed' AND reminder_sent_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_appointments_staff_date
  ON appointments (staff_id, appointment_date, status);

CREATE INDEX IF NOT EXISTS idx_appointments_customer_phone
  ON appointments (customer_phone, appointment_date);

CREATE TABLE IF NOT EXISTS staff_time_blocks (
  id TEXT PRIMARY KEY,
  staff_id TEXT NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  block_date TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  note TEXT,
  series_id TEXT,
  scope TEXT,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_staff_blocks_staff_date
  ON staff_time_blocks (staff_id, block_date);

CREATE INDEX IF NOT EXISTS idx_staff_blocks_series
  ON staff_time_blocks (series_id);

CREATE TABLE IF NOT EXISTS staff_sessions (
  token TEXT PRIMARY KEY,
  staff_id TEXT NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL
);
