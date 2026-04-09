"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { LayoutDashboard, Users, Truck, CalendarClock, Settings, Bell, LogOut } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { createClient } from "@/lib/supabase/client"

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/drivers", label: "Drivers", icon: Users },
  { href: "/vehicles", label: "Vehicles", icon: Truck },
  { href: "/allocations", label: "Allocations", icon: CalendarClock },
]

type ShellUser = {
  email: string
  fullName: string | null
  avatar?: string
}

function initialsFor(email: string, fullName: string | null) {
  if (fullName) {
    const initials = fullName
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("")

    if (initials) return initials
  }

  return email.slice(0, 2).toUpperCase()
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [shellUser, setShellUser] = useState<ShellUser>({
    email: "signed-in user",
    fullName: null,
  })

  useEffect(() => {
    const supabase = createClient()

    const syncUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user?.email) return

      setShellUser({
        email: user.email,
        fullName:
          typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : null,
        avatar:
          typeof user.user_metadata?.avatar_url === "string" ? user.user_metadata.avatar_url : undefined,
      })
    }

    syncUser()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void syncUser()
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const avatarLabel = useMemo(
    () => initialsFor(shellUser.email, shellUser.fullName),
    [shellUser.email, shellUser.fullName]
  )

  const displayName = shellUser.fullName ?? shellUser.email

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.replace("/auth/login")
    router.refresh()
  }

  return (
    <div className="flex h-screen bg-background">
      <aside className="w-56 shrink-0 overflow-hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
        <div className="flex h-full flex-col">
          <div className="p-4 pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sidebar-primary shadow-sm">
                <Truck className="h-5 w-5 text-sidebar-primary-foreground" />
              </div>
              <div>
                <h1 className="text-base font-semibold leading-tight">MetaLoad</h1>
                <p className="text-xs text-sidebar-foreground/70">Fleet Allocation Platform</p>
              </div>
            </div>
          </div>

          <nav className="flex-1 px-3 py-4 space-y-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {item.label}
                </Link>
              )
            })}
          </nav>

          <div className="border-t border-sidebar-border p-4">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10 ring-2 ring-sidebar-accent/60">
                  <AvatarImage src={shellUser.avatar} alt={displayName} />
                  <AvatarFallback className="bg-sidebar-accent text-sidebar-accent-foreground text-xs">
                    {avatarLabel}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{displayName}</p>
                  <p className="truncate text-xs text-sidebar-foreground/70">{shellUser.email}</p>
                </div>
              </div>
              <Button
                type="button"
                variant="secondary"
                onClick={handleLogout}
                className="h-9 w-full justify-start border-0 bg-sidebar-accent/90 px-3 text-sidebar-accent-foreground hover:bg-sidebar-accent"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="h-16 shrink-0 border-b border-border bg-card/90 px-6 backdrop-blur">
          <div className="flex h-full items-center justify-between gap-4">
            <div className="max-w-md flex-1">
              <Input
                placeholder="Search vehicles or drivers..."
                className="h-11 border-input bg-background/80 shadow-sm"
              />
            </div>
            <div className="flex items-center gap-4">
              <button className="rounded-xl p-2 transition-colors hover:bg-secondary">
                <Bell className="h-5 w-5 text-muted-foreground" />
              </button>
              <button className="rounded-xl p-2 transition-colors hover:bg-secondary">
                <Settings className="h-5 w-5 text-muted-foreground" />
              </button>
              <div className="flex items-center gap-3 rounded-full border border-border bg-background/80 px-2 py-1 shadow-sm">
                <div className="min-w-0 text-right">
                  <p className="max-w-[240px] truncate text-xs font-medium text-foreground">{shellUser.email}</p>
                </div>
                <Avatar className="h-9 w-9">
                  <AvatarImage src={shellUser.avatar} alt={displayName} />
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                    {avatarLabel}
                  </AvatarFallback>
                </Avatar>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
