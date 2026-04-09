import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { session },
  } = await supabase.auth.getSession()
  let user = session?.user ?? null

  if (!user) {
    try {
      const {
        data: { user: verifiedUser },
      } = await supabase.auth.getUser()
      user = verifiedUser
    } catch {
      user = null
    }
  }

  const pathname = request.nextUrl.pathname
  const protectedPaths = ["/dashboard", "/drivers", "/vehicles", "/allocations"]
  const isProtectedPath = protectedPaths.some(
    (protectedPath) => pathname === protectedPath || pathname.startsWith(`${protectedPath}/`)
  )

  if (
    !user &&
    isProtectedPath
  ) {
    const url = request.nextUrl.clone()
    url.pathname = "/auth/login"
    return NextResponse.redirect(url)
  }

  if (user && pathname === "/") {
    const url = request.nextUrl.clone()
    url.pathname = "/dashboard"
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
