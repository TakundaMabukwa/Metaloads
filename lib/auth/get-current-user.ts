import { createServerSupabaseClient } from "@/lib/supabase/server"

export type AppUser = {
  id: string
  email: string | null
  role: "admin" | "dispatcher" | "viewer"
  fullName: string | null
  isActive: boolean
  linkedDriverId: string | null
}

export async function getCurrentUser(): Promise<AppUser | null> {
  const supabase = await createServerSupabaseClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  let authUser = session?.user ?? null

  if (!authUser) {
    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()

      if (authError) {
        throw authError
      }

      authUser = user
    } catch {
      authUser = null
    }
  }

  if (!authUser) {
    return null
  }

  const fallbackRole =
    authUser.app_metadata?.role === "admin" ||
    authUser.app_metadata?.role === "dispatcher" ||
    authUser.app_metadata?.role === "viewer"
      ? authUser.app_metadata.role
      : "viewer"

  let profile:
    | {
        id: string
        email: string | null
        role: string
        full_name: string | null
        is_active: boolean
        linked_driver_id: string | null
      }
    | null = null

  try {
    const { data } = await supabase
      .from("users")
      .select("id, email, role, full_name, is_active, linked_driver_id")
      .eq("id", authUser.id)
      .maybeSingle()

    profile = data ?? null
  } catch {
    profile = null
  }

  if (!profile) {
    try {
      const { data: createdProfile } = await supabase
        .from("users")
        .upsert(
          {
            id: authUser.id,
            email: authUser.email ?? null,
            full_name:
              (typeof authUser.user_metadata?.full_name === "string" && authUser.user_metadata.full_name) ||
              null,
            role: fallbackRole,
            is_active: true,
          },
          { onConflict: "id" }
        )
        .select("id, email, role, full_name, is_active, linked_driver_id")
        .single()

      profile = createdProfile ?? null
    } catch {
      profile = null
    }
  }

  return {
    id: (profile?.id ?? authUser.id) as string,
    email: (profile?.email ?? authUser.email ?? null) as string | null,
    role: ((profile?.role as AppUser["role"] | undefined) ?? fallbackRole) as AppUser["role"],
    fullName:
      (profile?.full_name ??
        (typeof authUser.user_metadata?.full_name === "string" ? authUser.user_metadata.full_name : null)) as
        | string
        | null,
    isActive: profile?.is_active ?? true,
    linkedDriverId: (profile?.linked_driver_id ?? null) as string | null,
  }
}
