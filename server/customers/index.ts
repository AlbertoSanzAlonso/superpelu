import { sql, type AppointmentRow, type CustomerRow } from '@server/db.js'
import {
  formatCustomerDisplayName,
  splitCustomerName,
} from '@/lib/customer/name'
import { normalizeLocale, type Locale } from '@/i18n/types'
import { normalizePhone, isValidSpanishPhone } from '@/lib/customer/phone'
import { isValidDateString, todaySalon } from '@/lib/core/dates'

export type CustomerInput = {
  firstName: string
  lastName?: string
  phone: string
  email?: string | null
  notes?: string | null
  /** Si se omite en actualización, se conserva el idioma guardado. */
  locale?: Locale
  /**
   * `undefined` = no tocar birthdate en upsert.
   * `null` = borrar.
   * `YYYY-MM-DD` = guardar.
   */
  birthdate?: string | null
}

export type PublicCustomer = {
  phone: string
  firstName: string
  lastName: string
  email: string | null
  notes: string | null
  locale: Locale
  birthdate: string | null
  reviewRequestSentAt: string | null
  appointmentCount: number
  lastAppointmentDate: string | null
  createdAt: string
  updatedAt: string
}

/** Normaliza birthdate a YYYY-MM-DD o null; lanza FECHA_NACIMIENTO_INVALIDA. */
export function normalizeBirthdate(raw: string | null | undefined): string | null {
  if (raw === undefined || raw === null) return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  if (!isValidDateString(trimmed)) throw new Error('FECHA_NACIMIENTO_INVALIDA')
  if (trimmed > todaySalon()) {
    throw new Error('FECHA_NACIMIENTO_INVALIDA')
  }
  return trimmed
}

function birthdateToIso(value: string | Date | null | undefined): string | null {
  if (value == null) return null
  if (typeof value === 'string') {
    // postgres puede devolver Date o string según driver
    return value.slice(0, 10)
  }
  return value.toISOString().slice(0, 10)
}

