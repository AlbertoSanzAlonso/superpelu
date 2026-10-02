import { ServiceCategoryPickerPublic } from '@/components/shared/ServiceCategoryPickerPublic'
import { ServiceSearchAutocomplete } from '@/components/booking/ServiceSearchAutocomplete'
import type { BookableService } from '@/types/booking'

type BookingCategoryStepProps = {
  services: BookableService[]
  serviceIds: string[]
  loading: boolean
  error: string
  onRetry: () => void
  onToggleService: (serviceId: string) => void
  categoryId: string
  onCategoryChange: (categoryId: string) => void
  onCategorySelected: (categoryId: string) => void
  onServicePickedFromSearch: (service: BookableService) => void
}

export function BookingCategoryStep({
  onCategorySelected,
  onServicePickedFromSearch,
  loading,
  services,
  ...pickerProps
}: BookingCategoryStepProps) {
  return (
    <div>
      <ServiceSearchAutocomplete
        services={services}
        disabled={loading}
        onPick={onServicePickedFromSearch}
      />
      <ServiceCategoryPickerPublic
        {...pickerProps}
        services={services}
        loading={loading}
        multiSelect
        visibleSection="category"
        onCategorySelected={onCategorySelected}
      />
    </div>
  )
}
