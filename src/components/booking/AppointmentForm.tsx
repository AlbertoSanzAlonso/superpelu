import { useCallback, useMemo } from 'react'
import { BookingCategoryStep } from '@/components/booking/BookingCategoryStep'
import { BookingConfirmStep } from '@/components/booking/BookingConfirmStep'
import { BookingFormProgress } from '@/components/booking/BookingFormProgress'
import { BookingScheduleStep } from '@/components/booking/BookingScheduleStep'
import { BookingServiceStep } from '@/components/booking/BookingServiceStep'
import {
  CONFIRM_STEP,
  SCHEDULE_STEP,
  useBookingWizardSteps,
} from '@/components/booking/useBookingWizardSteps'
import { Button } from '@/components/ui/Button'
import {
  useAppointmentForm,
  type AppointmentFormOptions,
} from '@/hooks/useAppointmentForm'
import { serviceDisplayName } from '@/i18n/helpers'
import { useTranslation } from '@/i18n/useTranslation'
import { getBookableDates } from '@/lib/core/dates'
import type { Appointment } from '@/types/booking'

const bookableDatesList = getBookableDates(35)

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
    onSuccess: (apt, appointments) => {
      onSuccess?.(apt, appointments)
      onConfirmed?.(apt, appointments)
    },
  })

  const wizard = useBookingWizardSteps(form)

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

  const bookableDates = useMemo(() => new Set(bookableDatesList), [])

  const handleChangeDay = useCallback(() => {
    form.setDate('')
  }, [form.setDate])

  const handleChangeTime = useCallback(() => {
    form.setStartTime('')
  }, [form.setStartTime])

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

  const pickerBase = {
    services: form.services,
    serviceIds: form.serviceIds,
    loading: form.servicesLoading,
    error: form.servicesError,
    onRetry: () => void form.loadServices(),
    onToggleService: form.toggleServiceId,
    categoryId: wizard.pickedCategoryId,
    onCategoryChange: wizard.setPickedCategoryId,
  }

  const confirmLabel = submitLabel ?? b.confirm

  return (
    <form onSubmit={handleSubmit} className="relative mx-auto max-w-lg md:max-w-4xl">
      <BookingFormProgress
        step={wizard.step}
        stepLabels={bookingSteps}
        progressLabel={b.stepProgress(wizard.step + 1, bookingSteps.length)}
        backLabel={b.prevStep}
        onBack={wizard.goPrev}
      />

      <div key={wizard.step} className="booking-step-enter">
        {wizard.step === 0 && (
          <BookingCategoryStep
            {...pickerBase}
            onCategorySelected={wizard.handleCategorySelected}
          />
        )}

        {wizard.step === 1 && (
          <BookingServiceStep
            locale={locale}
            labels={{
              selectedServices: b.selectedServices,
              removeService: b.removeService,
              addAnotherService: b.addAnotherService,
              continueWithServices: b.continueWithServices,
            }}
            selectedServices={form.selectedServices}
            onRemoveService={form.removeServiceId}
            onBackToCategories={() => wizard.setStep(0)}
            onContinue={wizard.handleContinueWithServices}
            {...pickerBase}
          />
        )}

        {wizard.step === SCHEDULE_STEP && (
          <div className="space-y-8">
            <BookingScheduleStep
              form={form}
              locale={locale}
              bookableDates={bookableDates}
              serviceLines={bookingServiceLines}
              staffPickerLegend={staffPickerLegend}
              labels={{
                chooseServiceFirst: b.chooseServiceFirst,
                day: b.day,
                selectDay: b.selectDay,
                prevMonth: b.prevMonth,
                nextMonth: b.nextMonth,
                hour: b.hour,
                loadingSlots: b.loadingSlots,
                noSlots: b.noSlots,
                changeDay: b.changeDay,
                changeTime: b.changeTime,
                staff: b.staff,
                loadingStaff: b.loadingStaff,
                noStaffAtSlot: b.noStaffAtSlot,
                chainAssignedHeading: b.chainAssignedHeading,
                chainNeedsTimeChange: b.chainNeedsTimeChange,
                chainConflictIntro: b.chainConflictIntro,
                chainPostponeHeading: b.chainPostponeHeading,
                chainPostponeHint: b.chainPostponeHint,
              }}
              onTimeSelected={wizard.handleTimeSelected}
              onStaffSelected={(staffId) => void wizard.handleStaffSelected(staffId)}
              onChangeDay={handleChangeDay}
              onChangeTime={handleChangeTime}
            />
          </div>
        )}

        {wizard.step === CONFIRM_STEP && (
          <BookingConfirmStep
            form={form}
            locale={locale}
            stepTitle={bookingSteps[CONFIRM_STEP]}
            labels={{
              fullName: b.fullName,
              phone: b.phone,
              emailOptional: b.emailOptional,
              notesOptional: b.notesOptional,
              notesPlaceholder: b.notesPlaceholder,
            }}
          />
        )}
      </div>

      {form.error && (
        <p className="mt-6 text-center text-sm text-red-700" role="alert">
          {form.error}
        </p>
      )}

      {wizard.step === bookingSteps.length - 1 && (
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
