import { BookingDayPicker } from '@/components/booking/BookingDayPicker'
import { BookingStaffPicker } from '@/components/booking/BookingStaffPicker'
import { BookingTimeSlotPicker } from '@/components/booking/BookingTimeSlotPicker'
import type { AppointmentFormApi } from '@/hooks/useAppointmentForm'
import type { Locale } from '@/i18n/types'
import { formatDisplayDate } from '@/lib/dates'
import { typography } from '@/styles/typography'

type BookingScheduleStepProps = {
  form: AppointmentFormApi
  locale: Locale
  bookableDates: Set<string>
  serviceLines: { id: string; durationMinutes: number }[]
  staffPickerLegend: string
  labels: {
    chooseServiceFirst: string
    day: string
    selectDay: string
    prevMonth: string
    nextMonth: string
    hour: string
    loadingSlots: string
    noSlots: string
    changeDay: string
    changeTime: string
    staff: string
    loadingStaff: string
    noStaffAtSlot: string
    chainStaffBusyAtTime: string
    chainAssignedHeading: string
    chainNeedsTimeChange: string
    chainConflictIntro: string
    chainPostponeHeading: (serviceName: string, idealStartTime: string) => string
    chainPostponeHint: string
  }
  onTimeSelected: (slot: string) => void
  onStaffSelected: (staffId: string) => void
  onChangeDay: () => void
  onChangeTime: () => void
}

export function BookingScheduleStep({
  form,
  locale,
  bookableDates,
  serviceLines,
  staffPickerLegend,
  labels,
  onTimeSelected,
  onStaffSelected,
  onChangeDay,
  onChangeTime,
}: BookingScheduleStepProps) {
  const staffPickerOptions =
    form.hasMultipleServices && form.chainNextIndex != null
      ? form.chainNextStaff
      : form.staffAtSlot

  if (form.serviceIds.length === 0) {
    return <p className={`${typography.caption} text-center`}>{labels.chooseServiceFirst}</p>
  }

  if (!form.date) {
    return (
      <BookingDayPicker
        locale={locale}
        bookableDates={bookableDates}
        selectedDate={form.date}
        onSelect={form.setDate}
        labels={{
          day: labels.day,
          selectDay: labels.selectDay,
          prevMonth: labels.prevMonth,
          nextMonth: labels.nextMonth,
        }}
      />
    )
  }

  if (!form.startTime) {
    return (
      <>
        <div className="space-y-2 text-center">
          <p className="font-sans text-sm capitalize text-charcoal">
            {formatDisplayDate(form.date, locale)}
          </p>
          <button
            type="button"
            onClick={onChangeDay}
            className={`${typography.caption} cursor-pointer text-gold underline-offset-2 hover:underline`}
          >
            {labels.changeDay}
          </button>
        </div>
        <BookingTimeSlotPicker
          locale={locale}
          slots={form.slots}
          loading={form.loadingSlots}
          error={form.slotsError}
          serviceLines={serviceLines}
          labels={{
            hour: labels.hour,
            loadingSlots: labels.loadingSlots,
            noSlots: labels.noSlots,
          }}
          onSelect={onTimeSelected}
        />
      </>
    )
  }

  return (
    <>
      <div className="space-y-2 text-center">
        <p className="font-sans text-sm capitalize text-charcoal">
          {formatDisplayDate(form.date, locale)} · {form.startTime}
        </p>
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-1">
          <button
            type="button"
            onClick={onChangeDay}
            className={`${typography.caption} cursor-pointer text-gold underline-offset-2 hover:underline`}
          >
            {labels.changeDay}
          </button>
          <button
            type="button"
            onClick={onChangeTime}
            className={`${typography.caption} cursor-pointer text-gold underline-offset-2 hover:underline`}
          >
            {labels.changeTime}
          </button>
        </div>
      </div>

      <BookingStaffPicker
        locale={locale}
        selectedServices={form.selectedServices}
        staffOptions={staffPickerOptions}
        chainSegments={form.chainSegments}
        chainNextIndex={form.chainNextIndex}
        chainAvailableStaffIds={form.chainAvailableStaffIds}
        chainNeedsTimeChange={form.chainNeedsTimeChange}
        chainPostpone={form.chainPostpone}
        chainConflict={form.chainConflict}
        loading={form.loadingStaffAtSlot || form.loadingChain}
        error={form.staffAtSlotError}
        legend={staffPickerLegend}
        labels={{
          staff: labels.staff,
          loadingStaff: labels.loadingStaff,
          noStaffAtSlot: labels.noStaffAtSlot,
          chainStaffBusyAtTime: labels.chainStaffBusyAtTime,
          chainAssignedHeading: labels.chainAssignedHeading,
          chainNeedsTimeChange: labels.chainNeedsTimeChange,
          chainConflictIntro: labels.chainConflictIntro,
          chainPostponeHeading: labels.chainPostponeHeading,
          chainPostponeHint: labels.chainPostponeHint,
        }}
        onSelectStaff={onStaffSelected}
        onPickPostponeSlot={(serviceIndex, slot) =>
          void form.pickPostponeSlot(serviceIndex, slot)
        }
      />
    </>
  )
}
