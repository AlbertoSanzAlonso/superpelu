import { serviceDisplayName } from '@/i18n/helpers'
import type { Locale } from '@/i18n/types'
import type {
  BookableService,
  BookingChainSegmentPlan,
  StaffMember,
} from '@/types/booking'
import { typography } from '@/styles/typography'

type BookingStaffPickerProps = {
  locale: Locale
  selectedServices: BookableService[]
  staffOptions: StaffMember[]
  chainSegments: BookingChainSegmentPlan[]
  chainNextIndex: number | null
  chainAvailableStaffIds: string[]
  chainNeedsTimeChange: boolean
  chainPostpone: {
    serviceIndex: number
    idealStartTime: string
    slots: string[]
  } | null
  chainConflict: boolean
  loading: boolean
  error: string
  legend: string
  labels: {
    staff: string
    loadingStaff: string
    noStaffAtSlot: string
    chainAssignedHeading: string
    chainNeedsTimeChange: string
    chainConflictIntro: string
    chainPostponeHeading: (serviceName: string, idealStartTime: string) => string
    chainPostponeHint: string
  }
  onSelectStaff: (staffId: string) => void
  onPickPostponeSlot: (serviceIndex: number, slot: string) => void
}

export function BookingStaffPicker({
  locale,
  selectedServices,
  staffOptions,
  chainSegments,
  chainNextIndex,
  chainAvailableStaffIds,
  chainNeedsTimeChange,
  chainPostpone,
  chainConflict,
  loading,
  error,
  legend,
  labels,
  onSelectStaff,
  onPickPostponeSlot,
}: BookingStaffPickerProps) {
  // En tratamientos siguientes solo listamos profesionales libres a esa hora.
  const visibleStaff =
    chainNextIndex != null && chainAvailableStaffIds.length > 0
      ? staffOptions.filter((member) => chainAvailableStaffIds.includes(member.id))
      : chainNextIndex != null
        ? []
        : staffOptions

  const showTimePicker = Boolean(chainPostpone && chainPostpone.slots.length > 0)
  const selectedTime = chainPostpone?.idealStartTime

  return (
    <>
      {chainSegments.length > 0 && (
        <div className="space-y-2 rounded border border-gold/20 bg-cream/40 px-4 py-3 text-sm">
          <p className={`${typography.label} text-center`}>{labels.chainAssignedHeading}</p>
          <ul className="space-y-1">
            {chainSegments.map((segment) => {
              const service = selectedServices[segment.serviceIndex]
              return (
                <li key={segment.serviceIndex} className="text-center text-charcoal">
                  {service ? serviceDisplayName(service, locale) : segment.serviceId} ·{' '}
                  {segment.startTime} · {segment.staffName}
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {chainNeedsTimeChange && (
        <p
          className="rounded border border-amber-300/60 bg-amber-50 px-4 py-3 text-center text-sm text-amber-950"
          role="status"
        >
          {labels.chainNeedsTimeChange}
        </p>
      )}

      {chainConflict && !showTimePicker && (
        <p
          className="rounded border border-amber-300/60 bg-amber-50 px-4 py-3 text-center text-sm text-amber-950"
          role="status"
        >
          {labels.chainConflictIntro}
        </p>
      )}

      {showTimePicker && chainPostpone && (
        <fieldset className="space-y-3">
          <legend className={`${typography.label} mb-2 block w-full text-center`}>
            {labels.chainPostponeHeading(
              serviceDisplayName(selectedServices[chainPostpone.serviceIndex]!, locale),
              chainPostpone.idealStartTime,
            )}
          </legend>
          <p className={`${typography.caption} text-center`}>{labels.chainPostponeHint}</p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {chainPostpone.slots.map((slot) => {
              const isSelected = slot === selectedTime
              return (
                <button
                  key={slot}
                  type="button"
                  onClick={() => onPickPostponeSlot(chainPostpone.serviceIndex, slot)}
                  className={`cursor-pointer border py-2 text-center text-sm transition-colors ${
                    isSelected
                      ? 'border-gold bg-gold/10 text-charcoal'
                      : 'border-gold/20 hover:border-gold/50'
                  }`}
                >
                  {slot}
                </button>
              )
            })}
          </div>
        </fieldset>
      )}

      {(visibleStaff.length > 0 || loading || (!showTimePicker && !chainNeedsTimeChange)) && (
        <fieldset className="space-y-3">
          <legend className={`${typography.label} mb-2 block w-full text-center md:hidden`}>
            {labels.staff}
          </legend>
          {loading ? (
            <p className={`${typography.caption} text-center`}>{labels.loadingStaff}</p>
          ) : visibleStaff.length === 0 ? (
            !showTimePicker ? (
              <p
                className="rounded border border-amber-300/60 bg-amber-50 px-4 py-3 text-center text-sm text-amber-950"
                role="status"
              >
                {error || labels.noStaffAtSlot}
              </p>
            ) : (
              <p className={`${typography.caption} text-center`}>
                {error || labels.noStaffAtSlot}
              </p>
            )
          ) : (
            <>
              <p className={`${typography.caption} text-center`}>{legend}</p>
              <div className="grid gap-3">
                {visibleStaff.map((member) => (
                  <label
                    key={member.id}
                    className="flex cursor-pointer items-start gap-3 border border-gold/20 p-4 transition-colors hover:border-gold/40"
                  >
                    <input
                      type="radio"
                      name={`staff-${chainNextIndex ?? 0}`}
                      value={member.id}
                      onChange={() => onSelectStaff(member.id)}
                      className="mt-1 accent-gold"
                    />
                    <span className="text-left">
                      <span className={`${typography.h3} block text-gold`}>{member.name}</span>
                      {member.role && (
                        <span className={`${typography.caption} block`}>{member.role}</span>
                      )}
                    </span>
                  </label>
                ))}
              </div>
            </>
          )}
        </fieldset>
      )}
    </>
  )
}
