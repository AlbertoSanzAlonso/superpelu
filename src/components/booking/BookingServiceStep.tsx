import { Button } from '@/components/ui/Button'
import { ServiceCategoryPickerPublic } from '@/components/shared/ServiceCategoryPickerPublic'
import { serviceDisplayName } from '@/i18n/helpers'
import type { Locale } from '@/i18n/types'
import type { BookableService } from '@/types/booking'
import { typography } from '@/styles/typography'

type BookingServiceStepProps = {
  locale: Locale
  labels: {
    selectedServices: string
    removeService: string
    addAnotherService: string
    continueWithServices: string
  }
  services: BookableService[]
  serviceIds: string[]
  selectedServices: BookableService[]
  loading: boolean
  error: string
  onRetry: () => void
  onToggleService: (serviceId: string) => void
  onRemoveService: (serviceId: string) => void
  categoryId: string
  onCategoryChange: (categoryId: string) => void
  onBackToCategories: () => void
  onContinue: () => void
}

export function BookingServiceStep({
  locale,
  labels,
  selectedServices,
  onRemoveService,
  onBackToCategories,
  onContinue,
  ...pickerProps
}: BookingServiceStepProps) {
  return (
    <div className="space-y-6">
      <ServiceCategoryPickerPublic {...pickerProps} multiSelect visibleSection="service" />
      {selectedServices.length > 0 && (
        <div className="space-y-3">
          <p className={`${typography.label} text-center`}>{labels.selectedServices}</p>
          <ul className="space-y-2">
            {selectedServices.map((service) => (
              <li
                key={service.id}
                className="flex items-center justify-between gap-3 border border-gold/25 bg-cream/40 px-3 py-2 text-sm"
              >
                <span className="text-left text-gold">{serviceDisplayName(service, locale)}</span>
                <button
                  type="button"
                  onClick={() => onRemoveService(service.id)}
                  className={`${typography.caption} shrink-0 cursor-pointer text-charcoal-muted underline-offset-2 hover:underline`}
                >
                  {labels.removeService}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Button type="button" variant="outline" size="md" onClick={onBackToCategories}>
          {labels.addAnotherService}
        </Button>
        <Button
          type="button"
          variant="solid"
          size="md"
          disabled={pickerProps.serviceIds.length === 0}
          onClick={onContinue}
        >
          {labels.continueWithServices}
        </Button>
      </div>
    </div>
  )
}
