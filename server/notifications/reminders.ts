import { listAppointmentsDueForReminder, markReminderSent } from '@server/appointments/index.js'
import { sendAppointmentReminder } from '@server/notifications/whatsapp.js'
import { isOpenWaConfigured } from '@server/notifications/openwa.js'
import { hoursUntilAppointment } from '@/lib/core/dates'

function envFlag(name: string, fallback: boolean): boolean {
  const raw = (process.env[name] ?? '').trim().toLowerCase()
  if (!raw) return fallback
  return raw === '1' || raw === 'true' || raw === 'yes'
}

function envNumber(name: string, fallback: number): number {
  const n = Number((process.env[name] ?? '').trim())
  return Number.isFinite(n) && n > 0 ? n : fallback
}

const HOURS_BEFORE = envNumber('REMINDER_HOURS_BEFORE', 24)
const POLL_MINUTES = envNumber('REMINDER_POLL_MINUTES', 10)

let running = false

/** Revisa las citas pendientes y envía el recordatorio a las que entran en ventana. */
export async function processDueReminders(): Promise<number> {
  if (running) return 0
  running = true
  let sent = 0
  try {
    const rows = await listAppointmentsDueForReminder()
    for (const row of rows) {
      const hours = hoursUntilAppointment(row.appointment_date, row.start_time)
      if (hours <= 0 || hours > HOURS_BEFORE) continue
      try {
        const ok = await sendAppointmentReminder(row)
        if (ok) {
          await markReminderSent(row.id)
          sent += 1
        }
      } catch (err) {
        console.error(`Superpelu recordatorio: fallo con cita ${row.id}:`, err)
      }
    }
  } catch (err) {
    console.error('Superpelu recordatorio: error al procesar pendientes:', err)
  } finally {
    running = false
  }
  return sent
}

/** Arranca el temporizador de recordatorios (solo si OpenWA está configurado). */
export function startReminderScheduler(): void {
  if (!envFlag('REMINDERS_ENABLED', true)) {
    console.log('Superpelu recordatorio: desactivado (REMINDERS_ENABLED=false)')
    return
  }
  if (!isOpenWaConfigured()) {
    console.log('Superpelu recordatorio: OpenWA no configurado; scheduler inactivo')
    return
  }

  console.log(
    `Superpelu recordatorio: activo (cada ${POLL_MINUTES} min, ${HOURS_BEFORE}h antes)`,
  )

  // Primera pasada a los 30s del arranque, luego según el intervalo.
  setTimeout(() => void processDueReminders(), 30_000)
  setInterval(() => void processDueReminders(), POLL_MINUTES * 60_000)
}
