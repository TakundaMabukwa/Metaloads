import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { getCronSecret } from "@/lib/env"

function extractBearerToken(request: Request) {
  return request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null
}

function isLocalRequest(request: Request) {
  const hostname = new URL(request.url).hostname
  return hostname === "127.0.0.1" || hostname === "localhost" || hostname === "::1"
}

export async function authorizeCronRequest(request: Request) {
  const token = extractBearerToken(request)
  const cronSecret = getCronSecret()

  if (cronSecret && token === cronSecret) {
    return { ok: true as const, mode: "secret" as const }
  }

  if (token) {
    const supabase = createServiceRoleClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token)

    if (!authError && user) {
      const { data: profile, error: profileError } = await supabase
        .from("users")
        .select("role, is_active")
        .eq("id", user.id)
        .maybeSingle()

      if (!profileError && profile?.is_active && ["admin", "dispatcher"].includes(String(profile.role))) {
        return { ok: true as const, mode: "user-token" as const, userId: user.id }
      }
    }
  }

  if (!cronSecret && isLocalRequest(request)) {
    return { ok: true as const, mode: "localhost" as const }
  }

  return { ok: false as const }
}
