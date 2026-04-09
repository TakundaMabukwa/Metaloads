import { createServerSupabaseClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { cookies } from "next/headers"

export async function GET() {
  const cookieStore = await cookies()
  const supabase = await createServerSupabaseClient()

  const [{ data: userData, error: userError }, { data: claimsData, error: claimsError }] =
    await Promise.all([supabase.auth.getUser(), supabase.auth.getClaims()])

  let profile = null
  let profileError: string | null = null

  if (userData.user?.id) {
    try {
      const { data, error } = await supabase
        .from("users")
        .select("id, email, role, full_name, is_active, linked_driver_id")
        .eq("id", userData.user.id)
        .maybeSingle()

      profile = data
      profileError = error?.message ?? null
    } catch (error) {
      profileError = error instanceof Error ? error.message : "Unknown profile lookup error"
    }
  }

  return NextResponse.json({
    cookieNames: cookieStore.getAll().map((cookie) => cookie.name),
    hasSbCookie: cookieStore.getAll().some((cookie) => cookie.name.startsWith("sb-")),
    getUser: {
      userId: userData.user?.id ?? null,
      email: userData.user?.email ?? null,
      error: userError?.message ?? null,
    },
    getClaims: {
      sub: claimsData?.claims?.sub ?? null,
      email: claimsData?.claims?.email ?? null,
      error: claimsError?.message ?? null,
    },
    profile,
    profileError,
  })
}
