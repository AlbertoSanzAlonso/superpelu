import { useEffect, useState } from 'react'
import { brand } from '@/data/content'
import {
  bookingAnchorProps,
  resolveBookingHref,
  type BookingFallbackState,
} from '@/lib/booking/fallback'

async function fetchPublicFallback(): Promise<BookingFallbackState> {
  try {
    const res = await fetch('/api/booking/fallback')
    if (!res.ok) return { enabled: false, url: brand.bukBooking }
    const data = (await res.json()) as { enabled?: boolean; url?: string }
    return {
      enabled: data.enabled === true,
      url: typeof data.url === 'string' && data.url ? data.url : brand.bukBooking,
    }
  } catch {
    return { enabled: false, url: brand.bukBooking }
  }
}

export function useBookingFallback() {
  const [state, setState] = useState<BookingFallbackState>({
    enabled: false,
    url: brand.bukBooking,
  })
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    void fetchPublicFallback().then((next) => {
      if (!cancelled) {
        setState(next)
        setLoaded(true)
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  const bookingHref = resolveBookingHref(state.enabled, state.url)
  const linkProps = bookingAnchorProps(bookingHref)

  return {
    enabled: state.enabled,
    url: state.url,
    bookingHref,
    linkProps,
    loaded,
  }
}
