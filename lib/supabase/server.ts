import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"
import { env } from "@/lib/env"

export async function createServerSupabaseClient() {
  const cookieStore = await cookies()

  return createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          for (const cookie of cookiesToSet) {
            cookieStore.set(cookie.name, cookie.value, cookie.options)
          }
        } catch {
          // Cookie writes may fail in read-only server contexts.
        }
      },
    },
  })
}

