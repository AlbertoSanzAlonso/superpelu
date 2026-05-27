import fs from 'node:fs'
import path from 'node:path'
import postgres from 'postgres'

// En producción solo variables inyectadas (Coolify); evita .env montado por error
if (process.env.NODE_ENV !== 'production') {
  try {
    process.loadEnvFile('.env')
  } catch {
    // .env opcional en local
  }
}

function resolveDatabaseUrl(): string {
  let direct = process.env.DATABASE_URL?.trim()
  if (direct) {
    if (
      (direct.startsWith('"') && direct.endsWith('"')) ||
      (direct.startsWith("'") && direct.endsWith("'"))
    ) {
      direct = direct.slice(1, -1)
    }
    return direct
  }

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

  throw new Error(
    'Falta DATABASE_URL o bien SUPABASE_PROJECT_REF + SUPABASE_DB_PASSWORD en .env',
  )
}

const connectionString = resolveDatabaseUrl()

/** Errores habituales en Coolify antes de abrir conexión. */
function validateSupabaseUrl(url: string): void {
  let u: URL
  try {
    u = new URL(url.replace(/^postgresql:/, 'http:'))
  } catch {
    throw new Error('DATABASE_URL no es una URI válida')
  }

  if (!u.password || !u.username) {
    throw new Error('DATABASE_URL incompleta: falta usuario o contraseña')
  }

  const pooler = u.hostname.includes('pooler.') || u.port === '6543'
  if (pooler && u.username === 'postgres') {
    throw new Error(
      'DATABASE_URL usa usuario "postgres" en el pooler de Supabase. ' +
        'Copia la URI en Connect → Transaction (6543): el usuario debe ser postgres.TU_PROJECT_REF',
    )
  }
}

validateSupabaseUrl(connectionString)

function isPoolerConnection(url: string): boolean {
  try {
    const u = new URL(url.replace(/^postgresql:/, 'http:'))
    return u.hostname.includes('pooler.') || u.port === '6543'
  } catch {
    return false
  }
}

function logDatabaseTarget(url: string): void {
  try {
    const u = new URL(url.replace(/^postgresql:/, 'http:'))
    console.log(
      `Superpelu: PostgreSQL ${u.hostname}:${u.port || '5432'} (${u.username})${
        isPoolerConnection(url) ? ' [pooler]' : ''
      }`,
    )
  } catch {
    // ignorar URL mal formada
  }
}

logDatabaseTarget(connectionString)

const usePooler = isPoolerConnection(connectionString)

/** Cliente PostgreSQL (Supabase). Usar solo en el servidor Node. */
export const sql = postgres(connectionString, {
  // Pooler: pocas conexiones; Transaction (6543) no soporta bien pools grandes
  max: usePooler ? 1 : 10,
  idle_timeout: 20,
  connect_timeout: 30,
  // PgBouncer modo transacción (puerto 6543): sin prepared statements
  prepare: !usePooler,
  ssl:
    connectionString.includes('sslmode=require') ||
    connectionString.includes('supabase.co')
      ? 'require'
      : undefined,
  transform: {
    undefined: null,
  },
  // CREATE IF NOT EXISTS → NOTICE 42P07 en cada arranque; no son errores
  onnotice: () => {},
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
