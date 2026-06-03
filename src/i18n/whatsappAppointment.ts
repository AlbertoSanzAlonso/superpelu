import { formatAppointmentTimeRange } from '@/lib/bookingOccupancy'
import { formatDisplayDate } from '@/lib/dates'
import type { AppointmentRow } from '@server/pg/types'
import { getTranslation } from './translations'
import { appointmentLocale } from './localeHelpers'

const SALON_ADDRESS = 'Av. las Palmeras, 8, Local 18, 29630 Benalmádena'
const SALON_PHONE = '952 443 686'

type MessageKind = 'confirmation' | 'rescheduled' | 'reminder' | 'cancelled' | 'no_show'

export function buildWhatsAppAppointmentMessage(
  row: AppointmentRow,
  kind: MessageKind,
  options?: { manageUrl?: string | null; bookingUrl?: string | null },
): string {
  const locale = appointmentLocale(row)
  const wa = getTranslation(locale).whatsappAppointment
  const firstName = row.customer_name.trim().split(/\s+/)[0] || row.customer_name

  const heading =
    kind === 'confirmation'
      ? wa.confirmationHeading
      : kind === 'rescheduled'
        ? wa.rescheduledHeading
        : kind === 'reminder'
          ? wa.reminderHeading
          : kind === 'no_show'
            ? wa.noShowHeading
            : wa.cancelledHeading

  const dateLabel = formatDisplayDate(row.appointment_date, locale)
  const timeRange = formatAppointmentTimeRange(
    row.service_id,
    row.start_time,
    row.duration_minutes,
    locale,
    { rangeSeparator: 'word', colorGroupRole: row.color_group_role },
  )

  const lines = [
    wa.greeting(firstName),
    '',
    heading,
    '',
    `📅 ${dateLabel}`,
    `🕐 ${timeRange}`,
    `💇 ${row.service_name}`,
    wa.withStaff(row.staff_name ?? 'Superpelu'),
  ]

  if (kind === 'cancelled' || kind === 'no_show') {
    const rebookLabel = kind === 'no_show' ? wa.noShowRebookLabel : wa.bookAgainLabel
    if (options?.bookingUrl) {
      lines.push('', `${rebookLabel} ${options.bookingUrl}`)
    }
    const closing = kind === 'no_show' ? wa.closingNoShow : wa.closingThanks
    lines.push('', `📍 ${SALON_ADDRESS}`, `📞 ${SALON_PHONE}`, '', closing)
    return lines.join('\n')
  }

  if (options?.manageUrl) {
    lines.push('', wa.manageLinkLabel, options.manageUrl)
  }

  lines.push('', `📍 ${SALON_ADDRESS}`, `📞 ${SALON_PHONE}`, '', wa.closingConfirmed)
  return lines.join('\n')
}
