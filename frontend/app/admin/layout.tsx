'use client'

import { useEffect, useState, Suspense } from 'react'
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

  useEffect(() => {
    console.log('[Layout] Effect running:', { adminUser, pathname, isPublicAdminPath, authLoading })
    
    // Always check auth with backend for non-public paths
    if (!isPublicAdminPath) {
      console.log('[Layout] Calling getMe() to verify auth with backend')
      getMe()
        .then(() => {
          console.log('[Layout] getMe() successful, user updated in store')
          setAuthLoading(false)
        })
        .catch((error) => {
          // Unauthenticated - clear the admin user state
          console.error('[Layout] Auth check failed:', error)
          setAdminUser(null)
          setAuthLoading(false)
        })
    } else {
      // On public paths, no need to check auth
      console.log('[Layout] Public path, no auth check needed')
      setAuthLoading(false)
    }
  }, [pathname, setAdminUser, setAuthLoading, isPublicAdminPath])

  // Still checking auth status — avoid flashing the login form
  if (authLoading && !isPublicAdminPath) {
    console.log('[Layout] Still checking auth, showing loading')
    return <div className="min-h-screen" style={{ background: '#0B0F17' }} />
  }

  // Not logged in and not already on the login page — show login inline.
  // (proxy.ts also redirects server-side; this is the client-side fallback
  // for cases where the cookie exists but the session is stale/invalid.)
  if (!adminUser && !isPublicAdminPath) {
    console.log('[Layout] No admin user and not on public path, showing login')
    return <AdminLoginView />
  }

  // Login page renders standalone, without the admin shell chrome
  if (pathname === '/admin/login') {
    console.log('[Layout] On login page, showing children without shell')
    return <>{children}</>
  }

  console.log('[Layout] All checks passed, showing admin shell')
  return <AdminShell>{children}</AdminShell>
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-screen" style={{ background: '#0B0F17' }} />}>
      <AdminLayoutContent>{children}</AdminLayoutContent>
    </Suspense>
  )
}
