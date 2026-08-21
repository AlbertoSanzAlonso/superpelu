import type { AppointmentRow } from '@server/db.js'
import { isGuestCustomerPhone } from '@/lib/customer/guestPhone'
import { getAppointmentById, getAppointmentsByBookingGroup } from '@server/appointments/queries.js'
import { isColorGroupWashRow } from '@/lib/booking/occupancy'
import {
  buildWhatsAppAppointmentMessage,
  filterWhatsAppBookingGroupRows,
} from '@/i18n/whatsappAppointment'
import { appointmentLocale } from '@/i18n/localeHelpers'
import {
  getOpenWaConfig,
  openWaEnsureStarted,
  phoneToWhatsAppChatId,
} from '@server/notifications/openwa.js'
import { sendWhatsAppWithLogoHeader } from '@server/notifications/branding.js'
import { buildBookingUrl, buildManageUrl } from '@server/appointments/links.js'

async function sendCustomerWhatsApp(
  row: AppointmentRow,
  text: string,
): Promise<string | undefined> {
  if (isGuestCustomerPhone(row.customer_phone)) return undefined
  await openWaEnsureStarted()
  const chatId = phoneToWhatsAppChatId(row.customer_phone)
  return sendWhatsAppWithLogoHeader(chatId, text, appointmentLocale(row))
}

export async function buildAppointmentConfirmationMessage(
  row: AppointmentRow,
): Promise<string> {
  const groupRows = row.booking_group_id
    ? filterWhatsAppBookingGroupRows(await getAppointmentsByBookingGroup(row.booking_group_id))
    : undefined
  return buildWhatsAppAppointmentMessage(row, 'confirmation', {
    manageUrl: buildManageUrl(row),
    groupRows,
  })
}

export function buildAppointmentRescheduledMessage(row: AppointmentRow): string {
  return buildWhatsAppAppointmentMessage(row, 'rescheduled', {
    manageUrl: buildManageUrl(row),
  })
}

export async function buildAppointmentReminderMessage(row: AppointmentRow): Promise<string> {
  const groupRows = row.booking_group_id
    ? filterWhatsAppBookingGroupRows(await getAppointmentsByBookingGroup(row.booking_group_id))
    : undefined
  return buildWhatsAppAppointmentMessage(row, 'reminder', {
    manageUrl: buildManageUrl(row),
    groupRows,
  })
}

export function buildAppointmentCancelledMessage(
  row: AppointmentRow,
  groupRows?: AppointmentRow[],
): string {
  return buildWhatsAppAppointmentMessage(row, 'cancelled', {
    bookingUrl: buildBookingUrl(),
    groupRows,
  })
}

export async function buildAppointmentVisitUpdatedMessage(
  row: AppointmentRow,
): Promise<string> {
  const groupRows = row.booking_group_id
    ? filterWhatsAppBookingGroupRows(
        (await getAppointmentsByBookingGroup(row.booking_group_id)).filter(
          (apt) => apt.status === 'confirmed',
        ),
      )
    : undefined
  return buildWhatsAppAppointmentMessage(row, 'updated', {
    manageUrl: buildManageUrl(row),
    groupRows,
  })
}

export function buildAppointmentNoShowMessage(row: AppointmentRow): string {
  return buildWhatsAppAppointmentMessage(row, 'no_show', {
    bookingUrl: buildBookingUrl(),
  })
}

export async function notifyAppointmentCreated(
  row: AppointmentRow,
  options?: { forStaffPortal?: boolean },
): Promise<void> {
  const config = getOpenWaConfig()
  if (!config) {
    console.warn('Superpelu WhatsApp: OpenWA no configurado — confirmación omitida')
    return
  }

  if (config.notifyPublicOnly && options?.forStaffPortal) return
  if (row.status === 'cancelled' || row.status === 'no_show') return

  const text = await buildAppointmentConfirmationMessage(row)
  const messageId = await sendCustomerWhatsApp(row, text)
  console.log(
    `Superpelu WhatsApp: confirmación enviada a ${row.customer_phone}${messageId ? ` (${messageId})` : ''}`,
  )
}

/** Aviso al cliente tras modificar / reprogramar una cita (agenda o enlace público). */
export async function notifyAppointmentUpdated(row: AppointmentRow): Promise<void> {
  const config = getOpenWaConfig()
  if (!config) return
  if (row.status === 'cancelled' || row.status === 'no_show') return
  // El lavado enlazado se gestiona en agenda; el cliente solo recibe aviso si cambia la coloración.
  if (isColorGroupWashRow(row.color_group_role)) return

  const text = await buildAppointmentVisitUpdatedMessage(row)
  const messageId = await sendCustomerWhatsApp(row, text)
  console.log(
    `Superpelu WhatsApp: modificación confirmada a ${row.customer_phone}${messageId ? ` (${messageId})` : ''}`,
  )
}

