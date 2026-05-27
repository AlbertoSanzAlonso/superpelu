/**
 * Comprueba conexión a Supabase (sin migrar datos).
 * Uso: npm run db:check
 */
import postgres from 'postgres'

try {
  process.loadEnvFile('.env')
} catch {
  // ok
}

function resolveDatabaseUrl() {
  const direct = process.env.DATABASE_URL?.trim()
  if (direct) return direct

  const ref = process.env.SUPABASE_PROJECT_REF?.trim()
  const password = process.env.SUPABASE_DB_PASSWORD?.trim()
  if (ref && password) {
    const host =
      process.env.SUPABASE_DB_HOST?.trim() ??
      `aws-1-${process.env.SUPABASE_REGION ?? 'eu-central-1'}.pooler.supabase.com`
    const port = process.env.SUPABASE_DB_PORT ?? '5432'
    const user = process.env.SUPABASE_DB_USER ?? `postgres.${ref}`
    return `postgresql://${user}:${encodeURIComponent(password)}@${host}:${port}/postgres`
  }
  return null
}

const databaseUrl = resolveDatabaseUrl()
if (!databaseUrl) {
  console.error('Falta DATABASE_URL o SUPABASE_PROJECT_REF + SUPABASE_DB_PASSWORD en .env')
  process.exit(1)
}

const u = new URL(databaseUrl.replace(/^postgresql:/, 'http:'))
console.log(`Probando ${u.hostname}:${u.port || '5432'} (${u.username})…`)

const sql = postgres(databaseUrl, {
  max: 1,
  ssl: 'require',
  connect_timeout: 15,
  onnotice: () => {},
})

try {
  const [{ now }] = await sql`SELECT now() AS now`
  console.log('Conexión OK —', now)
  await sql.end()
} catch (err) {
  console.error('Conexión fallida:', err.message)
  console.error(`
Arreglo habitual:
  1. Supabase → tu proyecto → Project Settings → Database
  2. «Reset database password» → copia la contraseña nueva
  3. Database → Connect → Session → copia la URI completa
  4. Pégala en .env como DATABASE_URL=... (sustituye [YOUR-PASSWORD])
  5. npm run db:check
`)
  process.exit(1)
}
