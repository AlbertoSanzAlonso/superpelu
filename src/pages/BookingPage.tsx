import { useState } from 'react'
import { PageShell } from '@/components/layout/PageShell'
import { Button } from '@/components/ui/Button'
import { AppointmentForm } from '@/components/booking/AppointmentForm'
import { AddToCalendarButton } from '@/components/booking/AddToCalendarButton'
import { formatChainedAppointmentTimeRange } from '@/lib/booking/combo'
import { formatAppointmentTimeRange } from '@/lib/booking/occupancy'
import { formatDisplayDate } from '@/lib/core/dates'
import { useTranslation } from '@/i18n/useTranslation'
import type { Appointment } from '@/types/booking'
import { typography } from '@/styles/typography'

type BookingConfirmation = {
  appointments: Appointment[]
}

export function BookingPage() {
  const { t, locale } = useTranslation()
  const [confirmed, setConfirmed] = useState<BookingConfirmation | null>(null)

  if (confirmed) {
    const labels = t.booking.summaryLabels
    const primary = confirmed.appointments[0]
    const serviceLabel =
      confirmed.appointments.length === 1
        ? confirmed.appointments[0].serviceName
        : confirmed.appointments.map((apt) => apt.serviceName).join(' · ')
    const scheduleLabel =
      confirmed.appointments.length === 1
        ? formatAppointmentTimeRange(
            primary.serviceId,
            primary.startTime,
            primary.durationMinutes,
            locale,
            { colorGroupRole: primary.colorGroupRole },
          )
        : formatChainedAppointmentTimeRange(
            confirmed.appointments.map((apt) => ({
              id: apt.serviceId,
              durationMinutes: apt.durationMinutes,
            })),
            primary.startTime,
            locale,
          )

    return (
      <PageShell
        title={t.booking.confirmedTitle}
        subtitle={t.booking.confirmedSubtitle}
        brandWatermark
      >
        <div className="mx-auto max-w-lg border border-gold/25 bg-cream p-10 text-center">
          <p className={`${typography.body} mb-6`}>{t.booking.confirmedBody}</p>
          <dl className={`${typography.body} space-y-3 text-left`}>
            <div>
              <dt className={typography.label}>
                {confirmed.appointments.length === 1 ? labels.service : labels.services}
              </dt>
              <dd>{serviceLabel}</dd>
            </div>
            {primary.staffName && (
              <div>
                <dt className={typography.label}>{labels.staff}</dt>
                <dd>{primary.staffName}</dd>
              </div>
            )}
            <div>
              <dt className={typography.label}>{labels.date}</dt>
              <dd className="capitalize">{formatDisplayDate(primary.date, locale)}</dd>
            </div>
            <div>
              <dt className={typography.label}>{labels.schedule}</dt>
              <dd>{scheduleLabel}</dd>
            </div>
            <div>
              <dt className={typography.label}>{labels.name}</dt>
              <dd>{primary.customerName}</dd>
            </div>
          </dl>
          <div className="mt-10 space-y-4">
            <AddToCalendarButton appointment={primary} />
            <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
              <Button href="/" variant="outline" size="md">
                {t.common.home}
              </Button>
              <Button href="/reservar" variant="outline" size="md">
                {t.booking.newAppointment}
              </Button>
            </div>
          </div>
        </div>
      </PageShell>
    )
  }

  return (
    <PageShell
      title={t.booking.pageTitle}
      subtitle={t.booking.pageSubtitle}
      titleClassName="font-serif text-2xl uppercase tracking-brand text-charcoal md:text-4xl"
      subtitleClassName="hidden md:block"
      brandWatermark
    >
      <AppointmentForm
        onConfirmed={(appointment, appointments) => {
          setConfirmed({
            appointments: appointments?.length ? appointments : [appointment],
          })
        }}
      />
    </PageShell>
  )
}
