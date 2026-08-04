import { NextRequest, NextResponse } from 'next/server'

const PUBLIC_ADMIN_PATHS = ['/admin/login', '/admin/forgot-password']

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Skip proxy check for public admin paths
  if (PUBLIC_ADMIN_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))) || pathname === '/admin/login') {
    return NextResponse.next()
  }

  // For protected admin paths, let the client-side auth handle it
  // The proxy is mainly for API proxying, not auth enforcement
  // Client-side layout.tsx handles the actual auth check
  if (pathname.startsWith('/admin')) {
    return NextResponse.next()
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*'],
}