function rowToPublic(row: CustomerRow, stats?: { count: number; lastDate: string | null }): PublicCustomer {
  return {
    phone: row.phone,
    firstName: row.first_name,
    lastName: row.last_name ?? '',
    email: row.email,
    notes: row.notes,
    locale: normalizeLocale(row.locale),
    birthdate: birthdateToIso(row.birthdate),
    reviewRequestSentAt: row.review_request_sent_at ?? null,
    appointmentCount: stats?.count ?? 0,
    lastAppointmentDate: stats?.lastDate ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function resolveCustomerFromInput(input: {
  firstName?: string
  lastName?: string
  customerName?: string
  phone: string
}): { firstName: string; lastName: string; phone: string } {
  const phone = normalizePhone(input.phone)
  if (!isValidSpanishPhone(input.phone)) {
    throw new Error('TELEFONO_INVALIDO')
  }

  let firstName = input.firstName?.trim() ?? ''
  let lastName = input.lastName?.trim() ?? ''

  if (!firstName && input.customerName) {
    const split = splitCustomerName(input.customerName)
    firstName = split.firstName
    lastName = split.lastName
  }

  if (!firstName) throw new Error('NOMBRE_INVALIDO')

  return { firstName, lastName, phone }
}

/** Crea o actualiza ficha de cliente (PK = teléfono normalizado). */
export async function upsertCustomer(input: CustomerInput): Promise<CustomerRow> {
  const { firstName, lastName, phone } = resolveCustomerFromInput(input)
  const now = new Date().toISOString()
  const email = input.email?.trim() || null
  const notes = input.notes?.trim() || null
  const localeForInsert = normalizeLocale(input.locale ?? 'es')
  const localeOnConflict =
    input.locale !== undefined ? localeForInsert : sql`customers.locale`

  const birthdateProvided = input.birthdate !== undefined
  const birthdate = birthdateProvided ? normalizeBirthdate(input.birthdate) : null

  if (birthdateProvided) {
    await sql`
      INSERT INTO customers (
        phone, first_name, last_name, email, notes, locale, birthdate, created_at, updated_at
      )
      VALUES (
        ${phone}, ${firstName}, ${lastName || null}, ${email}, ${notes},
        ${localeForInsert}, ${birthdate}, ${now}, ${now}
      )
      ON CONFLICT (phone) DO UPDATE SET
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        email = COALESCE(EXCLUDED.email, customers.email),
        notes = COALESCE(EXCLUDED.notes, customers.notes),
        locale = ${localeOnConflict},
        birthdate = EXCLUDED.birthdate,
        updated_at = EXCLUDED.updated_at
    `
  } else {
    await sql`
      INSERT INTO customers (
        phone, first_name, last_name, email, notes, locale, created_at, updated_at
      )
      VALUES (
        ${phone}, ${firstName}, ${lastName || null}, ${email}, ${notes},
        ${localeForInsert}, ${now}, ${now}
      )
      ON CONFLICT (phone) DO UPDATE SET
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        email = COALESCE(EXCLUDED.email, customers.email),
        notes = COALESCE(EXCLUDED.notes, customers.notes),
        locale = ${localeOnConflict},
        updated_at = EXCLUDED.updated_at
    `
  }

  const rows = await sql<CustomerRow[]>`
    SELECT * FROM customers WHERE phone = ${phone}
  `
  return rows[0]!
}

/** Crea ficha nueva; falla si el teléfono ya existe. */
export async function createCustomer(input: CustomerInput): Promise<CustomerRow> {
  const { firstName, lastName, phone } = resolveCustomerFromInput(input)
  const existing = await getCustomer(phone)
  if (existing) throw new Error('CLIENTE_YA_EXISTE')

  const now = new Date().toISOString()
  const email = input.email?.trim() || null
  const notes = input.notes?.trim() || null
  const locale = normalizeLocale(input.locale ?? 'es')
  const birthdate =
    input.birthdate !== undefined ? normalizeBirthdate(input.birthdate) : null

  await sql`
    INSERT INTO customers (
      phone, first_name, last_name, email, notes, locale, birthdate, created_at, updated_at
    )
    VALUES (
      ${phone}, ${firstName}, ${lastName || null}, ${email}, ${notes},
      ${locale}, ${birthdate}, ${now}, ${now}
    )
  `

  const rows = await sql<CustomerRow[]>`
    SELECT * FROM customers WHERE phone = ${phone}
  `
  return rows[0]!
}

export type CustomerUpdateInput = {
  firstName: string
  lastName?: string
  email?: string | null
  notes?: string | null
  locale?: Locale
  birthdate?: string | null
}

/** Actualiza ficha existente (el teléfono / PK no cambia). */
export async function updateCustomer(
  phone: string,
  input: CustomerUpdateInput,
): Promise<CustomerRow> {
  const normalized = normalizePhone(phone)
  if (!normalized) throw new Error('TELEFONO_INVALIDO')

  const existing = await getCustomer(normalized)
  if (!existing) throw new Error('CLIENTE_NO_ENCONTRADO')

  const firstName = input.firstName?.trim() ?? ''
  if (!firstName) throw new Error('NOMBRE_INVALIDO')

  const lastName = input.lastName?.trim() ?? ''
  const email = input.email === undefined ? existing.email : input.email?.trim() || null
  const notes = input.notes === undefined ? existing.notes : input.notes?.trim() || null
  const locale =
    input.locale === undefined ? normalizeLocale(existing.locale) : normalizeLocale(input.locale)
  const birthdate =
    input.birthdate === undefined
      ? birthdateToIso(existing.birthdate)
      : normalizeBirthdate(input.birthdate)
  const now = new Date().toISOString()

  await sql`
    UPDATE customers SET
      first_name = ${firstName},
      last_name = ${lastName || null},
      email = ${email},
      notes = ${notes},
      locale = ${locale},
      birthdate = ${birthdate},
      updated_at = ${now}
    WHERE phone = ${normalized}
  `

  const rows = await sql<CustomerRow[]>`
    SELECT * FROM customers WHERE phone = ${normalized}
  `
  return rows[0]!
}

export async function getCustomer(phone: string): Promise<CustomerRow | undefined> {
  const normalized = normalizePhone(phone)
  if (!normalized) return undefined
  const rows = await sql<CustomerRow[]>`
    SELECT * FROM customers WHERE phone = ${normalized}
  `
  return rows[0]
}

/** Lookup público mínimo para reserva (sin filtrar PII extra). */
export async function lookupCustomerForBooking(
  phone: string,
): Promise<{ found: true; firstName: string } | { found: false }> {
  const customer = await getCustomer(phone)
  if (!customer) return { found: false }
  return { found: true, firstName: customer.first_name }
}

export function customerNameSnapshot(firstName: string, lastName: string): string {
  return formatCustomerDisplayName(firstName, lastName)
}

/**
 * Upsert de ficha al crear cita.
 * - Cliente habitual (público): exige ficha existente; no pisa nombre/cumpleaños.
 * - Cliente nuevo (público): exige birthdate.
 * - Agenda: birthdate opcional.
 */
export async function upsertCustomerForBooking(input: {
  customerName?: string
  customerFirstName?: string
  customerLastName?: string
  customerPhone: string
  customerEmail?: string
  customerNotes?: string
  locale?: Locale
  birthdate?: string | null
  returningCustomer?: boolean
  forStaffPortal?: boolean
}): Promise<{ phone: string; nameSnapshot: string; profile: CustomerRow }> {
  const phone = normalizePhone(input.customerPhone)
  if (!isValidSpanishPhone(input.customerPhone)) {
    throw new Error('TELEFONO_INVALIDO')
  }

  if (!input.forStaffPortal && input.returningCustomer) {
    const existing = await getCustomer(phone)
    if (!existing) throw new Error('CLIENTE_NO_ENCONTRADO')

    await upsertCustomer({
      firstName: existing.first_name,
      lastName: existing.last_name ?? '',
      phone: existing.phone,
      email: input.customerEmail,
      ...(input.customerNotes !== undefined
        ? { notes: input.customerNotes.trim() || null }
        : {}),
      ...(input.locale !== undefined ? { locale: normalizeLocale(input.locale) } : {}),
    })
    const profile = (await getCustomer(phone))!
    return {
      phone: profile.phone,
      nameSnapshot: customerNameSnapshot(profile.first_name, profile.last_name ?? ''),
      profile,
    }
  }

  if (!input.forStaffPortal) {
    const birthdate = normalizeBirthdate(input.birthdate)
    if (!birthdate) throw new Error('FECHA_NACIMIENTO_OBLIGATORIA')
    const customer = resolveCustomerFromInput({
      firstName: input.customerFirstName,
      lastName: input.customerLastName,
      customerName: input.customerName,
      phone: input.customerPhone,
    })
    await upsertCustomer({
      firstName: customer.firstName,
      lastName: customer.lastName,
      phone: customer.phone,
      email: input.customerEmail,
      ...(input.customerNotes !== undefined
        ? { notes: input.customerNotes.trim() || null }
        : {}),
      locale: normalizeLocale(input.locale ?? 'es'),
      birthdate,
    })
    const profile = (await getCustomer(customer.phone))!
    return {
      phone: profile.phone,
      nameSnapshot: customerNameSnapshot(profile.first_name, profile.last_name ?? ''),
      profile,
    }
  }

  const customer = resolveCustomerFromInput({
    firstName: input.customerFirstName,
    lastName: input.customerLastName,
    customerName: input.customerName,
    phone: input.customerPhone,
  })
  const customerLocaleForUpsert =
    input.locale !== undefined ? normalizeLocale(input.locale) : undefined
  await upsertCustomer({
    firstName: customer.firstName,
    lastName: customer.lastName,
    phone: customer.phone,
    email: input.customerEmail,
    ...(input.customerNotes !== undefined
      ? { notes: input.customerNotes.trim() || null }
      : {}),
    ...(customerLocaleForUpsert !== undefined ? { locale: customerLocaleForUpsert } : {}),
    ...(input.birthdate !== undefined ? { birthdate: input.birthdate } : {}),
  })
  const profile = (await getCustomer(customer.phone))!
  return {
    phone: profile.phone,
    nameSnapshot: customerNameSnapshot(profile.first_name, profile.last_name ?? ''),
    profile,
  }
}

export async function listCustomers(
  options: { q?: string; limit?: number } = {},
): Promise<PublicCustomer[]> {
  const q = options.q?.trim().toLowerCase() ?? ''
  const limit = Math.min(Math.max(options.limit ?? 5000, 1), 5000)

  const rows = await sql<
    (CustomerRow & {
      appointment_count: number
      last_appointment_date: string | null
    })[]
  >`
    SELECT c.*,
      (SELECT COUNT(*)::int FROM appointments a
       WHERE a.customer_phone = c.phone AND a.status != 'cancelled') AS appointment_count,
      (SELECT MAX(a.appointment_date) FROM appointments a
       WHERE a.customer_phone = c.phone AND a.status != 'cancelled') AS last_appointment_date
    FROM customers c
    ORDER BY c.updated_at DESC
    LIMIT ${limit}
  `

  const filtered = q
    ? rows.filter((row) => {
        const haystack = [
          row.first_name,
          row.last_name ?? '',
          row.phone,
          row.email ?? '',
        ]
          .join(' ')
          .toLowerCase()
        return haystack.includes(q)
      })
    : rows

  return filtered.map((row) =>
    rowToPublic(row, {
      count: row.appointment_count,
      lastDate: row.last_appointment_date,
    }),
  )
}

export async function markCustomerReviewRequestSent(phone: string): Promise<string> {
  const normalized = normalizePhone(phone)
  if (!normalized) throw new Error('TELEFONO_INVALIDO')
  const now = new Date().toISOString()
  await sql`
    UPDATE customers SET review_request_sent_at = ${now}, updated_at = ${now}
    WHERE phone = ${normalized}
  `
  return now
}

export async function markBirthdayWishSent(phone: string, year: number): Promise<void> {
  const normalized = normalizePhone(phone)
  if (!normalized) return
  const now = new Date().toISOString()
  await sql`
    UPDATE customers SET
      birthday_wish_sent_year = ${year},
      updated_at = ${now}
    WHERE phone = ${normalized}
  `
}

export async function listCustomersWithBirthdayToday(): Promise<CustomerRow[]> {
  return sql<CustomerRow[]>`
    SELECT *
    FROM customers
    WHERE birthdate IS NOT NULL
      AND EXTRACT(MONTH FROM birthdate) = EXTRACT(MONTH FROM (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Madrid')::date)
      AND EXTRACT(DAY FROM birthdate) = EXTRACT(DAY FROM (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Madrid')::date)
      AND (
        birthday_wish_sent_year IS NULL
        OR birthday_wish_sent_year <> EXTRACT(YEAR FROM (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Madrid')::date)::int
      )
  `
}

/** Elimina la ficha del cliente (las citas en agenda/historial se conservan). */
export async function deleteCustomer(phone: string): Promise<boolean> {
  const normalized = normalizePhone(phone)
  if (!normalized) return false
  const result = await sql`DELETE FROM customers WHERE phone = ${normalized}`
  return result.count > 0
}

export async function listCustomerAppointments(phone: string) {
  const normalized = normalizePhone(phone)
  if (!normalized) return []

  return sql<AppointmentRow[]>`
    SELECT * FROM appointments
    WHERE customer_phone = ${normalized}
    ORDER BY appointment_date DESC, start_time DESC
  `
}

export { birthdateToIso }
