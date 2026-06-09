import { serviceCategories } from '@/data/serviceCategories'
import type { BookableService } from '@/types/booking'

import { categoryLabelForLocale } from '@/i18n/helpers'
import type { Locale } from '@/i18n/types'

export const servicePickerLabels = {
  staff: {
    category: 'Especialidad',
    categoryPlaceholder: 'Elige especialidad…',
    service: 'Tratamiento',
    servicePlaceholder: 'Elige tratamiento…',
    serviceHint: 'Primero la especialidad; después el tratamiento concreto.',
    loading: 'Cargando catálogo…',
    emptyCategory: 'No hay tratamientos en esta especialidad.',
  },
} as const

export type ServicePickerVariant = keyof typeof servicePickerLabels

/** @deprecated Usar categoryLabelForLocale(id, locale) */
export function categoryLabelFor(id: string | null | undefined, locale: Locale = 'es'): string {
  return categoryLabelForLocale(id, locale)
}

export function getOrderedCategoriesForServices(services: BookableService[]) {
  const ids = new Set(
    services.map((s) => s.categoryId).filter((id): id is string => Boolean(id)),
  )
  return serviceCategories.filter((c) => ids.has(c.id))
}

/** Las 12 especialidades del catálogo (reserva pública). */
export function getAllServiceCategories() {
  return [...serviceCategories]
}

export function countServicesInCategory(services: BookableService[], categoryId: string) {
  return servicesInCategory(services, categoryId).length
}

export function servicesInCategory(services: BookableService[], categoryId: string) {
  return services.filter((s) => s.categoryId === categoryId)
}

export function categoryIdForService(
  services: BookableService[],
  serviceId: string,
): string {
  return services.find((s) => s.id === serviceId)?.categoryId ?? ''
}