/** @deprecated Usar notifyAppointmentUpdated (mismo mensaje: cita modificada). */
export async function notifyAppointmentRescheduled(row: AppointmentRow): Promise<void> {
  return notifyAppointmentUpdated(row)
}

/** Envía el recordatorio de 24h. Devuelve true si se envió (para marcar la cita). */
export async function sendAppointmentReminder(row: AppointmentRow): Promise<boolean> {
  const config = getOpenWaConfig()
  if (!config) return false
  if (row.status === 'cancelled' || row.status === 'no_show') return false

  const text = await buildAppointmentReminderMessage(row)
  const messageId = await sendCustomerWhatsApp(row, text)
  console.log(
    `Superpelu WhatsApp: recordatorio enviado a ${row.customer_phone}${messageId ? ` (${messageId})` : ''}`,
  )
  return true
}

/** Seguimiento tras marcar inasistencia desde la agenda. */
export async function notifyAppointmentNoShow(row: AppointmentRow): Promise<void> {
  const config = getOpenWaConfig()
  if (!config) return
  if (isColorGroupWashRow(row.color_group_role)) return

  const text = buildAppointmentNoShowMessage(row)
  const messageId = await sendCustomerWhatsApp(row, text)
  console.log(
    `Superpelu WhatsApp: inasistencia enviada a ${row.customer_phone}${messageId ? ` (${messageId})` : ''}`,
  )
}

/** Confirmación tras cancelar una cita (cliente desde enlace público). */
export async function notifyAppointmentCancelled(
  row: AppointmentRow,
  groupRows?: AppointmentRow[],
): Promise<void> {
  const config = getOpenWaConfig()
  if (!config) return

  const resolvedGroupRows =
    groupRows ??
    (row.booking_group_id
      ? filterWhatsAppBookingGroupRows(await getAppointmentsByBookingGroup(row.booking_group_id))
      : undefined)

  const text = buildAppointmentCancelledMessage(row, resolvedGroupRows)
  const messageId = await sendCustomerWhatsApp(row, text)
  console.log(
    `Superpelu WhatsApp: cancelación confirmada a ${row.customer_phone}${messageId ? ` (${messageId})` : ''}`,
  )
}

/** Evita reenvíos si el cliente pulsa «Finalizar» varias veces mientras OpenWA responde. */
const visitFinishInFlight = new Set<string>()
const visitFinishSentAt = new Map<string, number>()
const VISIT_FINISH_DEDUP_MS = 5 * 60_000

/** Resumen de visita multi-tratamiento tras guardar cambios (cliente). */
export async function notifyCustomerBookingVisitFinished(linkId: string): Promise<void> {
  const config = getOpenWaConfig()
  if (!config) return

  // Bloqueo síncrono por linkId (antes de cualquier await) para clics paralelos.
  if (visitFinishInFlight.has(linkId)) {
    console.log(`Superpelu WhatsApp: resumen de visita en curso (${linkId}), omitido`)
    return
  }
  visitFinishInFlight.add(linkId)

  try {
    const anchor = await getAppointmentById(linkId)
    if (!anchor) return

    const dedupeKey = anchor.booking_group_id ?? anchor.id
    const now = Date.now()
    const lastSent = visitFinishSentAt.get(dedupeKey)
    if (lastSent && now - lastSent < VISIT_FINISH_DEDUP_MS) {
      console.log(`Superpelu WhatsApp: resumen de visita ya enviado (${dedupeKey}), omitido`)
      return
    }

    if (!anchor.booking_group_id) {
      if (anchor.status === 'confirmed') {
        const text = await buildAppointmentVisitUpdatedMessage(anchor)
        await sendCustomerWhatsApp(anchor, text)
      } else if (anchor.status === 'cancelled') {
        await notifyAppointmentCancelled(anchor)
      }
      visitFinishSentAt.set(dedupeKey, Date.now())
      return
    }

    const allRows = await getAppointmentsByBookingGroup(anchor.booking_group_id)
    const activeRows = filterWhatsAppBookingGroupRows(
      allRows.filter((row) => row.status === 'confirmed'),
    )

    if (activeRows.length === 0) {
      const visibleRows = filterWhatsAppBookingGroupRows(allRows)
      await notifyAppointmentCancelled(anchor, visibleRows)
      visitFinishSentAt.set(dedupeKey, Date.now())
      return
    }

    const text = await buildAppointmentVisitUpdatedMessage(activeRows[0]!)
    const messageId = await sendCustomerWhatsApp(activeRows[0]!, text)
    visitFinishSentAt.set(dedupeKey, Date.now())
    console.log(
      `Superpelu WhatsApp: visita actualizada a ${anchor.customer_phone}${messageId ? ` (${messageId})` : ''}`,
    )
  } finally {
    visitFinishInFlight.delete(linkId)
  }
}
