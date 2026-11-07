import { applySchema, sql } from '@server/pg/client.js'
import { runSeed } from '@server/pg/seed.js'

let initialized = false

/** «Noa Sanz (hija) de Alberto» → «Noa Sanz (hija de Alberto)». Idempotente. */
async function rewriteMemberKinshipSnapshots(): Promise<void> {
  await sql`
    UPDATE appointments
    SET customer_name = regexp_replace(
      customer_name,
      ' \\(([^)]+)\\) (de|of) (.+)$',
      ' (\\1 \\2 \\3)'
    )
    WHERE customer_name ~ ' \\([^)]+\\) (de|of) '
  `
}

/** Aplica esquema y sincroniza catálogo/personal al arrancar. */
export async function initDatabase(): Promise<void> {
  if (initialized) return
  await applySchema()
  await runSeed()
  await rewriteMemberKinshipSnapshots()
  const [{ user }] = await sql<{ user: string }[]>`SELECT current_user AS user`
  initialized = true
  console.log(`Superpelu: base de datos PostgreSQL lista (current_user=${user})`)
}
