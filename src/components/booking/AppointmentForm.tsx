import { useCallback, useMemo, useState } from 'react'
import { BookingMonthCalendar } from '@/components/booking/BookingMonthCalendar'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { ServiceCategoryPickerPublic } from '@/components/shared/ServiceCategoryPickerPublic'
import {
  useAppointmentForm,
  type AppointmentFormOptions,
} from '@/hooks/useAppointmentForm'
import { serviceDisplayName } from '@/i18n/helpers'
import { useTranslation } from '@/i18n/useTranslation'
import { formatAppointmentTimeRange } from '@/lib/bookingOccupancy'
import { formatDisplayDate, getBookableDates } from '@/lib/dates'
import { countServicesInCategory } from '@/lib/servicePicker'
import type { Appointment } from '@/types/booking'
import { typography } from '@/styles/typography'

const bookableDatesList = getBookableDates(35)

/** Título de paso visible solo en móvil (sustituye al h2 grande). */
const stepLegendMobile = `${typography.label} mb-6 block w-full text-center md:hidden`

type AppointmentFormProps = AppointmentFormOptions & {
  submitLabel?: string
  onConfirmed?: (appointment: Appointment) => void
}

export function AppointmentForm({
  submitLabel,
  onConfirmed,
  onSuccess,
  ...formOptions
}: AppointmentFormProps) {
  const { locale, t } = useTranslation()
  const bookingSteps = t.booking.steps
  const b = t.booking

  const form = useAppointmentForm({
    ...formOptions,
    onSuccess: (apt) => {
      onSuccess?.(apt)
      onConfirmed?.(apt)
    },
  })

  const [step, setStep] = useState(0)
  const [pickedCategoryId, setPickedCategoryId] = useState('')

  const scheduleStep = 2

  const goPrev = useCallback(() => {
    if (step === scheduleStep && form.startTime) {
      form.setStartTime('')
      return
    }
    if (step === scheduleStep && form.date) {
      form.setDate('')
      return
    }
    setStep((current) => {
      if (current === scheduleStep && pickedCategoryId) {
        const count = countServicesInCategory(form.services, pickedCategoryId)
        if (count === 1) return 0
      }
      return Math.max(current - 1, 0)
    })
  }, [
    step,
    form.startTime,
    form.date,
    form.setStartTime,
    form.setDate,
    pickedCategoryId,
    form.services,
  ])

  const handleCategorySelected = useCallback(
    (categoryId: string) => {
      const count = countServicesInCategory(form.services, categoryId)
      setStep(count === 1 ? 2 : 1)
    },
    [form.services],
  )

  const handleServiceSelected = useCallback(() => {
    setStep(2)
  }, [])

  const handleTimeSelected = useCallback(
    (slot: string) => {
      form.setStartTime(slot)
    },
    [form.setStartTime],
  )

  const handleStaffSelected = useCallback(
    (staffId: string) => {
      form.setStaffId(staffId)
      setStep(3)
    },
    [form.setStaffId],
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await form.submit()
  }

  const pickerProps = {
    services: form.services,
    serviceId: form.serviceId,
    loading: form.servicesLoading,
    error: form.servicesError,
    onRetry: () => void form.loadServices(),
    onServiceChange: form.setServiceId,
    categoryId: pickedCategoryId,
    onCategoryChange: setPickedCategoryId,
  }

  const confirmLabel = submitLabel ?? b.confirm
  const bookableDates = useMemo(() => new Set(bookableDatesList), [])

  const handleChangeDay = useCallback(() => {
    form.setDate('')
  }, [form.setDate])

  const handleChangeTime = useCallback(() => {
    form.setStartTime('')
  }, [form.setStartTime])

  const confirmStep = 3

  const calendarProps = {
    bookableDates,
    locale,
    selectedDate: form.date,
    onSelect: form.setDate,
    prevMonthLabel: b.prevMonth,
    nextMonthLabel: b.nextMonth,
  }

  return (
    <form onSubmit={handleSubmit} className="relative mx-auto max-w-lg md:max-w-4xl">
      {step > 0 && (
        <button
          type="button"
          onClick={goPrev}
          className="ui-rounded absolute left-0 top-0 flex h-9 w-9 cursor-pointer items-center justify-center border border-gold/30 text-lg leading-none text-gold transition-colors hover:border-gold/60 hover:bg-gold/5 focus:outline-none focus:ring-2 focus:ring-gold/70"
          aria-label={b.prevStep}
        >
          ‹
        </button>
      )}

      <div className={`mb-6 text-center md:mb-8 ${step > 0 ? 'pt-1' : ''}`}>
        <p className={`${typography.caption} mb-2 hidden md:block`}>
          {b.stepProgress(step + 1, bookingSteps.length)}
        </p>
        <h2 className={`${typography.h2} hidden md:block`}>{bookingSteps[step]}</h2>
        <div className="flex justify-center gap-2 md:mt-5" aria-hidden>
          {bookingSteps.map((_, index) => (
            <span
              key={index}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                index === step ? 'w-7 bg-gold' : index < step ? 'w-2.5 bg-gold/60' : 'w-2.5 bg-gold/20'
              }`}
            />
          ))}
        </div>
      </div>

      <div key={step} className="booking-step-enter">
        {step === 0 && (
          <ServiceCategoryPickerPublic
            {...pickerProps}
            visibleSection="category"
            onCategorySelected={handleCategorySelected}
          />
        )}

        {step === 1 && (
          <ServiceCategoryPickerPublic
            {...pickerProps}
            visibleSection="service"
            onServiceSelected={handleServiceSelected}
          />
        )}

        {step === scheduleStep && (
          <div className="space-y-8">
            {!form.serviceId ? (
              <p className={`${typography.caption} text-center`}>{b.chooseServiceFirst}</p>
            ) : !form.date ? (
              <div>
                <p className={`${typography.label} mb-4 block w-full text-center md:hidden`}>
                  {b.day}
                </p>
                <BookingMonthCalendar {...calendarProps} />
                <p className={`${typography.caption} mt-3 text-center`}>{b.selectDay}</p>
              </div>
            ) : !form.startTime ? (
              <>
                <BookingMonthCalendar {...calendarProps} compact />
                <fieldset className="space-y-3">
                  <legend className={`${typography.label} mb-2 block w-full text-center md:hidden`}>
                    {b.hour}
                  </legend>
                  {form.loadingSlots ? (
                    <p className={`${typography.caption} text-center`}>{b.loadingSlots}</p>
                  ) : form.slots.length === 0 ? (
                    <p
                      className="rounded border border-amber-300/60 bg-amber-50 px-4 py-3 text-center text-sm text-amber-950"
                      role="status"
                    >
                      {form.slotsError || b.noSlots}
                    </p>
                  ) : (
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                      {form.slots.map((slot) => (
                        <label
                          key={slot}
                          className="cursor-pointer border border-gold/20 py-2 text-center text-sm transition-colors hover:border-gold/50"
                        >
                          <input
                            type="radio"
                            name="time"
                            value={slot}
                            onChange={() => handleTimeSelected(slot)}
                            className="sr-only"
                          />
                          {slot}
                          {form.selectedService && (
                            <span className="mt-0.5 block text-[10px] leading-tight text-charcoal-muted">
                              {formatAppointmentTimeRange(
                                form.selectedService.id,
                                slot,
                                form.selectedService.durationMinutes,
                                locale,
                              )}
                            </span>
                          )}
                        </label>
                      ))}
                    </div>
                  )}
                </fieldset>
              </>
            ) : (
              <>
                <div className="space-y-2 text-center">
                  <p className="font-sans text-sm capitalize text-charcoal">
                    {formatDisplayDate(form.date, locale)} · {form.startTime}
                  </p>
                  <div className="flex flex-wrap justify-center gap-x-4 gap-y-1">
                    <button
                      type="button"
                      onClick={handleChangeDay}
                      className={`${typography.caption} cursor-pointer text-gold underline-offset-2 hover:underline`}
                    >
                      {b.changeDay}
                    </button>
                    <button
                      type="button"
                      onClick={handleChangeTime}
                      className={`${typography.caption} cursor-pointer text-gold underline-offset-2 hover:underline`}
                    >
                      {b.changeTime}
                    </button>
                  </div>
                </div>

                <fieldset className="space-y-3">
                  <legend className={`${typography.label} mb-2 block w-full text-center md:hidden`}>
                    {b.staff}
                  </legend>
                  {form.loadingStaffAtSlot ? (
                    <p className={`${typography.caption} text-center`}>{b.loadingStaff}</p>
                  ) : form.staffAtSlot.length === 0 ? (
                    <p
                      className="rounded border border-amber-300/60 bg-amber-50 px-4 py-3 text-center text-sm text-amber-950"
                      role="status"
                    >
                      {form.staffAtSlotError || b.noStaffAtSlot}
                    </p>
                  ) : (
                    <>
                      <p className={`${typography.caption} text-center`}>{b.chooseStaffForSlot}</p>
                      <div className="grid gap-3">
                        {form.staffAtSlot.map((member) => (
                          <label
                            key={member.id}
                            className={`flex cursor-pointer items-start gap-3 border p-4 transition-colors ${
                              form.staffId === member.id
                                ? 'border-gold bg-gold/5'
                                : 'border-gold/20 hover:border-gold/40'
                            }`}
                          >
                            <input
                              type="radio"
                              name="staff"
                              value={member.id}
                              checked={form.staffId === member.id}
                              onChange={() => handleStaffSelected(member.id)}
                              className="mt-1 accent-gold"
                            />
                            <span className="text-left">
                              <span className={`${typography.h3} block text-gold`}>
                                {member.name}
                              </span>
                              {member.role && (
                                <span className={typography.caption}>{member.role}</span>
                              )}
                            </span>
                          </label>
                        ))}
                      </div>
                    </>
                  )}
                </fieldset>
              </>
            )}
          </div>
        )}

        {step === confirmStep && (
          <div className="space-y-4">
            <p className={stepLegendMobile}>{bookingSteps[confirmStep]}</p>
            <Input
              label={b.fullName}
              required
              value={form.customerName}
              error={form.fieldErrors.name}
              onChange={(e) => form.setCustomerName(e.target.value)}
              autoComplete="name"
            />
            <Input
              label={b.phone}
              type="tel"
              required
              value={form.customerPhone}
              error={form.fieldErrors.phone}
              onChange={(e) => form.setCustomerPhone(e.target.value)}
              autoComplete="tel"
              placeholder="600 000 000"
            />
            <Input
              label={b.emailOptional}
              type="email"
              value={form.customerEmail}
              onChange={(e) => form.setCustomerEmail(e.target.value)}
              autoComplete="email"
            />
            <Textarea
              label={b.notesOptional}
              value={form.notes}
              onChange={(e) => form.setNotes(e.target.value)}
              placeholder={b.notesPlaceholder}
            />

            {form.selectedStaff && form.selectedService && (
              <p className={`${typography.caption} text-center`}>
                {form.selectedStaff.name} · {serviceDisplayName(form.selectedService, locale)}
                {form.date && form.startTime && (
                  <>
                    {' '}
                    · {formatDisplayDate(form.date, locale)} · {form.startTime}
                  </>
                )}
              </p>
            )}
          </div>
        )}
      </div>

      {form.error && (
        <p className="mt-6 text-center text-sm text-red-700" role="alert">
          {form.error}
        </p>
      )}

      {step === bookingSteps.length - 1 && (
        <Button
          type="submit"
          variant="solid"
          size="lg"
          className="mt-10 w-full"
          disabled={form.submitting}
        >
          {form.submitting ? b.saving : confirmLabel}
        </Button>
      )}
    </form>
  )
}
