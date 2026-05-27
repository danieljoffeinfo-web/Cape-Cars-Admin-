import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

function resolveAdminKey() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim().replace(/^['"]|['"]$/g, '')
  if (serviceKey && (serviceKey.startsWith('sb_secret_') || serviceKey.startsWith('eyJ'))) return serviceKey
  throw new Error('createAdminClient requires a valid SUPABASE_SERVICE_ROLE_KEY')
}

export function createClient() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options))
          } catch {}
        },
      },
    }
  )
}

export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    resolveAdminKey(),
    {
      auth: { persistSession: false, autoRefreshToken: false },
    }
  )
}
