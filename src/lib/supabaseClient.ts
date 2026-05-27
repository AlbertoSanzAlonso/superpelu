import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

/** Cliente Supabase para el navegador (auth, storage, realtime). Las citas siguen yendo por /api. */
export function createBrowserSupabaseClient(): SupabaseClient | null {
  if (!url?.trim() || !publishableKey?.trim()) {
    return null
  }
  return createClient(url.trim(), publishableKey.trim())
}

/** Singleton perezoso; null si faltan variables VITE_SUPABASE_* en .env */
export const supabase = createBrowserSupabaseClient()
