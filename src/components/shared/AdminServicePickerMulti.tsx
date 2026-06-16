import { useMemo } from 'react'
import {
  categoryLabelForLocale,
  serviceDisplayName,
} from '@/i18n/helpers'
import { useTranslation } from '@/i18n/useTranslation'
import {
  getAllServiceCategories,
  servicesInCategory,
} from '@/lib/catalog/servicePicker'
import type { BookableService } from '@/types/booking'
import { typography } from '@/styles/typography'

type Props = {
  services: BookableService[]
  serviceIds: string[]
  onToggleService: (serviceId: string) => void
  loading?: boolean
}

export function AdminServicePickerMulti({
  services,
  serviceIds,
  onToggleService,
  loading = false,
}: Props) {
  const { locale } = useTranslation()
  const categories = useMemo(() => getAllServiceCategories(), [])

  if (loading) {
    return <p className={`${typography.caption} text-center`}>Cargando catálogo…</p>
  }

  if (services.length === 0) {
    return (
      <p className={`${typography.caption} text-center text-charcoal-muted`}>
        No hay tratamientos disponibles para este profesional.
      </p>
    )
  }

  const allServiceIds = new Set(serviceIds)

  return (
    <div className="space-y-3">
      {categories.map((cat) => {
        const catServices = servicesInCategory(services, cat.id)
        if (catServices.length === 0) return null
        return (
          <fieldset key={cat.id}>
            <legend className={`${typography.label} mb-1.5 block text-xs text-gold`}>
              {categoryLabelForLocale(cat.id, locale)}
            </legend>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {catServices.map((service) => {
                const selected = allServiceIds.has(service.id)
                return (
                  <label
                    key={service.id}
                    className={`flex cursor-pointer items-center gap-2 border px-2.5 py-2 text-sm transition-colors ${
                      selected
                        ? 'border-gold bg-gold/5'
                        : 'border-gold/20 hover:border-gold/40'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => onToggleService(service.id)}
                      className="size-3.5 shrink-0 accent-gold"
                    />
                    <span className="min-w-0 flex-1 leading-tight">
                      <span className="block text-gold">
                        {serviceDisplayName(service, locale)}
                      </span>
                      <span className="block text-[11px] text-charcoal-muted">
                        {service.durationMinutes} min
                      </span>
                    </span>
                  </label>
                )
              })}
            </div>
          </fieldset>
        )
      })}
    </div>
  )
}
