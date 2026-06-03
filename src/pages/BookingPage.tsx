import { useState } from 'react'
import { PageShell } from '@/components/layout/PageShell'
import { Button } from '@/components/ui/Button'
import { AppointmentForm } from '@/components/booking/AppointmentForm'
import { AddToCalendarButton } from '@/components/booking/AddToCalendarButton'
import { formatAppointmentTimeRange } from '@/lib/bookingOccupancy'
import { formatDisplayDate } from '@/lib/dates'
import { useTranslation } from '@/i18n/useTranslation'
import type { Appointment } from '@/types/booking'
import { typography } from '@/styles/typography'

export function BookingPage() {
  const { t, locale } = useTranslation()
  const [confirmed, setConfirmed] = useState<Appointment | null>(null)

  if (confirmed) {
    const labels = t.booking.summaryLabels
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
              <dt className={typography.label}>{labels.service}</dt>
              <dd>{confirmed.serviceName}</dd>
            </div>
            {confirmed.staffName && (
              <div>
                <dt className={typography.label}>{labels.staff}</dt>
                <dd>{confirmed.staffName}</dd>
              </div>
            )}
            <div>
              <dt className={typography.label}>{labels.date}</dt>
              <dd className="capitalize">{formatDisplayDate(confirmed.date, locale)}</dd>
            </div>
            <div>
              <dt className={typography.label}>{labels.schedule}</dt>
              <dd>
                {formatAppointmentTimeRange(
                  confirmed.serviceId,
                  confirmed.startTime,
                  confirmed.durationMinutes,
                  locale,
                  { colorGroupRole: confirmed.colorGroupRole },
                )}
              </dd>
            </div>
            <div>
              <dt className={typography.label}>{labels.name}</dt>
              <dd>{confirmed.customerName}</dd>
            </div>
          </dl>
          <div className="mt-10 space-y-4">
            <AddToCalendarButton appointment={confirmed} />
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
      <AppointmentForm onConfirmed={setConfirmed} />
    </PageShell>
  )
}
