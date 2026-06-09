import { useEffect, useMemo, useState } from 'react'
import {
  categoryIdForService,
  categoryLabelFor,
  getOrderedCategoriesForServices,
  servicePickerLabels,
  servicesInCategory,
  type ServicePickerVariant,
} from '@/lib/catalog/servicePicker'
import type { BookableService } from '@/types/booking'
import { typography } from '@/styles/typography'

const selectClass =
  'w-full cursor-pointer border border-gold/30 bg-cream px-3 py-2 text-sm outline-none focus:border-gold disabled:cursor-not-allowed disabled:opacity-50'

const selectClassCompact = `${selectClass} py-1.5`

type Props = {
  services: BookableService[]
  serviceId: string
  onServiceChange: (serviceId: string) => void
  variant?: ServicePickerVariant
  disabled?: boolean
  loading?: boolean
  className?: string
  compact?: boolean
}

export function ServiceCategoryPicker({
  services,
  serviceId,
  onServiceChange,
  variant = 'staff',
  disabled = false,
  loading = false,
  className = '',
  compact = false,
}: Props) {
  const labels = servicePickerLabels[variant]

  const categories = useMemo(() => getOrderedCategoriesForServices(services), [services])

  const categoryFromService = categoryIdForService(services, serviceId)
  const [pickedCategoryId, setPickedCategoryId] = useState('')

  useEffect(() => {
    if (categoryFromService) {
      setPickedCategoryId(categoryFromService)
    }
  }, [categoryFromService])

  const selectedCategoryId = pickedCategoryId || categoryFromService

  const categoryServices = useMemo(
    () =>
      selectedCategoryId ? servicesInCategory(services, selectedCategoryId) : [],
    [services, selectedCategoryId],
  )

  const isDisabled = disabled || loading || services.length === 0

  function handleCategoryChange(categoryId: string) {
    setPickedCategoryId(categoryId)
    const inCategory = servicesInCategory(services, categoryId)
    if (inCategory.length === 1) {
      onServiceChange(inCategory[0].id)
    } else {
      onServiceChange('')
    }
  }

  const selectCn = compact ? selectClassCompact : selectClass
  const labelCn = compact ? `${typography.label} mb-0.5 block text-xs` : `${typography.label} mb-1 block`

  return (
    <div className={`${compact ? 'space-y-2' : 'space-y-3'} ${className}`}>
      {!compact && (
        <p className={`${typography.caption} text-charcoal-muted`}>{labels.serviceHint}</p>
      )}
      <div className={`grid gap-3 ${compact ? 'grid-cols-2' : 'gap-4 sm:grid-cols-2'}`}>
        <div>
          <label className={labelCn}>{labels.category}</label>
          <select
            value={selectedCategoryId}
            onChange={(e) => handleCategoryChange(e.target.value)}
            className={selectCn}
            disabled={isDisabled || categories.length === 0}
          >
            {loading ? (
              <option value="">{labels.loading}</option>
            ) : categories.length === 0 ? (
              <option value="">{labels.loading}</option>
            ) : (
              <>
                <option value="">{labels.categoryPlaceholder}</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {categoryLabelFor(cat.id)}
                  </option>
                ))}
              </>
            )}
          </select>
        </div>
        <div>
          <label className={labelCn}>{labels.service}</label>
          <select
            required
            value={serviceId}
            onChange={(e) => onServiceChange(e.target.value)}
            className={selectCn}
            disabled={isDisabled || categoryServices.length === 0}
          >
            {categoryServices.length === 0 ? (
              <option value="">{labels.emptyCategory}</option>
            ) : (
              <>
                <option value="">{labels.servicePlaceholder}</option>
                {categoryServices.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nameEs}
                    {variant === 'staff' ? ` · ${s.durationMinutes} min` : ''}
                  </option>
                ))}
              </>
            )}
          </select>
        </div>
      </div>
    </div>
  )
}
