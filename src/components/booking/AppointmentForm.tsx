import { useCallback, useMemo, useState } from 'react'
import { BookingCategoryStep } from '@/components/booking/BookingCategoryStep'
import { BookingConfirmStep } from '@/components/booking/BookingConfirmStep'
import { BookingForeignLocaleStep } from '@/components/booking/BookingForeignLocaleStep'
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
import { shouldAskForeignPhoneLocale } from '@/hooks/useForeignPhoneLocalePrompt'
import { serviceDisplayName } from '@/i18n/helpers'
import { useTranslation } from '@/i18n/useTranslation'
import { normalizeLocale, type Locale } from '@/i18n/types'
import { getBookableDates } from '@/lib/core/dates'
import type { Appointment } from '@/types/booking'

const bookableDatesList = getBookableDates(35)

type LocalePrompt = 'foreign-phone' | 'saved-mismatch'

type AppointmentFormProps = AppointmentFormOptions & {
  submitLabel?: string
  onConfirmed?: (
    appointment: Appointment,
    appointments?: Appointment[],
    manageUrl?: string | null,
  ) => void
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
  const [localePrompt, setLocalePrompt] = useState<LocalePrompt | null>(null)

  const form = useAppointmentForm({
    ...formOptions,
    onSuccess: (apt, appointments, manageUrl) => {
      onSuccess?.(apt, appointments, manageUrl)
      onConfirmed?.(apt, appointments, manageUrl)
    },
  })

  const wizard = useBookingWizardSteps(form)

  const needsSavedLocaleMismatch = useCallback(
    (pendingLocale: Locale) =>
      form.customerType === 'returning' &&
      form.returningVerified &&
      form.returningLocale != null &&
      form.returningLocale !== normalizeLocale(pendingLocale),
    [form.customerType, form.returningVerified, form.returningLocale],
  )

  const submitKeepingOrUpdating = useCallback(
    async (pendingLocale: Locale) => {
      if (needsSavedLocaleMismatch(pendingLocale)) {
        form.setNotificationLocale(pendingLocale)
        setLocalePrompt('saved-mismatch')
        return
      }
      setLocalePrompt(null)
      await form.submit({ locale: pendingLocale })
    },
    [form.setNotificationLocale, form.submit, needsSavedLocaleMismatch],
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.canSubmit || form.submitting) return
    // Web en inglés → avisos ya van en inglés; no preguntar por número extranjero.
    if (
      locale !== 'en' &&
      localePrompt !== 'foreign-phone' &&
      shouldAskForeignPhoneLocale(form.customerPhone, form.notificationLocale)
    ) {
      setLocalePrompt('foreign-phone')
      return
    }
    await submitKeepingOrUpdating(form.notificationLocale)
  }

  const finishForeignPhone = useCallback(
    async (nextLocale: Locale) => {
      await submitKeepingOrUpdating(nextLocale)
    },
    [submitKeepingOrUpdating],
  )

  const finishSavedLocaleMismatch = useCallback(
    async (accept: boolean) => {
      const webLocale = form.notificationLocale
      const saved = form.returningLocale ?? 'es'
      if (accept) {
        await form.submit({ locale: webLocale, updateCustomerLocale: true })
      } else {
        await form.submit({ locale: saved, updateCustomerLocale: false })
      }
      setLocalePrompt(null)
    },
    [form.notificationLocale, form.returningLocale, form.submit],
  )

  const handleBack = useCallback(() => {
    if (localePrompt) {
      setLocalePrompt(null)
      return
    }
    wizard.goPrev()
  }, [localePrompt, wizard.goPrev])

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
  const progressStep = localePrompt ? CONFIRM_STEP : wizard.step
  const progressLabels = localePrompt
    ? bookingSteps.map((label, index) =>
        index === CONFIRM_STEP
          ? localePrompt === 'foreign-phone'
            ? b.foreignPhoneLocaleTitle
            : b.savedLocaleMismatchTitle
          : label,
      )
    : bookingSteps

  const mismatchTarget = form.notificationLocale === 'en' ? 'en' : 'es'

  return (
    <form onSubmit={handleSubmit} className="relative mx-auto max-w-lg md:max-w-4xl">
      <BookingFormProgress
        step={progressStep}
        stepLabels={progressLabels}
        progressLabel={b.stepProgress(progressStep + 1, bookingSteps.length)}
        backLabel={b.prevStep}
        onBack={handleBack}
      />

      <div key={localePrompt ?? wizard.step} className="booking-step-enter">
        {localePrompt === 'foreign-phone' ? (
          <BookingForeignLocaleStep
            title={b.foreignPhoneLocaleTitle}
            message={b.foreignPhoneLocaleMessage}
            acceptLabel={b.foreignPhoneLocaleAccept}
            declineLabel={b.foreignPhoneLocaleDecline}
            busy={form.submitting}
            onAccept={() => void finishForeignPhone('en')}
            onDecline={() => void finishForeignPhone('es')}
          />
        ) : localePrompt === 'saved-mismatch' ? (
          <BookingForeignLocaleStep
            title={b.savedLocaleMismatchTitle}
            message={
              mismatchTarget === 'en' ? b.savedLocaleMismatchToEn : b.savedLocaleMismatchToEs
            }
            acceptLabel={b.savedLocaleMismatchAccept}
            declineLabel={b.savedLocaleMismatchDecline}
            busy={form.submitting}
            onAccept={() => void finishSavedLocaleMismatch(true)}
            onDecline={() => void finishSavedLocaleMismatch(false)}
          />
        ) : (
          <>
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
                  sameServiceHint: b.sameServiceHint,
                }}
                selectedServices={form.selectedServices}
                onRemoveServiceAt={form.removeServiceAt}
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
                  birthdate: b.birthdate,
                  notesOptional: b.notesOptional,
                  notesPlaceholder: b.notesPlaceholder,
                  returningCustomerQuestion: b.returningCustomerQuestion,
                  returningCustomerYes: b.returningCustomerYes,
                  returningCustomerNo: b.returningCustomerNo,
                  returningLookupHint: b.returningLookupHint,
                  returningGreeting: b.returningGreeting,
                  returningForSomeoneElseHint: b.returningForSomeoneElseHint,
                  returningNotFound: b.returningNotFound,
                  lookupCustomer: b.lookupCustomer,
                  lookingUpCustomer: b.lookingUpCustomer,
                  changeCustomerType: b.changeCustomerType,
                }}
              />
            )}
          </>
        )}
      </div>

      {form.error && (
        <p className="mt-6 text-center text-sm text-red-700" role="alert">
          {form.error}
        </p>
      )}

      {!localePrompt &&
        wizard.step === bookingSteps.length - 1 &&
        form.customerType != null &&
        !(form.customerType === 'returning' && !form.returningVerified) && (
          <Button
            type="submit"
            variant="solid"
            size="lg"
            className="mt-10 w-full"
            disabled={form.submitting || !form.canSubmit}
          >
            {form.submitting ? b.saving : confirmLabel}
          </Button>
        )}
    </form>
  )
}
