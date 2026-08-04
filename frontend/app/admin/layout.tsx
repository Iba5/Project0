'use client'

import { useEffect, useRef, Suspense } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useAppStore } from '@/lib/store'
import { getMe } from '@/lib/api'
import { AdminShell } from '@/components/admin/admin-shell'
import { AdminLoginView } from '@/components/views/admin-login-view'

const PUBLIC_ADMIN_PATHS = ['/admin/login']

function AdminLayoutContent({ children }: { children: React.ReactNode }) {
  const { adminUser, setAdminUser, authLoading, setAuthLoading } = useAppStore()
  const pathname = usePathname() ?? ''
  const router = useRouter()
  const searchParams = useSearchParams()

  const isPublicAdminPath = PUBLIC_ADMIN_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + '/'),
  )

  // Track if user was previously authenticated to distinguish first-time visits from session expiration
  const wasEverAuthenticated = useRef(false)

  useEffect(() => {
    // Always check auth with backend for non-public paths
    if (!isPublicAdminPath) {
      getMe()
        .then(() => {
          wasEverAuthenticated.current = true
          setAuthLoading(false)
        })
        .catch((error) => {
          // Unauthenticated - clear the admin user state
          console.error('[Layout] Auth check failed:', error)
          setAdminUser(null)
          setAuthLoading(false)

          // If user was previously authenticated and now isn't, redirect to home
          // This handles session expiration while inside admin area
          if (wasEverAuthenticated.current) {
            console.log('[Layout] Session expired, redirecting to home')
            router.replace('/')
          }
        })
    } else {
      // On public paths, no need to check auth
      setAuthLoading(false)
    }
  }, [pathname, setAdminUser, setAuthLoading, isPublicAdminPath, router])

  // Still checking auth status — avoid flashing the login form
  if (authLoading && !isPublicAdminPath) {
    return <div className="min-h-screen" style={{ background: '#0B0F17' }} />
  }

  // Not logged in and not already on the login page — show login inline for first-time visits
  // (proxy.ts also redirects server-side; this is the client-side fallback
  // for cases where the cookie exists but the session is stale/invalid.)
  if (!adminUser && !isPublicAdminPath && !wasEverAuthenticated.current) {
    return <AdminLoginView />
  }

  // Not logged in but was previously authenticated - session expired, redirect to home
  if (!adminUser && !isPublicAdminPath && wasEverAuthenticated.current) {
    console.log('[Layout] Session expired, redirecting to home')
    router.replace('/')
    return <div className="min-h-screen" style={{ background: '#0B0F17' }} />
  }

  // Login page renders standalone, without the admin shell chrome
  if (pathname === '/admin/login') {
    return <>{children}</>
  }

  return <AdminShell>{children}</AdminShell>
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-screen" style={{ background: '#0B0F17' }} />}>
      <AdminLayoutContent>{children}</AdminLayoutContent>
    </Suspense>
  )
}
