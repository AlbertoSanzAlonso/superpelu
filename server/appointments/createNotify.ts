import type { AppointmentRow } from '@server/db.js'
import type { CreateAppointmentInput } from '@server/appointments/types.js'
import { notifyAdminAppointmentCreated } from '@server/notifications/email.js'
import { notifyAppointmentCreated } from '@server/notifications/whatsapp.js'

/**
 * Tras crear una cita:
 * - Email al admin solo en reserva pública (/reservar).
 * - WhatsApp de confirmación: siempre en /reservar; en agenda solo si el staff elige avisar.
 * - El recordatorio 24h lo envía el scheduler (independiente).
 */
export function afterAppointmentCreated(
  input: CreateAppointmentInput,
  row: AppointmentRow,
): void {
  if (input.skipCustomerWhatsApp) return

  if (!input.forStaffPortal) {
    void notifyAdminAppointmentCreated(row)
    void notifyAppointmentCreated(row).catch((err) => {
      console.error('Superpelu WhatsApp (cita nueva):', err)
    })
    return
  }

  if (input.notifyCustomerWhatsApp === true) {
    void notifyAppointmentCreated(row).catch((err) => {
      console.error('Superpelu WhatsApp (reserva agenda):', err)
    })
  }
}
