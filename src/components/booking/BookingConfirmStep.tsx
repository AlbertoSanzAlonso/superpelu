import { Input, Textarea } from '@/components/ui/Input'
import type { AppointmentFormApi } from '@/hooks/useAppointmentForm'
import { serviceDisplayName } from '@/i18n/helpers'
import type { Locale } from '@/i18n/types'
import { formatDisplayDate } from '@/lib/core/dates'
import { typography } from '@/styles/typography'

const stepLegendMobile = `${typography.label} mb-6 block w-full text-center md:hidden`

type BookingConfirmStepProps = {
  form: AppointmentFormApi
  locale: Locale
  stepTitle: string
  labels: {
    fullName: string
    phone: string
    emailOptional: string
    notesOptional: string
    notesPlaceholder: string
  }
}

export function BookingConfirmStep({ form, locale, stepTitle, labels }: BookingConfirmStepProps) {
  return (
    <div className="space-y-4">
      <p className={stepLegendMobile}>{stepTitle}</p>
      <Input
        label={labels.fullName}
        required
        value={form.customerName}
        error={form.fieldErrors.name}
        onChange={(e) => form.setCustomerName(e.target.value)}
        autoComplete="name"
      />
      <Input
        label={labels.phone}
        type="tel"
        required
        value={form.customerPhone}
        error={form.fieldErrors.phone}
        onChange={(e) => form.setCustomerPhone(e.target.value)}
        autoComplete="tel"
        placeholder="600 000 000"
      />
      <Input
        label={labels.emailOptional}
        type="email"
        value={form.customerEmail}
        onChange={(e) => form.setCustomerEmail(e.target.value)}
        autoComplete="email"
      />
      <Textarea
        label={labels.notesOptional}
        value={form.notes}
        onChange={(e) => form.setNotes(e.target.value)}
        placeholder={labels.notesPlaceholder}
      />

      {form.selectedServices.length > 0 && form.date && form.startTime && (
        <div className={`${typography.caption} space-y-1 text-center`}>
          <p className="capitalize">
            {formatDisplayDate(form.date, locale)} · {form.startTime}
          </p>
          {form.hasMultipleServices && form.chainSegments.length > 0 ? (
            <ul className="space-y-0.5">
              {form.chainSegments.map((segment) => {
                const service = form.selectedServices[segment.serviceIndex]
                return (
                  <li key={segment.serviceIndex}>
                    {service ? serviceDisplayName(service, locale) : segment.serviceId} ·{' '}
                    {segment.startTime} · {segment.staffName}
                  </li>
                )
              })}
            </ul>
          ) : (
            form.selectedStaff && (
              <p>
                {form.selectedStaff.name} ·{' '}
                {form.selectedServices.map((s) => serviceDisplayName(s, locale)).join(' + ')}
              </p>
            )
          )}
        </div>
      )}
    </div>
  )
}
