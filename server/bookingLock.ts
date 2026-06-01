import { sql } from '@server/db.js'

/** Cliente SQL global o de transacción (`sql.begin`). */
export type DbClient = typeof sql

/** Serializa reservas del mismo profesional en el mismo día (evita doble cita simultánea). */
export async function lockStaffDayForBooking(
  tx: DbClient,
  staffId: string,
  date: string,
): Promise<void> {
  await tx`SELECT pg_advisory_xact_lock(hashtext(${staffId}), hashtext(${date}))`
}

export async function lockStaffDaysForBooking(
  tx: DbClient,
  keys: Array<{ staffId: string; date: string }>,
): Promise<void> {
  const seen = new Set<string>()
  for (const { staffId, date } of keys) {
    const key = `${staffId}\0${date}`
    if (seen.has(key)) continue
    seen.add(key)
    await lockStaffDayForBooking(tx, staffId, date)
  }
}
