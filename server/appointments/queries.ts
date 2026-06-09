import { sql, type AppointmentRow } from '@server/db.js'
import { addDaysToDateString, todaySalon } from '@/lib/core/dates'
import { COLOR_GROUP_ROLE } from '@/lib/booking/occupancy'

export async function getAppointmentById(
  id: string,
): Promise<AppointmentRow | undefined> {
  const rows = await sql<AppointmentRow[]>`
    SELECT * FROM appointments WHERE id = ${id}
  `
  return rows[0]
}

export async function getAppointmentsByBookingGroup(
  bookingGroupId: string,
): Promise<AppointmentRow[]> {
  return sql<AppointmentRow[]>`
    SELECT * FROM appointments
    WHERE booking_group_id = ${bookingGroupId}
    ORDER BY start_time ASC, id ASC
  `
}

export async function listAppointmentsForStaff(
  staffId: string,
  from: string,
  to: string,
): Promise<AppointmentRow[]> {
  return sql<AppointmentRow[]>`
    SELECT * FROM appointments
    WHERE staff_id = ${staffId}
      AND appointment_date >= ${from}
      AND appointment_date <= ${to}
      AND status != 'cancelled'
    ORDER BY appointment_date ASC, start_time ASC
  `
}

export async function listAppointments(from: string, to: string): Promise<AppointmentRow[]> {
  return sql<AppointmentRow[]>`
    SELECT * FROM appointments
    WHERE appointment_date >= ${from} AND appointment_date <= ${to}
    ORDER BY appointment_date ASC, start_time ASC
  `
}

/** Citas candidatas a recordatorio: confirmadas, sin recordatorio enviado y con fecha hoy o mañana. */
export async function listAppointmentsDueForReminder(): Promise<AppointmentRow[]> {
  const today = todaySalon()
  const until = addDaysToDateString(today, 1)
  return sql<AppointmentRow[]>`
    SELECT * FROM appointments
    WHERE status = 'confirmed'
      AND reminder_sent_at IS NULL
      AND appointment_date >= ${today}
      AND appointment_date <= ${until}
      AND (color_group_role IS NULL OR color_group_role = ${COLOR_GROUP_ROLE.color})
    ORDER BY appointment_date ASC, start_time ASC
  `
}

export async function markReminderSent(id: string): Promise<void> {
  await sql`UPDATE appointments SET reminder_sent_at = now() WHERE id = ${id}`
}
