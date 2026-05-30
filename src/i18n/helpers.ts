import { brand } from '@/data/content'
import { galleryImageAssets, type GalleryImageId } from '@/data/galleryImages'
import { marketingServiceAssets, type MarketingServiceId } from '@/data/marketingServices'
import type { BookableService } from '@/types/booking'
import type { ServiceCategoryId } from '@/data/serviceCategories'
import { getTranslation } from './translations'
import type { Locale } from './types'

export function serviceDisplayName(
  service: Pick<BookableService, 'nameEs' | 'nameEn'>,
  locale: Locale,
): string {
  return locale === 'en' ? service.nameEn : service.nameEs
}

export function categoryLabelForLocale(
  categoryId: string | null | undefined,
  locale: Locale,
): string {
  if (!categoryId) return getTranslation(locale).salonCategories.other
  const labels = getTranslation(locale).salonCategories
  return labels[categoryId as ServiceCategoryId] ?? categoryId
}

export function whatsappUrl(locale: Locale, variant: 'default' | 'highlights' = 'default'): string {
  const text = getTranslation(locale).whatsapp[variant]
  return `https://wa.me/34604808312?text=${encodeURIComponent(text)}`
}

export function getMarketingServices(locale: Locale) {
  const copy = getTranslation(locale).marketingServices
  return (Object.keys(marketingServiceAssets) as MarketingServiceId[]).map((id) => ({
    id,
    ...marketingServiceAssets[id],
    ...copy[id],
  }))
}

export function getGalleryImages(locale: Locale) {
  const alts = getTranslation(locale).gallery.alts
  return galleryImageAssets.map((item) => ({
    ...item,
    alt: alts[item.id as GalleryImageId],
  }))
}

export function getNavLinks(locale: Locale) {
  const t = getTranslation(locale)
  return [
    { href: '/#servicios', label: t.nav.services },
    { href: '/salon', label: t.nav.salon },
    { href: '/#galeria', label: t.nav.gallery },
    { href: '/#contacto', label: t.nav.contact },
  ] as const
}

export function getBookingOptions(locale: Locale) {
  const t = getTranslation(locale)
  return t.bookingOptions.map((option) => {
    const href =
      option.id === 'online'
        ? brand.bookingOnline
        : option.id === 'phone'
          ? brand.phoneHref
          : whatsappUrl(locale)
    const label =
      typeof option.label === 'function' ? option.label(brand.phone) : option.label
    return { ...option, href, label }
  })
}

export function resolveCookieParagraph(
  paragraph: string | ((brand: string, tagline: string, address: string) => string) | ((email: string, phone: string) => string),
  sectionId: string,
): string {
  if (typeof paragraph === 'string') return paragraph
  if (sectionId === 'responsable') {
    return (paragraph as (brand: string, tagline: string, address: string) => string)(
      brand.name,
      brand.tagline,
      brand.address,
    )
  }
  return (paragraph as (email: string, phone: string) => string)(brand.email, brand.phone)
}
