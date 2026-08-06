import { Suspense } from 'react'
import ContestantsView from '@/components/views/contestants-view'

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ContestantsView />
    </Suspense>
  )
}
