import { serviceCategories, type ServiceCategoryId } from '@/data/serviceCategories'
import type { BookableService } from '@/types/booking'

/** Nombre corto y natural para el salón (evita MAYÚSCULAS técnicas del catálogo). */
export const salonCategoryLabels: Record<ServiceCategoryId, string> = {
  'gentleman-haircut': 'Corte caballero y niño',
  color: 'Coloración',
  highlights: 'Mechas y balayage',
  bleaching: 'Decoloración',
  'haircut-blowdry': 'Corte y brushing',
  haircut: 'Corte',
  blowdry: 'Peinado y brushing',
  perm: 'Permanente',
  keratin: 'Alisado de keratina',
  'hair-treatments': 'Tratamientos capilares',
  'beauty-hands-feet': 'Manos y pies',
  'beauty-facial': 'Estética facial',
}

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
  public: {
    category: '¿Qué te apetece hoy?',
    categoryPlaceholder: 'Elige una opción…',
    service: 'Tu tratamiento',
    servicePlaceholder: 'Elige el tratamiento…',
    serviceHint: 'Elige primero el tipo de cita y después el tratamiento.',
    loading: 'Cargando tratamientos…',
    emptyCategory: 'Reserva este tipo de cita por teléfono o WhatsApp.',
  },
} as const

export type ServicePickerVariant = keyof typeof servicePickerLabels

export function categoryLabelFor(id: string | null | undefined): string {
  if (!id) return 'Otros'
  return salonCategoryLabels[id as ServiceCategoryId] ?? id
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
