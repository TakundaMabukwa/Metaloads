import { getCurrentUser, type AppUser } from "@/lib/auth/get-current-user"
import { redirect } from "next/navigation"

export async function requireAuth(): Promise<AppUser> {
  const user = await getCurrentUser()

  if (!user) {
    redirect("/auth/login")
  }

  if (!user.isActive) {
    throw new Error("User account is inactive")
  }

  return user
}

export async function requireRole(roles: AppUser["role"][]): Promise<AppUser> {
  const user = await requireAuth()
  return user
}
