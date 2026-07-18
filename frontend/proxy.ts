import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

const PUBLIC_ROUTES = ["/login", "/signup", "/forgot-password"]

// Protects admin routes by checking for the auth token cookie.
export function proxy(request: NextRequest) {
  const token = request.cookies.get("auth-token")?.value
  const { pathname } = request.nextUrl

  const isPublicRoute = PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  )

  // No token and trying to access a protected route → redirect to login.
  if (!token && !isPublicRoute) {
    const loginUrl = new URL("/login", request.url)
    return NextResponse.redirect(loginUrl)
  }

  // Has token and trying to access auth pages → redirect to dashboard.
  if (token && isPublicRoute) {
    const dashboardUrl = new URL("/dashboard", request.url)
    return NextResponse.redirect(dashboardUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - /api (backend-facing route handlers)
     * - /_next (static assets and HMR)
     * - /favicon.ico
     */
    "/((?!api|_next|favicon\\.ico).*)",
  ],
}
