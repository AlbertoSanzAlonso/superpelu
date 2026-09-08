import { listAppointmentsDueForReminder, markReminderSent } from '@server/appointments/index.js'
import { sendAppointmentReminder } from '@server/notifications/whatsapp.js'
import { isOpenWaConfigured } from '@server/notifications/openwa.js'
import { hoursUntilAppointment, todaySalon, addDaysToDateString } from '@/lib/core/dates'
import { sql, type AppointmentRow } from '@server/db.js'
import { COLOR_GROUP_ROLE } from '@/lib/booking/occupancy'

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

export type ReminderRunResult = {
  sent: number
  busy: boolean
  hoursBefore: number
  candidates: number
  inWindow: number
  skippedHours: number
  errors: number
  sample: Array<{
    id: string
    customerName: string
    date: string
    startTime: string
    hours: number
    action: 'sent' | 'skip_hours' | 'error' | 'send_false'
    error?: string
  }>
}

function normalizeTime(value: string): string {
  return String(value).slice(0, 5)
}

function normalizeDate(value: string): string {
  return String(value).slice(0, 10)
}

/** Revisa las citas pendientes y envía el recordatorio a las que entran en ventana. */
export async function processDueReminders(): Promise<ReminderRunResult> {
  const empty = (): ReminderRunResult => ({
    sent: 0,
    busy: false,
    hoursBefore: HOURS_BEFORE,
    candidates: 0,
    inWindow: 0,
    skippedHours: 0,
    errors: 0,
    sample: [],
  })

  if (running) {
    return { ...empty(), busy: true }
  }
  running = true
  const result = empty()
  try {
    const rows = await listAppointmentsDueForReminder()
    result.candidates = rows.length
    for (const row of rows) {
      const date = normalizeDate(row.appointment_date)
      const startTime = normalizeTime(row.start_time)
      const hours = hoursUntilAppointment(date, startTime)
      const base = {
        id: row.id,
        customerName: row.customer_name,
        date,
        startTime,
        hours: Math.round(hours * 100) / 100,
      }
      if (hours <= 0 || hours > HOURS_BEFORE) {
        result.skippedHours += 1
        if (result.sample.length < 20) {
          result.sample.push({ ...base, action: 'skip_hours' })
        }
        continue
      }
      result.inWindow += 1
      try {
        const ok = await sendAppointmentReminder(row)
        if (ok) {
          await markReminderSent(row.id)
          result.sent += 1
          if (result.sample.length < 20) {
            result.sample.push({ ...base, action: 'sent' })
          }
        } else if (result.sample.length < 20) {
          result.sample.push({ ...base, action: 'send_false' })
        }
      } catch (err) {
        result.errors += 1
        console.error(`Superpelu recordatorio: fallo con cita ${row.id}:`, err)
        if (result.sample.length < 20) {
          result.sample.push({
            ...base,
            action: 'error',
            error: err instanceof Error ? err.message : String(err),
          })
        }
      }
    }
  } catch (err) {
    console.error('Superpelu recordatorio: error al procesar pendientes:', err)
    result.errors += 1
    result.sample.push({
      id: '-',
      customerName: '-',
      date: todaySalon(),
      startTime: '-',
      hours: 0,
      action: 'error',
      error: err instanceof Error ? err.message : String(err),
    })
  } finally {
    running = false
  }
  return result
}

export type ReminderStatusRow = {
  id: string
  customerName: string
  customerPhone: string
  date: string
  startTime: string
  serviceName: string
  reminderSentAt: string | null
  colorGroupRole: string | null
  hours: number
  due: boolean
}

/** Estado de recordatorios hoy/mañana (diagnóstico admin). */
export async function listReminderStatus(): Promise<{
  hoursBefore: number
  today: string
  rows: ReminderStatusRow[]
}> {
  const today = todaySalon()
  const until = addDaysToDateString(today, 1)
  const rows = await sql<AppointmentRow[]>`
    SELECT *
    FROM appointments
    WHERE status = 'confirmed'
      AND appointment_date >= ${today}
      AND appointment_date <= ${until}
      AND (color_group_role IS NULL OR color_group_role = ${COLOR_GROUP_ROLE.color})
    ORDER BY appointment_date ASC, start_time ASC, id ASC
  `

  return {
    hoursBefore: HOURS_BEFORE,
    today,
    rows: rows.map((row) => {
      const date = normalizeDate(row.appointment_date)
      const startTime = normalizeTime(row.start_time)
      const hours = hoursUntilAppointment(date, startTime)
      return {
        id: row.id,
        customerName: row.customer_name,
        customerPhone: row.customer_phone,
        date,
        startTime,
        serviceName: row.service_name,
        reminderSentAt: row.reminder_sent_at,
        colorGroupRole: row.color_group_role,
        hours: Math.round(hours * 100) / 100,
        due:
          row.reminder_sent_at == null && hours > 0 && hours <= HOURS_BEFORE,
      }
    }),
  }
}

/**
 * Reactiva recordatorios de citas en ventana (reminder_sent_at → NULL) y vuelve a intentar envío.
 * Solo admin / diagnóstico cuando se marcaron sin llegar el WhatsApp.
 */
export async function resetDueRemindersAndSend(): Promise<ReminderRunResult> {
  const today = todaySalon()
  const until = addDaysToDateString(today, 1)
  const rows = await sql<AppointmentRow[]>`
    SELECT *
    FROM appointments
    WHERE status = 'confirmed'
      AND appointment_date >= ${today}
      AND appointment_date <= ${until}
      AND reminder_sent_at IS NOT NULL
      AND (color_group_role IS NULL OR color_group_role = ${COLOR_GROUP_ROLE.color})
  `
  for (const row of rows) {
    const hours = hoursUntilAppointment(
      normalizeDate(row.appointment_date),
      normalizeTime(row.start_time),
    )
    if (hours <= 0 || hours > HOURS_BEFORE) continue
    await sql`
      UPDATE appointments
      SET reminder_sent_at = NULL
      WHERE id = ${row.id}
         OR (
              booking_group_id IS NOT NULL
              AND booking_group_id = (SELECT booking_group_id FROM appointments WHERE id = ${row.id})
            )
         OR (
              color_group_id IS NOT NULL
              AND color_group_id = (SELECT color_group_id FROM appointments WHERE id = ${row.id})
            )
    `
  }
  return processDueReminders()
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
