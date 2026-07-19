import { Suspense } from 'react'
import {AdminLoginPage} from '@/components/pages/admin-login-page'

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          Loading...
        </div>
      }
    >
      <AdminLoginPage />
    </Suspense>
  )
}