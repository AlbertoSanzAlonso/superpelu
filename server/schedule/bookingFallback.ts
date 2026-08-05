import { sql } from '@server/db.js'
import { brand } from '@/data/content'

export const BOOKING_FALLBACK_BUK_KEY = 'booking_fallback_buk'

export type BookingFallbackState = {
  enabled: boolean
  url: string
}

export function bukBookingUrl(): string {
  return brand.bukBooking
}

export async function getBookingFallback(): Promise<BookingFallbackState> {
  const rows = await sql<{ value: string }[]>`
    SELECT value FROM salon_settings WHERE key = ${BOOKING_FALLBACK_BUK_KEY} LIMIT 1
  `
  return {
    enabled: rows[0]?.value === 'true',
    url: bukBookingUrl(),
  }
}

export async function setBookingFallback(enabled: boolean): Promise<BookingFallbackState> {
  const value = enabled ? 'true' : 'false'
  await sql`
    INSERT INTO salon_settings (key, value, updated_at)
    VALUES (${BOOKING_FALLBACK_BUK_KEY}, ${value}, now())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
  `
  return { enabled, url: bukBookingUrl() }
}
