import { useEffect, useMemo, useState } from 'react'
import {
  categoryIdForService,
  categoryLabelFor,
  countServicesInCategory,
  getAllServiceCategories,
  servicePickerLabels,
  servicesInCategory,
} from '@/lib/servicePicker'
import { usesColorSplitBooking } from '@/lib/bookingOccupancy'
import type { BookableService } from '@/types/booking'
import { typography } from '@/styles/typography'

type Props = {
  services: BookableService[]
  serviceId: string
  onServiceChange: (serviceId: string) => void
  loading?: boolean
  error?: string
  onRetry?: () => void
  visibleSection?: 'category' | 'service' | 'both'
  categoryId?: string
  onCategoryChange?: (categoryId: string) => void
  onCategorySelected?: (categoryId: string) => void
  onServiceSelected?: (serviceId: string) => void
}

export function ServiceCategoryPickerPublic({
  services,
  serviceId,
  onServiceChange,
  loading = false,
  error = '',
  onRetry,
  visibleSection = 'both',
  categoryId: controlledCategoryId,
  onCategoryChange,
  onCategorySelected,
  onServiceSelected,
}: Props) {
  const labels = servicePickerLabels.public

  const categories = useMemo(() => getAllServiceCategories(), [])

  const categoryFromService = categoryIdForService(services, serviceId)
  const [pickedCategoryId, setPickedCategoryId] = useState('')

  useEffect(() => {
    if (categoryFromService) {
      setPickedCategoryId(categoryFromService)
      onCategoryChange?.(categoryFromService)
    }
  }, [categoryFromService, onCategoryChange])

  const selectedCategoryId =
    controlledCategoryId || pickedCategoryId || categoryFromService

  const showCategory = visibleSection === 'category' || visibleSection === 'both'
  const showService = visibleSection === 'service' || visibleSection === 'both'

  const categoryServices = useMemo(
    () => (selectedCategoryId ? servicesInCategory(services, selectedCategoryId) : []),
    [services, selectedCategoryId],
  )

  function handleCategoryPick(categoryId: string) {
    setPickedCategoryId(categoryId)
    onCategoryChange?.(categoryId)
    const inCategory = servicesInCategory(services, categoryId)
    if (inCategory.length === 1) {
      onServiceChange(inCategory[0].id)
    } else {
      onServiceChange('')
    }
    onCategorySelected?.(categoryId)
  }

  if (loading) {
    return <p className={`${typography.caption} text-center`}>{labels.loading}</p>
  }

  if (services.length === 0) {
    return (
      <div className="space-y-3 text-center">
        <p
          className={`text-sm ${error ? 'text-amber-950' : 'text-charcoal-muted'}`}
          role={error ? 'alert' : undefined}
        >
          {error ||
            'No hay tratamientos disponibles. Llámanos al 952 44 36 86.'}
        </p>
        {onRetry && error && (
          <button
            type="button"
            onClick={onRetry}
            className="border border-gold/40 px-4 py-2 text-sm text-gold hover:border-gold"
          >
            Reintentar
          </button>
        )}
      </div>
    )
  }

  return (
    <div className={visibleSection === 'both' ? 'space-y-8' : undefined}>
      {showCategory && (
      <fieldset className="space-y-3">
        <legend className={`${typography.label} mb-2 block w-full text-center md:hidden`}>
          {labels.category}
        </legend>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {categories.map((cat) => {
            const selected = selectedCategoryId === cat.id
            const count = countServicesInCategory(services, cat.id)
            const countLabel =
              count === 0
                ? 'Solo teléfono / WhatsApp'
                : count === 1
                  ? '1 tratamiento'
                  : `${count} tratamientos`
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => handleCategoryPick(cat.id)}
                className={[
                  'cursor-pointer border px-2 py-2.5 text-left text-sm transition-colors md:px-2 md:py-3 md:text-center',
                  selected
                    ? 'border-gold bg-gold/10 text-gold'
                    : 'border-gold/20 hover:border-gold/40',
                ].join(' ')}
              >
                <span className="block font-medium leading-snug">{categoryLabelFor(cat.id)}</span>
                <span
                  className={[
                    'mt-1 block font-normal leading-tight',
                    count === 0
                      ? 'text-[9px] tracking-tight'
                      : 'whitespace-nowrap text-[10px] tracking-normal',
                    selected ? 'text-gold/80' : 'text-charcoal-muted',
                    'md:text-[11px] md:uppercase md:tracking-wide',
                  ].join(' ')}
                >
                  {countLabel}
                </span>
              </button>
            )
          })}
        </div>
      </fieldset>
      )}

      {showService && selectedCategoryId && (
        <fieldset className="space-y-3">
          <legend className={`${typography.label} mb-2 block w-full text-center md:hidden`}>
            {labels.service}
          </legend>
          {categoryServices.length === 0 ? (
            <p className={`${typography.caption} text-center`}>{labels.emptyCategory}</p>
          ) : (
            <div className="grid gap-2 md:grid-cols-3 md:gap-3">
              {categoryServices.map((service) => (
                <label
                  key={service.id}
                  className={`flex h-full min-w-0 cursor-pointer items-start gap-2 border p-3 transition-colors md:p-3 ${
                    serviceId === service.id
                      ? 'border-gold bg-gold/5'
                      : 'border-gold/20 hover:border-gold/40'
                  }`}
                >
                  <input
                    type="radio"
                    name="service"
                    value={service.id}
                    checked={serviceId === service.id}
                    onChange={() => {
                      onServiceChange(service.id)
                      onServiceSelected?.(service.id)
                    }}
                    className="mt-0.5 shrink-0 accent-gold"
                  />
                  <span className="min-w-0 flex-1 text-left">
                    <span className="block text-sm font-medium leading-snug text-gold md:text-xs md:leading-tight">
                      {service.nameEs}
                    </span>
                    <span className="mt-1 block text-xs font-normal normal-case leading-snug text-charcoal-muted md:text-[11px]">
                      {usesColorSplitBooking(service.id)
                        ? '90 min (color + pausa + lavado)'
                        : `${service.durationMinutes} min`}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          )}
        </fieldset>
      )}
    </div>
  )
}
