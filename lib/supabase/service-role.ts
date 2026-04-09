import { createClient } from "@supabase/supabase-js"
import { env, requireServiceRoleKey } from "@/lib/env"

export function createServiceRoleClient() {
  return createClient(env.supabaseUrl, requireServiceRoleKey(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

