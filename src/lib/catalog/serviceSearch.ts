import { categoryLabelForLocale, serviceDisplayName } from '@/i18n/helpers'
import type { Locale } from '@/i18n/types'
import { isBookableOnline } from '@/lib/catalog/servicePicker'
import type { BookableService } from '@/types/booking'

export function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim()
}

export type ServiceSearchHit = {
  service: BookableService
  categoryLabel: string
  name: string
  phoneOnly: boolean
  /** Lower is better (name match before category-only match). */
  rank: number
}

/** Busca servicios por nombre o especialidad (sin acentos, ES/EN). */
export function searchBookableServices(
  services: BookableService[],
  query: string,
  locale: Locale,
  limit = 8,
): ServiceSearchHit[] {
  const needle = normalizeSearchText(query)
  if (needle.length < 2) return []

  const hits: ServiceSearchHit[] = []

  for (const service of services) {
    const name = serviceDisplayName(service, locale)
    const nameNorm = normalizeSearchText(name)
    const otherName = normalizeSearchText(
      locale === 'en' ? service.nameEs : service.nameEn,
    )
    const categoryLabel = categoryLabelForLocale(service.categoryId, locale)
    const categoryNorm = normalizeSearchText(categoryLabel)

    let rank = -1
    if (nameNorm.includes(needle)) {
      rank = nameNorm.startsWith(needle) ? 0 : 1
    } else if (otherName.includes(needle)) {
      rank = 2
    } else if (categoryNorm.includes(needle)) {
      rank = 3
    }

    if (rank < 0) continue

    hits.push({
      service,
      categoryLabel,
      name,
      phoneOnly: !isBookableOnline(service),
      rank,
    })
  }

  hits.sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank
    if (a.phoneOnly !== b.phoneOnly) return a.phoneOnly ? 1 : -1
    return a.name.localeCompare(b.name, locale)
  })

  return hits.slice(0, limit)
}
