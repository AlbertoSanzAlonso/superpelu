import fs from 'node:fs'
import path from 'node:path'
import postgres from 'postgres'

try {
  process.loadEnvFile('.env')
} catch {
  // .env opcional (Coolify/Docker inyectan variables)
}

function resolveDatabaseUrl(): string {
  const direct = process.env.DATABASE_URL?.trim()
  if (direct) return direct

  const ref = process.env.SUPABASE_PROJECT_REF?.trim()
  const password = process.env.SUPABASE_DB_PASSWORD?.trim()
  if (ref && password) {
    const pooler = process.env.SUPABASE_POOLER ?? 'aws-1'
    const region = process.env.SUPABASE_REGION ?? 'eu-central-1'
    const host =
      process.env.SUPABASE_DB_HOST?.trim() ?? `${pooler}-${region}.pooler.supabase.com`
    const port = process.env.SUPABASE_DB_PORT ?? '6543'
    const user = process.env.SUPABASE_DB_USER ?? `postgres.${ref}`
    return `postgresql://${user}:${encodeURIComponent(password)}@${host}:${port}/postgres`
  }

  throw new Error(
    'Falta DATABASE_URL o bien SUPABASE_PROJECT_REF + SUPABASE_DB_PASSWORD en .env',
  )
}

const connectionString = resolveDatabaseUrl()

/** Cliente PostgreSQL (Supabase). Usar solo en el servidor Node. */
export const sql = postgres(connectionString, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 30,
  ssl:
    connectionString.includes('sslmode=require') ||
    connectionString.includes('supabase.co')
      ? 'require'
      : undefined,
  transform: {
    undefined: null,
  },
})

const schemaPath = path.join(import.meta.dirname, 'schema.sql')

export async function applySchema(): Promise<void> {
  if (!fs.existsSync(schemaPath)) {
    throw new Error(`No se encontró ${schemaPath}`)
  }
  await sql.file(schemaPath)
}

export async function closeDatabase(): Promise<void> {
  await sql.end({ timeout: 5 })
}
