import { ServiceCategoryPickerPublic } from '@/components/shared/ServiceCategoryPickerPublic'
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
}

export function BookingCategoryStep({
  onCategorySelected,
  ...pickerProps
}: BookingCategoryStepProps) {
  return (
    <ServiceCategoryPickerPublic
      {...pickerProps}
      multiSelect
      visibleSection="category"
      onCategorySelected={onCategorySelected}
    />
  )
}
