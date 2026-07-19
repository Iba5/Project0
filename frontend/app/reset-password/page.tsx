import { Suspense } from 'react'
import ResetPasswordClient from './ResetPasswordClient'

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          Loading...
        </div>
      }
    >
      <ResetPasswordClient />
    </Suspense>
  )
}