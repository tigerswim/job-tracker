// Browser-side Supabase client (@supabase/ssr).
// Replaces the deprecated createClientComponentClient from auth-helpers-nextjs.
import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

/**
 * createBrowserClient memoizes internally, so repeated calls return the same
 * instance. That makes it safe to call from component bodies without the
 * client-churn memory leak the old helper had.
 */
export function createClient() {
  return createBrowserClient(supabaseUrl, supabaseAnonKey)
}
