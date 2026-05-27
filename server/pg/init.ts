import { applySchema, sql } from './client.js'
import { runSeed } from './seed.js'

let initialized = false

/** Aplica esquema y sincroniza catálogo/personal al arrancar. */
export async function initDatabase(): Promise<void> {
  if (initialized) return
  await applySchema()
  await runSeed()
  const [{ user }] = await sql<{ user: string }[]>`SELECT current_user AS user`
  initialized = true
  console.log(`Superpelu: base de datos PostgreSQL lista (current_user=${user})`)
}
