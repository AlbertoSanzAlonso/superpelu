/**
 * Copia datos de SQLite local a PostgreSQL (Supabase).
 *
 * Uso:
 *   DATABASE_URL="postgresql://..." SQLITE_PATH=./data/appointments.sqlite npm run db:migrate-sqlite
 */
import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'
import postgres from 'postgres'

const sqlitePath =
  process.env.SQLITE_PATH ?? path.join(process.cwd(), 'data', 'appointments.sqlite')
const databaseUrl = process.env.DATABASE_URL?.trim()

if (!databaseUrl) {
  console.error('Falta DATABASE_URL (connection string de Supabase)')
  process.exit(1)
}

if (!fs.existsSync(sqlitePath)) {
  console.error(`No existe SQLite: ${sqlitePath}`)
  process.exit(1)
}

const sqlite = new Database(sqlitePath, { readonly: true })
const sql = postgres(databaseUrl, { max: 1, ssl: 'require' })

const tables = [
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

async function copyTable(name) {
  const rows = sqlite.prepare(`SELECT * FROM ${name}`).all()
  if (rows.length === 0) {
    console.log(`  ${name}: 0 filas`)
    return
  }

  await sql`DELETE FROM ${sql(name)}`

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
}

async function main() {
  const schemaPath = path.join(process.cwd(), 'server', 'pg', 'schema.sql')
  console.log('Aplicando esquema…')
  await sql.file(schemaPath)

  console.log('Copiando tablas…')
  for (const table of tables) {
    const exists = sqlite
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`)
      .get(table)
    if (!exists) {
      console.log(`  ${table}: omitida (no existe en SQLite)`)
      continue
    }
    await copyTable(table)
  }

  console.log('Migración completada.')
  await sql.end()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
