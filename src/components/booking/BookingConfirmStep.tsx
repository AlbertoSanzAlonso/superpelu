import { Input, Textarea } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import type { AppointmentFormApi } from '@/hooks/useAppointmentForm'
import { serviceDisplayName } from '@/i18n/helpers'
import type { Locale } from '@/i18n/types'
import { capitalizePersonName } from '@/lib/customer/name'
import { formatDisplayDate } from '@/lib/core/dates'
import { typography } from '@/styles/typography'

const stepLegendMobile = `${typography.label} mb-6 block w-full text-center md:hidden`
const forSomeoneElseHintClass = `${typography.caption} rounded border border-red-300 bg-red-50 px-3 py-2.5 text-center text-red-800`

type BookingConfirmStepProps = {
  form: AppointmentFormApi
  locale: Locale
  stepTitle: string
  labels: {
    fullName: string
    phone: string
    emailOptional: string
    birthdate: string
    notesOptional: string
    notesPlaceholder: string
    returningCustomerQuestion: string
    returningCustomerYes: string
    returningCustomerNo: string
    returningLookupHint: string
    returningGreeting: (name: string) => string
    returningForSomeoneElseHint: string
    returningNotFound: string
    lookupCustomer: string
    lookingUpCustomer: string
    changeCustomerType: string
  }
}

export function BookingConfirmStep({ form, locale, stepTitle, labels }: BookingConfirmStepProps) {
  const customerType = form.customerType

  return (
    <div className="space-y-4">
      <p className={stepLegendMobile}>{stepTitle}</p>

      {customerType === null && (
        <div className="space-y-3">
          <p className={`${typography.label} text-center`}>{labels.returningCustomerQuestion}</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="solid"
              className="w-full"
              onClick={() => form.setCustomerType('returning')}
            >
              {labels.returningCustomerYes}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => form.setCustomerType('new')}
            >
              {labels.returningCustomerNo}
            </Button>
          </div>
        </div>
      )}

      {customerType !== null && (
        <button
          type="button"
          className={`${typography.caption} text-gold underline-offset-2 hover:underline`}
          onClick={() => form.resetCustomerType()}
        >
          {labels.changeCustomerType}
        </button>
      )}

      {customerType === 'returning' && !form.returningVerified && (
        <div className="space-y-3">
          <p className={`${typography.caption}`}>{labels.returningLookupHint}</p>
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
          {form.returningLookupError && (
            <p className="text-center text-sm text-amber-800" role="alert">
              {form.returningLookupError === 'not_found'
                ? labels.returningNotFound
                : form.returningLookupError}
            </p>
          )}
          <Button
            type="button"
            variant="solid"
            size="lg"
            className="w-full"
            disabled={form.lookingUpCustomer || !form.customerPhone.trim()}
            onClick={() => void form.lookupReturningCustomer()}
          >
            {form.lookingUpCustomer ? labels.lookingUpCustomer : labels.lookupCustomer}
          </Button>
        </div>
      )}

      {customerType === 'returning' && form.returningVerified && (
        <div className="space-y-4">
          <p className={`${typography.body} text-center text-charcoal`}>
            {labels.returningGreeting(capitalizePersonName(form.returningFirstName))}
          </p>
          <Input
            label={labels.phone}
            type="tel"
            value={form.customerPhone}
            disabled
            autoComplete="tel"
          />
          <p className={forSomeoneElseHintClass} role="note">
            {labels.returningForSomeoneElseHint}
          </p>
          <Textarea
            label={labels.notesOptional}
            value={form.notes}
            onChange={(e) => form.setNotes(e.target.value)}
            placeholder={labels.notesPlaceholder}
          />
        </div>
      )}

      {customerType === 'new' && (
        <>
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
          <Input
            label={labels.birthdate}
            type="date"
            required
            value={form.birthdate}
            error={form.fieldErrors.birthdate}
            onChange={(e) => form.setBirthdate(e.target.value)}
            autoComplete="bday"
          />
          <p className={forSomeoneElseHintClass} role="note">
            {labels.returningForSomeoneElseHint}
          </p>
          <Textarea
            label={labels.notesOptional}
            value={form.notes}
            onChange={(e) => form.setNotes(e.target.value)}
            placeholder={labels.notesPlaceholder}
          />
        </>
      )}

      {form.selectedServices.length > 0 && form.date && form.startTime && customerType !== null && (
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
