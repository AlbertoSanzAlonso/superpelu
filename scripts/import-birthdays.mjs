/**
 * Importa fechas de nacimiento desde CSV.
 * Uso: npm run db:import-birthdays -- "clients_birthdays_2026-01-01_2026-12-31.csv"
 *
 * Formato: Nombre,Teléfono,Email,Cumpleaños (DD-MM-YYYY)
 */

import { readFileSync } from 'node:fs'
import postgres from 'postgres'

try {
  process.loadEnvFile('.env')
} catch {
  // ok
}

function resolveDatabaseUrl() {
  const direct = process.env.DATABASE_URL?.trim()
  if (direct) return { url: direct, source: 'DATABASE_URL' }

  const ref = process.env.SUPABASE_PROJECT_REF?.trim()
  const password = process.env.SUPABASE_DB_PASSWORD?.trim()
  if (ref && password) {
    const pooler = process.env.SUPABASE_POOLER ?? 'aws-1'
    const region = process.env.SUPABASE_REGION ?? 'eu-central-1'
    const host =
      process.env.SUPABASE_DB_HOST?.trim() ?? `${pooler}-${region}.pooler.supabase.com`
    const port = process.env.SUPABASE_DB_PORT ?? '5432'
    const user = process.env.SUPABASE_DB_USER ?? `postgres.${ref}`
    return {
      url: `postgresql://${user}:${encodeURIComponent(password)}@${host}:${port}/postgres`,
      source: 'SUPABASE_*',
    }
  }
  return null
}

function normalizePhone(raw) {
  const trimmed = (raw ?? '').trim()
  if (!trimmed) return ''
  let digits = trimmed.replace(/\D/g, '')
  if (!digits) return ''
  if (digits.startsWith('0034')) digits = digits.slice(2)
  if (digits.startsWith('34') && digits.length >= 11) return `+${digits}`
  if (digits.length === 9 && /^[6789]/.test(digits)) return `+34${digits}`
  if (digits.length > 9) return `+${digits}`
  return `+34${digits}`
}

function parseName(raw) {
  const trimmed = (raw ?? '').trim().replace(/\s+/g, ' ')
  if (!trimmed) return { firstName: '', lastName: '' }
  const spaceIdx = trimmed.indexOf(' ')
  if (spaceIdx === -1) return { firstName: trimmed, lastName: '' }
  return {
    firstName: trimmed.slice(0, spaceIdx).trim(),
    lastName: trimmed.slice(spaceIdx + 1).trim(),
  }
}

/** DD-MM-YYYY → YYYY-MM-DD */
function parseBirthdate(raw) {
  const trimmed = (raw ?? '').trim()
  const m = trimmed.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/)
  if (!m) return null
  const day = Number(m[1])
  const month = Number(m[2])
  const year = Number(m[3])
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  const dt = new Date(year, month - 1, day)
  if (dt.getFullYear() !== year || dt.getMonth() !== month - 1 || dt.getDate() !== day) {
    return null
  }
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function parseCsvLine(line) {
  const fields = []
  let current = ''
  let inQuotes = false
  for (const ch of line) {
    if (ch === '"') {
      inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      fields.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  fields.push(current.trim())
  return fields
}

async function main() {
  const csvPath = process.argv[2] ?? 'clients_birthdays_2026-01-01_2026-12-31.csv'
  const resolved = resolveDatabaseUrl()
  if (!resolved) {
    console.error('Falta DATABASE_URL o SUPABASE_* en .env')
    process.exit(1)
  }

  const sql = postgres(resolved.url, {
    max: 4,
    prepare: false,
    ssl: resolved.url.includes('localhost') || resolved.url.includes('127.0.0.1')
      ? false
      : 'require',
    connect_timeout: 15,
    onnotice: () => {},
  })

  await sql`ALTER TABLE customers ADD COLUMN IF NOT EXISTS birthdate DATE`
  await sql`ALTER TABLE customers ADD COLUMN IF NOT EXISTS birthday_wish_sent_year INTEGER`

  const content = readFileSync(csvPath, 'utf-8')
  const lines = content.split(/\r?\n/).filter(Boolean)
  if (lines.length < 2) {
    console.error('CSV vacío')
    await sql.end()
    process.exit(1)
  }

  const headers = parseCsvLine(lines[0]).map((h) => h.replace(/^"|"$/g, ''))
  const nameIdx = headers.findIndex((h) => /nombre/i.test(h))
  const emailIdx = headers.findIndex((h) => /correo|email/i.test(h))
  const phoneIdx = headers.findIndex((h) => /tel[eé]fono|phone/i.test(h))
  const birthIdx = headers.findIndex((h) => /cumplea|birth/i.test(h))

  if (nameIdx === -1 || phoneIdx === -1 || birthIdx === -1) {
    console.error('Faltan columnas Nombre, Teléfono o Cumpleaños')
    await sql.end()
    process.exit(1)
  }

  const now = new Date().toISOString()
  let upserted = 0
  let skipped = 0
  let errors = 0

  console.log(`Importando cumpleaños desde ${csvPath} (${resolved.source})…`)

  for (const line of lines.slice(1)) {
    const fields = parseCsvLine(line)
    const phone = normalizePhone(fields[phoneIdx] ?? '')
    const { firstName, lastName } = parseName(fields[nameIdx] ?? '')
    const email = (fields[emailIdx] ?? '').trim() || null
    const birthdate = parseBirthdate(fields[birthIdx] ?? '')

    if (!phone || !firstName || !birthdate) {
      skipped++
      continue
    }

    try {
      await sql`
        INSERT INTO customers (
          phone, first_name, last_name, email, birthdate, locale, created_at, updated_at
        )
        VALUES (
          ${phone}, ${firstName}, ${lastName || null}, ${email}, ${birthdate}::date,
          'es', ${now}, ${now}
        )
        ON CONFLICT (phone) DO UPDATE SET
          birthdate = EXCLUDED.birthdate,
          email = COALESCE(customers.email, EXCLUDED.email),
          first_name = COALESCE(NULLIF(customers.first_name, ''), EXCLUDED.first_name),
          last_name = COALESCE(customers.last_name, EXCLUDED.last_name),
          updated_at = EXCLUDED.updated_at
      `
      upserted++
    } catch (err) {
      errors++
      console.error(`  Error ${phone}: ${err.message}`)
    }
  }

  console.log(`\nResumen: upserted=${upserted} skipped=${skipped} errors=${errors}`)
  await sql.end()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
