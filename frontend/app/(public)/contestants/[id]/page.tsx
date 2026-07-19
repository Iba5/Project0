'use client'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { getParticipant, type ParticipantApi } from '@/lib/api'
import { ContestantDetailContent } from '@/components/pages/contestant-detail-page'

export default function ContestantDetailRoute() {
  const params = useParams()
  const id = params.id as string
  const [participant, setParticipant] = useState<ParticipantApi | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    getParticipant(id)
      .then((data) => { if (!cancelled) setParticipant(data) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
  }, [id])

  if (loading) return <div className="flex items-center justify-center py-20"><div className="size-6 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" /></div>
  if (!participant) return <div className="flex items-center justify-center py-20"><p className="text-sm text-muted-foreground">Contestant not found.</p></div>

  return <ContestantDetailContent participant={participant} />
}