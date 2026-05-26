import { useEffect, useMemo, useState } from 'react'
import {
  categoryIdForService,
  categoryLabelFor,
  getOrderedCategoriesForServices,
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
}

export function ServiceCategoryPickerPublic({
  services,
  serviceId,
  onServiceChange,
  loading = false,
}: Props) {
  const labels = servicePickerLabels.public

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
    () => (selectedCategoryId ? servicesInCategory(services, selectedCategoryId) : []),
    [services, selectedCategoryId],
  )

  function handleCategoryPick(categoryId: string) {
    setPickedCategoryId(categoryId)
    const inCategory = servicesInCategory(services, categoryId)
    if (inCategory.length === 1) {
      onServiceChange(inCategory[0].id)
    } else {
      onServiceChange('')
    }
  }

  if (loading) {
    return <p className={`${typography.caption} text-center`}>{labels.loading}</p>
  }

  if (services.length === 0) {
    return (
      <p className={`${typography.caption} text-center`}>
        No hay tratamientos disponibles online. Llámanos al 952 44 36 86.
      </p>
    )
  }

  return (
    <div className="space-y-8">
      <fieldset className="space-y-3">
        <legend className={`${typography.label} mb-2 block w-full text-center`}>
          {labels.category}
        </legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {categories.map((cat) => {
            const selected = selectedCategoryId === cat.id
            const count = servicesInCategory(services, cat.id).length
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => handleCategoryPick(cat.id)}
                className={[
                  'border px-4 py-3 text-left text-sm transition-colors',
                  selected
                    ? 'border-gold bg-gold/10 text-gold'
                    : 'border-gold/20 hover:border-gold/45',
                ].join(' ')}
              >
                <span className="block font-medium">{categoryLabelFor(cat.id)}</span>
                <span className={`${typography.caption} mt-0.5 block`}>
                  {count === 1 ? '1 tratamiento' : `${count} tratamientos`}
                </span>
              </button>
            )
          })}
        </div>
      </fieldset>

      {selectedCategoryId && (
        <fieldset className="space-y-3">
          <legend className={`${typography.label} mb-2 block w-full text-center`}>
            {labels.service}
          </legend>
          {categoryServices.length === 0 ? (
            <p className={`${typography.caption} text-center`}>{labels.emptyCategory}</p>
          ) : (
            <div className="grid gap-3">
              {categoryServices.map((service) => (
                <label
                  key={service.id}
                  className={`flex cursor-pointer items-start gap-3 border p-4 transition-colors ${
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
                    onChange={() => onServiceChange(service.id)}
                    className="mt-1 accent-gold"
                  />
                  <span className="text-left">
                    <span className={`${typography.h3} block text-gold`}>{service.nameEs}</span>
                    <span className={typography.caption}>
                      {usesColorSplitBooking(service.id)
                        ? '90 min (30 color + pausa + 30 lavado)'
                        : `${service.durationMinutes} min`}
                      {service.nameEn ? ` · ${service.nameEn}` : ''}
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
