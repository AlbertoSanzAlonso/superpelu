import { brand } from '@/data/content'

export type BookingFallbackState = {
  enabled: boolean
  url: string
}

/** Href for public «Reservar» CTAs: BUK when fallback is on, otherwise /reservar. */
export function resolveBookingHref(enabled: boolean, bukUrl: string = brand.bukBooking): string {
  return enabled ? bukUrl : brand.bookingOnline
}

export function isExternalBookingHref(href: string): boolean {
  return href.startsWith('http://') || href.startsWith('https://')
}

/** Spread onto Button/a when linking to booking. */
export function bookingAnchorProps(href: string): {
  href: string
  target?: '_blank'
  rel?: string
} {
  if (isExternalBookingHref(href)) {
    return { href, target: '_blank', rel: 'noopener noreferrer' }
  }
  return { href }
}
