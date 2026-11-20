import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL?.trim()
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

export const isSupabaseConfigured = Boolean(url && anonKey)

export const supabase: SupabaseClient | null =
  url && anonKey
    ? createClient(url, anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
        },
      })
    : null

export function requireSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error('Supabase n’est pas configuré (.env.local ou variables Vercel manquantes).')
  }
  return supabase
}
