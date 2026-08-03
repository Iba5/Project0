'use client'

import { Suspense, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { AdminForgotPasswordView } from '@/components/views/admin-forgot-password-view'

function ResetPasswordContent() {
  const searchParams = useSearchParams()

  const resetState = useMemo(() => ({
    token: searchParams?.get('token') || '',
    email: searchParams?.get('email') || '',
  }), [searchParams])

  return <AdminForgotPasswordView initialToken={resetState.token} initialEmail={resetState.email} />
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ResetPasswordContent />
    </Suspense>
  )
}
