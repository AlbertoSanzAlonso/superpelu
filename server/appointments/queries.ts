import { sql, type AppointmentRow } from '@server/db.js'
import { addDaysToDateString, todaySalon } from '@/lib/core/dates'
import { COLOR_GROUP_ROLE } from '@/lib/booking/occupancy'

export async function getAppointmentById(
  id: string,
): Promise<(AppointmentRow & { booking_pattern?: unknown | null }) | undefined> {
  const rows = await sql<(AppointmentRow & { booking_pattern: unknown | null })[]>`
    SELECT a.*, s.booking_pattern
    FROM appointments a
    LEFT JOIN services s ON s.id = a.service_id
    WHERE a.id = ${id}
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
  // Para visitas multi-tratamiento (booking_group_id no nulo), solo se devuelve
  // la primera cita del grupo (menor start_time + id) para evitar enviar un
  // recordatorio por cada servicio. Las citas sin grupo se incluyen todas.
  return sql<AppointmentRow[]>`
    SELECT DISTINCT ON (COALESCE(booking_group_id, id)) *
    FROM appointments
    WHERE status = 'confirmed'
      AND reminder_sent_at IS NULL
      AND appointment_date >= ${today}
      AND appointment_date <= ${until}
      AND (color_group_role IS NULL OR color_group_role = ${COLOR_GROUP_ROLE.color})
    ORDER BY COALESCE(booking_group_id, id), appointment_date ASC, start_time ASC, id ASC
  `
}

export async function markReminderSent(id: string): Promise<void> {
  // Marca también las demás citas del mismo grupo de reserva para evitar
  // que el scheduler envíe recordatorios adicionales por los otros servicios.
  await sql`
    UPDATE appointments
    SET reminder_sent_at = now()
    WHERE id = ${id}
       OR (
            booking_group_id IS NOT NULL
            AND booking_group_id = (SELECT booking_group_id FROM appointments WHERE id = ${id})
          )
  `
}
