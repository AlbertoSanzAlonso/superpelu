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

/** Las especialidades del catálogo (reserva pública y agenda admin). */
export function getAllServiceCategories() {
  return [...serviceCategories]
}

/** Opciones de especialidad para backoffice: catálogo completo + nombres de la API. */
export function buildAdminCategoryOptions(
  apiCategories: readonly { id: string; nameEs: string }[] = [],
): { id: string; label: string }[] {
  const labelById = new Map(
    getAllServiceCategories().map((category) => [category.id, categoryLabelFor(category.id)]),
  )
  for (const category of apiCategories) {
    labelById.set(category.id, category.nameEs)
  }
  const ordered = getAllServiceCategories().map((category) => ({
    id: category.id,
    label: labelById.get(category.id) ?? category.nameEs,
  }))
  for (const category of apiCategories) {
    if (!ordered.some((item) => item.id === category.id)) {
      ordered.push({ id: category.id, label: category.nameEs })
    }
  }
  return ordered
}

export function isBookableOnline(service: BookableService): boolean {
  return service.bookableOnline !== false
}

export function countServicesInCategory(services: BookableService[], categoryId: string) {
  return servicesInCategory(services, categoryId).length
}

/** Tratamientos que el cliente puede reservar online en esa especialidad. */
export function countBookableOnlineInCategory(services: BookableService[], categoryId: string) {
  return bookableOnlineInCategory(services, categoryId).length
}

export function servicesInCategory(services: BookableService[], categoryId: string) {
  return services.filter((s) => s.categoryId === categoryId)
}

export function bookableOnlineInCategory(services: BookableService[], categoryId: string) {
  return servicesInCategory(services, categoryId).filter(isBookableOnline)
}

/** Especialidad solo teléfono/WhatsApp (como mechas): no hay nada reservable online. */
export function isPhoneOnlyCategory(services: BookableService[], categoryId: string) {
  const inCategory = servicesInCategory(services, categoryId)
  return inCategory.length > 0 && inCategory.every((s) => !isBookableOnline(s))
}

export function categoryIdForService(
  services: BookableService[],
  serviceId: string,
): string {
  return services.find((s) => s.id === serviceId)?.categoryId ?? ''
}
