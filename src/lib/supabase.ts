import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { AppRole, Database } from './database.types'

export type { AppRole } from './database.types'

const projectUrl = import.meta.env.VITE_SUPABASE_URL?.trim()
const publicAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

export const supabaseConfigurationError = !projectUrl || !publicAnonKey
  ? 'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.local, then restart Vite.'
  : null

let client: SupabaseClient | null = null
let clientInitializationError: string | null = null

if (projectUrl && publicAnonKey) {
  try {
    client = createClient<Database>(projectUrl, publicAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  } catch {
    clientInitializationError = 'Supabase settings are invalid. Check the project URL and public anon key.'
  }
}

export const supabase = client
export const supabaseConfigMessage = supabaseConfigurationError ?? clientInitializationError

export function requireSupabase() {
  if (!supabase) throw new Error(supabaseConfigMessage ?? 'Supabase is not configured.')
  return supabase
}

export type Profile = {
  id: string
  display_name: string
  role: AppRole
  created_at: string
  updated_at: string
}
