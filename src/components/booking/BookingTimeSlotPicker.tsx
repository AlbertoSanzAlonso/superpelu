import { formatChainedAppointmentTimeRange } from '@/lib/bookingCombo'
import { formatAppointmentTimeRange } from '@/lib/bookingOccupancy'
import type { Locale } from '@/i18n/types'
import { typography } from '@/styles/typography'

type ServiceLine = {
  id: string
  durationMinutes: number
}

type BookingTimeSlotPickerProps = {
  locale: Locale
  slots: string[]
  loading: boolean
  error: string
  serviceLines: ServiceLine[]
  labels: {
    hour: string
    loadingSlots: string
    noSlots: string
  }
  onSelect: (slot: string) => void
}

export function BookingTimeSlotPicker({
  locale,
  slots,
  loading,
  error,
  serviceLines,
  labels,
  onSelect,
}: BookingTimeSlotPickerProps) {
  return (
    <fieldset className="space-y-3">
      <legend className={`${typography.label} mb-2 block w-full text-center md:hidden`}>
        {labels.hour}
      </legend>
      {loading ? (
        <p className={`${typography.caption} text-center`}>{labels.loadingSlots}</p>
      ) : slots.length === 0 ? (
        <p
          className="rounded border border-amber-300/60 bg-amber-50 px-4 py-3 text-center text-sm text-amber-950"
          role="status"
        >
          {error || labels.noSlots}
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {slots.map((slot) => (
            <label
              key={slot}
              className="cursor-pointer border border-gold/20 py-2 text-center text-sm transition-colors hover:border-gold/50"
            >
              <input
                type="radio"
                name="time"
                value={slot}
                onChange={() => onSelect(slot)}
                className="sr-only"
              />
              {slot}
              {serviceLines.length > 0 && (
                <span className="mt-0.5 block text-[10px] leading-tight text-charcoal-muted">
                  {serviceLines.length === 1
                    ? formatAppointmentTimeRange(
                        serviceLines[0].id,
                        slot,
                        serviceLines[0].durationMinutes,
                        locale,
                      )
                    : formatChainedAppointmentTimeRange(serviceLines, slot, locale)}
                </span>
              )}
            </label>
          ))}
        </div>
      )}
    </fieldset>
  )
}
