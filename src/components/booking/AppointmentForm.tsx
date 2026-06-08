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
import { formatChainedAppointmentTimeRange } from '@/lib/bookingCombo'
import { formatAppointmentTimeRange } from '@/lib/bookingOccupancy'
import { formatDisplayDate, getBookableDates } from '@/lib/dates'
import { countServicesInCategory, servicesInCategory } from '@/lib/servicePicker'
import type { Appointment } from '@/types/booking'
import { typography } from '@/styles/typography'

const bookableDatesList = getBookableDates(35)

/** Título de paso visible solo en móvil (sustituye al h2 grande). */
const stepLegendMobile = `${typography.label} mb-6 block w-full text-center md:hidden`

type AppointmentFormProps = AppointmentFormOptions & {
  submitLabel?: string
  onConfirmed?: (appointment: Appointment, appointments?: Appointment[]) => void
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
  const confirmStep = 3

  const goPrev = useCallback(() => {
    if (step === scheduleStep && form.staffAssignments.length > 0) {
      form.resetChainSelection()
      return
    }
    if (step === scheduleStep && form.startTime) {
      form.setStartTime('')
      return
    }
    if (step === scheduleStep && form.date) {
      form.setDate('')
      return
    }
    setStep((current) => {
      if (current === scheduleStep) return 1
      if (current === 1 && form.serviceIds.length > 0) return 0
      if (current === 1 && pickedCategoryId) {
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
    form.serviceIds.length,
    form.staffAssignments.length,
    form.resetChainSelection,
  ])

  const handleCategorySelected = useCallback(
    (categoryId: string) => {
      const inCategory = servicesInCategory(form.services, categoryId)
      if (form.serviceIds.length > 0) {
        setStep(1)
        return
      }
      if (inCategory.length === 1) {
        form.setServiceIds([inCategory[0].id])
        setStep(2)
        return
      }
      setStep(1)
    },
    [form.services, form.serviceIds.length, form.setServiceIds],
  )

  const handleContinueWithServices = useCallback(() => {
    if (form.serviceIds.length > 0) setStep(2)
  }, [form.serviceIds.length])

  const handleTimeSelected = useCallback(
    (slot: string) => {
      form.setStartTime(slot)
    },
    [form.setStartTime],
  )

  const handleStaffSelected = useCallback(
    async (staffId: string) => {
      if (form.hasMultipleServices) {
        const done = await form.pickChainStaff(staffId)
        if (done) setStep(confirmStep)
        return
      }
      form.setStaffId(staffId)
      setStep(confirmStep)
    },
    [form.hasMultipleServices, form.pickChainStaff, form.setStaffId],
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await form.submit()
  }

  const bookingServiceLines = useMemo(
    () =>
      form.selectedServices.map((service) => ({
        id: service.id,
        durationMinutes: service.durationMinutes,
      })),
    [form.selectedServices],
  )

  const pickerProps = {
    services: form.services,
    serviceIds: form.serviceIds,
    multiSelect: true,
    loading: form.servicesLoading,
    error: form.servicesError,
    onRetry: () => void form.loadServices(),
    onToggleService: form.toggleServiceId,
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

  const staffPickerOptions =
    form.hasMultipleServices && form.chainNextIndex != null
      ? form.chainNextStaff
      : form.staffAtSlot

  const staffPickerLegend =
    form.hasMultipleServices && form.chainNextIndex != null
      ? b.chooseStaffForTreatment(
          serviceDisplayName(form.selectedServices[form.chainNextIndex]!, locale),
          form.chainNextStartTime,
        )
      : form.hasMultipleServices && form.selectedServices[0]
        ? b.chooseStaffForFirstTreatment(
            serviceDisplayName(form.selectedServices[0], locale),
            form.startTime,
          )
        : b.chooseStaffForSlot

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
          <div className="space-y-6">
            <ServiceCategoryPickerPublic {...pickerProps} visibleSection="service" />
            {form.selectedServices.length > 0 && (
              <div className="space-y-3">
                <p className={`${typography.label} text-center`}>{b.selectedServices}</p>
                <ul className="space-y-2">
                  {form.selectedServices.map((service) => (
                    <li
                      key={service.id}
                      className="flex items-center justify-between gap-3 border border-gold/25 bg-cream/40 px-3 py-2 text-sm"
                    >
                      <span className="text-left text-gold">
                        {serviceDisplayName(service, locale)}
                      </span>
                      <button
                        type="button"
                        onClick={() => form.removeServiceId(service.id)}
                        className={`${typography.caption} shrink-0 cursor-pointer text-charcoal-muted underline-offset-2 hover:underline`}
                      >
                        {b.removeService}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Button type="button" variant="outline" size="md" onClick={() => setStep(0)}>
                {b.addAnotherService}
              </Button>
              <Button
                type="button"
                variant="solid"
                size="md"
                disabled={form.serviceIds.length === 0}
                onClick={handleContinueWithServices}
              >
                {b.continueWithServices}
              </Button>
            </div>
          </div>
        )}

        {step === scheduleStep && (
          <div className="space-y-8">
            {form.serviceIds.length === 0 ? (
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
                <div className="space-y-2 text-center">
                  <p className="font-sans text-sm capitalize text-charcoal">
                    {formatDisplayDate(form.date, locale)}
                  </p>
                  <button
                    type="button"
                    onClick={handleChangeDay}
                    className={`${typography.caption} cursor-pointer text-gold underline-offset-2 hover:underline`}
                  >
                    {b.changeDay}
                  </button>
                </div>
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
                          {bookingServiceLines.length > 0 && (
                            <span className="mt-0.5 block text-[10px] leading-tight text-charcoal-muted">
                              {bookingServiceLines.length === 1
                                ? formatAppointmentTimeRange(
                                    bookingServiceLines[0].id,
                                    slot,
                                    bookingServiceLines[0].durationMinutes,
                                    locale,
                                  )
                                : formatChainedAppointmentTimeRange(
                                    bookingServiceLines,
                                    slot,
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

                {form.chainSegments.length > 0 && (
                  <div className="space-y-2 rounded border border-gold/20 bg-cream/40 px-4 py-3 text-sm">
                    <p className={`${typography.label} text-center`}>{b.chainAssignedHeading}</p>
                    <ul className="space-y-1">
                      {form.chainSegments.map((segment) => {
                        const service = form.selectedServices[segment.serviceIndex]
                        return (
                          <li key={segment.serviceIndex} className="text-center text-charcoal">
                            {service ? serviceDisplayName(service, locale) : segment.serviceId}{' '}
                            · {segment.startTime} · {segment.staffName}
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )}

                {form.chainNeedsTimeChange && (
                  <p
                    className="rounded border border-amber-300/60 bg-amber-50 px-4 py-3 text-center text-sm text-amber-950"
                    role="status"
                  >
                    {b.chainNeedsTimeChange}
                  </p>
                )}

                {(form.chainConflict || form.chainPostpone) && (
                  <p
                    className="rounded border border-amber-300/60 bg-amber-50 px-4 py-3 text-center text-sm text-amber-950"
                    role="status"
                  >
                    {b.chainConflictIntro}
                  </p>
                )}

                <fieldset className="space-y-3">
                  <legend className={`${typography.label} mb-2 block w-full text-center md:hidden`}>
                    {b.staff}
                  </legend>
                  {form.loadingStaffAtSlot || form.loadingChain ? (
                    <p className={`${typography.caption} text-center`}>{b.loadingStaff}</p>
                  ) : staffPickerOptions.length === 0 &&
                    !form.chainNeedsTimeChange &&
                    !form.chainPostpone ? (
                    <p
                      className="rounded border border-amber-300/60 bg-amber-50 px-4 py-3 text-center text-sm text-amber-950"
                      role="status"
                    >
                      {form.staffAtSlotError || b.noStaffAtSlot}
                    </p>
                  ) : staffPickerOptions.length > 0 ? (
                    <>
                      <p className={`${typography.caption} text-center`}>{staffPickerLegend}</p>
                      <div className="grid gap-3">
                        {staffPickerOptions.map((member) => (
                          <label
                            key={member.id}
                            className="flex cursor-pointer items-start gap-3 border border-gold/20 p-4 transition-colors hover:border-gold/40"
                          >
                            <input
                              type="radio"
                              name={`staff-${form.chainNextIndex ?? 0}`}
                              value={member.id}
                              onChange={() => void handleStaffSelected(member.id)}
                              className="mt-1 accent-gold"
                            />
                            <span className="text-left">
                              <span className={`${typography.h3} block text-gold`}>
                                {member.name}
                              </span>
                              {member.role && (
                                <span className={`${typography.caption} block`}>{member.role}</span>
                              )}
                              {form.chainNextIndex != null &&
                                !form.chainAvailableStaffIds.includes(member.id) && (
                                  <span className={`${typography.caption} block text-charcoal-muted`}>
                                    {b.chainStaffBusyAtTime}
                                  </span>
                                )}
                            </span>
                          </label>
                        ))}
                      </div>
                    </>
                  ) : null}
                </fieldset>

                {form.chainPostpone && form.chainPostpone.slots.length > 0 && (
                  <fieldset className="space-y-3">
                    <legend className={`${typography.label} mb-2 block w-full text-center`}>
                      {b.chainPostponeHeading(
                        serviceDisplayName(
                          form.selectedServices[form.chainPostpone.serviceIndex]!,
                          locale,
                        ),
                        form.chainPostpone.idealStartTime,
                      )}
                    </legend>
                    <p className={`${typography.caption} text-center`}>{b.chainPostponeHint}</p>
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                      {form.chainPostpone.slots.map((slot) => (
                        <button
                          key={slot}
                          type="button"
                          onClick={() => void form.pickPostponeSlot(form.chainPostpone!.serviceIndex, slot)}
                          className="cursor-pointer border border-gold/20 py-2 text-center text-sm transition-colors hover:border-gold/50"
                        >
                          {slot}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                )}
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
