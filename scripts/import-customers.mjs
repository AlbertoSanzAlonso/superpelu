/**
 * Importa clientes desde un CSV a la base de datos.
 * Uso: npm run import:customers -- "ruta/al/archivo.csv"
 *
 * Formato esperado:
 *   Nombre,Correo electrónico,Número de teléfono,Observaciones,...
 */

import { readFileSync } from 'node:fs'
import postgres from 'postgres'

try {
  process.loadEnvFile('.env')
} catch {
  // ok
}

function resolveDatabaseUrl() {
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

  const direct = process.env.DATABASE_URL?.trim()
  if (direct) {
    return { url: direct, source: 'DATABASE_URL' }
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
  const trimmed = (raw ?? '').trim()
  if (!trimmed) return { firstName: '', lastName: '' }
  const spaceIdx = trimmed.indexOf(' ')
  if (spaceIdx === -1) return { firstName: trimmed, lastName: '' }
  return {
    firstName: trimmed.slice(0, spaceIdx).trim(),
    lastName: trimmed.slice(spaceIdx + 1).trim(),
  }
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
  const csvPath = process.argv[2]
  if (!csvPath) {
    console.error('Uso: node scripts/import-customers.mjs "ruta/al/archivo.csv"')
    process.exit(1)
  }

  const resolved = resolveDatabaseUrl()
  if (!resolved) {
    console.error('Falta DATABASE_URL o SUPABASE_PROJECT_REF + SUPABASE_DB_PASSWORD en .env')
    process.exit(1)
  }

  const sql = postgres(resolved.url, {
    max: 4,
    prepare: false,
    ssl: 'require',
    connect_timeout: 15,
    onnotice: () => {},
  })

  const content = readFileSync(csvPath, 'utf-8')
  const lines = content.split(/\r?\n/).filter(Boolean)

  if (lines.length < 2) {
    console.error('El CSV está vacío o solo tiene cabeceras')
    await sql.end()
    process.exit(1)
  }

  const headers = parseCsvLine(lines[0]).map((h) => h.replace(/^"|"$/g, ''))
  console.log('Cabeceras:', headers)

  const nameIdx = headers.findIndex((h) => /nombre/i.test(h))
  const emailIdx = headers.findIndex((h) => /correo|email/i.test(h))
  const phoneIdx = headers.findIndex((h) => /tel[eé]fono|phone/i.test(h))
  const notesIdx = headers.findIndex((h) => /observaciones|notes/i.test(h))

  if (nameIdx === -1 || phoneIdx === -1) {
    console.error('No se encontraron las columnas "Nombre" y "Número de teléfono"')
    await sql.end()
    process.exit(1)
  }

  const rows = lines.slice(1)
  const now = new Date().toISOString()
  const batchSize = 200
  let inserted = 0
  let updated = 0
  let skipped = 0
  let errors = 0

  console.log(`\nProcesando ${rows.length} filas en lotes de ${batchSize}...\n`)

  for (let start = 0; start < rows.length; start += batchSize) {
    const batch = rows.slice(start, start + batchSize)
    const records = []

    for (const line of batch) {
      const fields = parseCsvLine(line)
      const nameRaw = fields[nameIdx] ?? ''
      const phoneRaw = fields[phoneIdx] ?? ''
      const email = (fields[emailIdx] ?? '').trim() || null
      const notes = notesIdx !== -1 ? (fields[notesIdx] ?? '').trim() || null : null

      const phone = normalizePhone(phoneRaw)
      if (!phone) { skipped++; continue }

      const { firstName, lastName } = parseName(nameRaw)
      if (!firstName) { skipped++; continue }

      records.push({
        phone,
        first_name: firstName,
        last_name: lastName || null,
        email,
        notes,
        locale: 'es',
        created_at: now,
        updated_at: now,
      })
    }

    if (records.length === 0) continue

    const seen = new Set()
    const deduped = records.filter((r) => {
      if (seen.has(r.phone)) return false
      seen.add(r.phone)
      return true
    })

    if (deduped.length === 0) continue

    try {
      await sql`
        INSERT INTO customers ${sql(deduped, 'phone', 'first_name', 'last_name', 'email', 'notes', 'locale', 'created_at', 'updated_at')}
        ON CONFLICT (phone) DO UPDATE SET
          first_name = COALESCE(EXCLUDED.first_name, customers.first_name),
          last_name = COALESCE(EXCLUDED.last_name, customers.last_name),
          email = COALESCE(EXCLUDED.email, customers.email),
          notes = COALESCE(EXCLUDED.notes, customers.notes),
          updated_at = EXCLUDED.updated_at
      `
      inserted += deduped.length
    } catch (err) {
      errors++
      console.error(`Error en lote ${start / batchSize + 1}: ${err.message}. Reintentando uno a uno...`)
      for (const rec of deduped) {
        try {
          await sql`
            INSERT INTO customers ${sql(rec, 'phone', 'first_name', 'last_name', 'email', 'notes', 'locale', 'created_at', 'updated_at')}
            ON CONFLICT (phone) DO UPDATE SET
              first_name = COALESCE(EXCLUDED.first_name, customers.first_name),
              last_name = COALESCE(EXCLUDED.last_name, customers.last_name),
              email = COALESCE(EXCLUDED.email, customers.email),
              notes = COALESCE(EXCLUDED.notes, customers.notes),
              updated_at = EXCLUDED.updated_at
          `
          inserted++
        } catch (e) {
          console.error(`    Error con ${rec.phone} (${rec.first_name}): ${e.message}`)
        }
      }
    }

    const done = Math.min(start + batchSize, rows.length)
    console.log(`  ${done}/${rows.length} procesadas...`)
  }

  console.log(`\nResumen:`)
  console.log(`  Insertados/actualizados: ${inserted}`)
  console.log(`  Saltados (sin teléfono/nombre): ${skipped}`)
  console.log(`  Errores: ${errors}`)

  await sql.end()
}

main().catch((err) => {
  console.error('Error general:', err)
  process.exit(1)
})
