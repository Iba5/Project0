import { Suspense } from 'react'
import AcceptInvitationClient from './AcceptInvitationClient'

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          Loading...
        </div>
      }
    >
      <AcceptInvitationClient />
    </Suspense>
  )
}