/**
 * Copia datos de SQLite local a PostgreSQL (Supabase).
 *
 * Uso:
 *   SQLITE_PATH=./data/appointments.sqlite npm run db:migrate-sqlite
 *
 * Requiere DATABASE_URL en .env (modo Session, puerto 5432, recomendado para migración)
 * o SUPABASE_PROJECT_REF + SUPABASE_DB_PASSWORD.
 */
import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'
import postgres from 'postgres'

try {
  process.loadEnvFile('.env')
} catch {
  // variables ya inyectadas (CI, shell)
}

function resolveDatabaseUrl() {
  const direct = process.env.DATABASE_URL?.trim()
  if (direct) return direct

  const ref = process.env.SUPABASE_PROJECT_REF?.trim()
  const password = process.env.SUPABASE_DB_PASSWORD?.trim()
  if (ref && password) {
    const pooler = process.env.SUPABASE_POOLER ?? 'aws-1'
    const region = process.env.SUPABASE_REGION ?? 'eu-central-1'
    const host =
      process.env.SUPABASE_DB_HOST?.trim() ?? `${pooler}-${region}.pooler.supabase.com`
    const port = process.env.SUPABASE_DB_PORT ?? '5432'
    const user = process.env.SUPABASE_DB_USER ?? `postgres.${ref}`
    return `postgresql://${user}:${encodeURIComponent(password)}@${host}:${port}/postgres`
  }

  return null
}

const sqlitePath =
  process.env.SQLITE_PATH ?? path.join(process.cwd(), 'data', 'appointments.sqlite')
const databaseUrl = resolveDatabaseUrl()

if (!databaseUrl) {
  console.error(
    'Falta DATABASE_URL o SUPABASE_PROJECT_REF + SUPABASE_DB_PASSWORD en .env',
  )
  process.exit(1)
}

if (!fs.existsSync(sqlitePath)) {
  console.error(`No existe SQLite: ${sqlitePath}`)
  process.exit(1)
}

const sqlite = new Database(sqlitePath, { readonly: true })
const sql = postgres(databaseUrl, {
  max: 1,
  ssl:
    databaseUrl.includes('sslmode=require') || databaseUrl.includes('supabase.co')
      ? 'require'
      : undefined,
  onnotice: () => {},
})

/** Orden de inserción (padres antes que hijos). */
const copyOrder = [
  'service_categories',
  'services',
  'staff',
  'staff_services',
  'staff_availability',
  'customers',
  'appointments',
  'staff_time_blocks',
  'staff_sessions',
]

function boolFromSqlite(value) {
  if (value === true || value === false) return value
  return Number(value) === 1
}

async function verifyConnection() {
  try {
    const [{ now }] = await sql`SELECT now() AS now`
    const u = new URL(databaseUrl.replace(/^postgresql:/, 'http:'))
    console.log(`Conectado a ${u.hostname}:${u.port || '5432'} (${u.username}) — ${now}`)
  } catch (err) {
    console.error(
      'No se pudo conectar a Supabase. Revisa DATABASE_URL en .env:\n' +
        '  • Supabase → Project Settings → Database → Connection string → Session (5432)\n' +
        '  • Usuario pooler: postgres.[PROJECT_REF]\n' +
        '  • Si cambiaste la contraseña, actualízala en .env y vuelve a ejecutar.\n',
    )
    throw err
  }
}

async function clearTargetTables() {
  await sql.unsafe(`
    TRUNCATE
      staff_sessions,
      staff_time_blocks,
      appointments,
      customers,
      staff_availability,
      staff_services,
      services,
      staff,
      service_categories
    CASCADE
  `)
}

async function copyTable(name) {
  const rows = sqlite.prepare(`SELECT * FROM ${name}`).all()
  if (rows.length === 0) {
    console.log(`  ${name}: 0 filas`)
    return 0
  }

  for (const row of rows) {
    const r = { ...row }
    for (const key of Object.keys(r)) {
      if (key === 'active' || key === 'bookable_online') {
        r[key] = boolFromSqlite(r[key])
      }
    }
    await sql`
      INSERT INTO ${sql(name)} ${sql(r)}
      ON CONFLICT DO NOTHING
    `
  }
  console.log(`  ${name}: ${rows.length} filas`)
  return rows.length
}

async function printSummary() {
  console.log('\nResumen en Supabase:')
  for (const table of copyOrder) {
    const [{ count }] = await sql`SELECT COUNT(*)::int AS count FROM ${sql(table)}`
    console.log(`  ${table}: ${count}`)
  }
}

async function main() {
  await verifyConnection()

  const schemaPath = path.join(process.cwd(), 'server', 'pg', 'schema.sql')
  console.log('\nAplicando esquema…')
  await sql.file(schemaPath)

  console.log('Vaciando tablas destino…')
  await clearTargetTables()

  console.log('Copiando desde SQLite…')
  let total = 0
  for (const table of copyOrder) {
    const exists = sqlite
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`)
      .get(table)
    if (!exists) {
      console.log(`  ${table}: omitida (no existe en SQLite)`)
      continue
    }
    total += await copyTable(table)
  }

  await printSummary()
  console.log(`\nMigración completada (${total} filas copiadas).`)
  await sql.end()
}

main().catch((err) => {
  console.error(err.message ?? err)
  process.exit(1)
})
