import ContestantDetailView from '@/components/views/contestant-detail-view'

export default function Page({ params }: { params: { id: string } }) {
  return <ContestantDetailView participantId={params.id} />
}
