import type { AppointmentRow } from '@server/db.js'
import type { CreateAppointmentInput } from '@server/appointments/types.js'
import { notifyAdminAppointmentCreated } from '@server/notifications/email.js'
import { notifyAppointmentCreated } from '@server/notifications/whatsapp.js'

/** Email admin (reserva pública) y WhatsApp de reserva opcional desde agenda (consentimiento staff). */
export function afterAppointmentCreated(
  input: CreateAppointmentInput,
  row: AppointmentRow,
): void {
  if (!input.skipCustomerWhatsApp && !input.forStaffPortal) {
    void notifyAdminAppointmentCreated(row)
  }
  if (
    input.forStaffPortal &&
    input.notifyCustomerWhatsApp === true &&
    !input.skipCustomerWhatsApp
  ) {
    void notifyAppointmentCreated(row).catch((err) => {
      console.error('Superpelu WhatsApp (reserva agenda):', err)
    })
  }
}
