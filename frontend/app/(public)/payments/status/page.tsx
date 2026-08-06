import { Suspense } from 'react'
import PaymentStatusClient from './payment-status-client'

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center px-4">Loading...</div>}>
      <PaymentStatusClient />
    </Suspense>
  )
}
