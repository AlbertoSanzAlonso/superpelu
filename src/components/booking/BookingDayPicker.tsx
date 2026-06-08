import { BookingMonthCalendar } from '@/components/booking/BookingMonthCalendar'
import type { Locale } from '@/i18n/types'
import { typography } from '@/styles/typography'

type BookingDayPickerProps = {
  locale: Locale
  bookableDates: Set<string>
  selectedDate: string
  onSelect: (date: string) => void
  labels: {
    day: string
    selectDay: string
    prevMonth: string
    nextMonth: string
  }
}

export function BookingDayPicker({
  locale,
  bookableDates,
  selectedDate,
  onSelect,
  labels,
}: BookingDayPickerProps) {
  return (
    <div>
      <p className={`${typography.label} mb-4 block w-full text-center md:hidden`}>{labels.day}</p>
      <BookingMonthCalendar
        bookableDates={bookableDates}
        locale={locale}
        selectedDate={selectedDate}
        onSelect={onSelect}
        prevMonthLabel={labels.prevMonth}
        nextMonthLabel={labels.nextMonth}
      />
      <p className={`${typography.caption} mt-3 text-center`}>{labels.selectDay}</p>
    </div>
  )
}
