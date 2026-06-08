import { GOOGLE_REVIEW_WRITE_URL } from '@/data/googleReview'
import { formatAppointmentTimeRange, isColorGroupWashRow } from '@/lib/bookingOccupancy'
import { formatDisplayDate } from '@/lib/dates'
import type { AppointmentRow } from '@server/pg/types'
import type { Locale } from './types'
import { getTranslation } from './translations'
import { appointmentLocale } from './localeHelpers'

const SALON_ADDRESS = 'Av. las Palmeras, 8, Local 18, 29630 Benalmádena'
const SALON_PHONE = '952 443 686'

type MessageKind = 'confirmation' | 'rescheduled' | 'updated' | 'reminder' | 'cancelled' | 'no_show'

function visibleBookingGroupRows(rows: AppointmentRow[]): AppointmentRow[] {
  return rows
    .filter((row) => !isColorGroupWashRow(row.color_group_role))
    .sort((a, b) => a.start_time.localeCompare(b.start_time) || a.id.localeCompare(b.id))
}

function resolveGroupRows(
  row: AppointmentRow,
  groupRows?: AppointmentRow[],
): AppointmentRow[] {
  const rows =
    groupRows && groupRows.length > 0
      ? visibleBookingGroupRows(groupRows)
      : visibleBookingGroupRows([row])
  return rows.length > 0 ? rows : [row]
}

function appendServiceLines(
  lines: string[],
  rows: AppointmentRow[],
  locale: Locale,
  wa: ReturnType<typeof getTranslation>['whatsappAppointment'],
): void {
  if (rows.length <= 1) {
    const apt = rows[0]
    lines.push(`💇 ${apt.service_name}`)
    lines.push(wa.withStaff(apt.staff_name ?? 'Superpelu'))
    return
  }

  lines.push(`💇 ${wa.treatmentsHeading}`)
  for (const apt of rows) {
    const timeRange = formatAppointmentTimeRange(
      apt.service_id,
      apt.start_time,
      apt.duration_minutes,
      locale,
      { rangeSeparator: 'word', colorGroupRole: apt.color_group_role },
    )
    lines.push(`   • ${apt.service_name} (${timeRange})`)
  }

  const staffNames = [...new Set(rows.map((apt) => apt.staff_name).filter(Boolean))]
  if (staffNames.length === 1) {
    lines.push(wa.withStaff(staffNames[0]!))
  } else {
    for (const apt of rows) {
      if (apt.staff_name) {
        lines.push(`   ${wa.withStaff(apt.staff_name)} — ${apt.service_name}`)
      }
    }
  }
}

export function buildWhatsAppAppointmentMessage(
  row: AppointmentRow,
  kind: MessageKind,
  options?: {
    manageUrl?: string | null
    bookingUrl?: string | null
    groupRows?: AppointmentRow[]
  },
): string {
  const locale = appointmentLocale(row)
  const wa = getTranslation(locale).whatsappAppointment
  const firstName = row.customer_name.trim().split(/\s+/)[0] || row.customer_name
  const groupRows = resolveGroupRows(row, options?.groupRows)

  const heading =
    kind === 'confirmation'
      ? wa.confirmationHeading
      : kind === 'rescheduled'
        ? wa.rescheduledHeading
        : kind === 'updated'
          ? wa.visitUpdatedHeading
          : kind === 'reminder'
            ? wa.reminderHeading
            : kind === 'no_show'
              ? wa.noShowHeading
              : wa.cancelledHeading

  const dateLabel = formatDisplayDate(row.appointment_date, locale)
  const visitStart = groupRows[0]?.start_time ?? row.start_time
  const visitEndRow = groupRows[groupRows.length - 1] ?? row
  const visitEndRange = formatAppointmentTimeRange(
    visitEndRow.service_id,
    visitEndRow.start_time,
    visitEndRow.duration_minutes,
    locale,
    { rangeSeparator: 'word', colorGroupRole: visitEndRow.color_group_role },
  )
  const visitEndTime = visitEndRange.includes(' a ')
    ? visitEndRange.split(' a ').pop()!
    : visitEndRange.includes(' to ')
      ? visitEndRange.split(' to ').pop()!
      : visitEndRange

  const lines = [
    wa.greeting(firstName),
    '',
    heading,
    '',
    `📅 ${dateLabel}`,
    groupRows.length > 1
      ? `🕐 ${visitStart} a ${visitEndTime}`
      : `🕐 ${formatAppointmentTimeRange(
          row.service_id,
          row.start_time,
          row.duration_minutes,
          locale,
          { rangeSeparator: 'word', colorGroupRole: row.color_group_role },
        )}`,
  ]

  appendServiceLines(lines, groupRows, locale, wa)

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

export function buildGoogleReviewRequestMessage(locale: Locale, firstName: string): string {
  const wa = getTranslation(locale).whatsappAppointment
  const name = firstName.trim() || firstName
  return [
    wa.greeting(name),
    '',
    wa.reviewRequestHeading,
    '',
    `${wa.reviewRequestLinkLabel}`,
    GOOGLE_REVIEW_WRITE_URL,
    '',
    wa.reviewRequestClosing,
    '',
    `📍 ${SALON_ADDRESS}`,
    `📞 ${SALON_PHONE}`,
  ].join('\n')
}

/** Filas visibles de un grupo de reserva (sin lavados enlazados). */
export function filterWhatsAppBookingGroupRows(rows: AppointmentRow[]): AppointmentRow[] {
  return visibleBookingGroupRows(rows)
}
