import ContestantDetailView from '@/components/views/contestant-detail-view'

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return <ContestantDetailView participantId={id} />
}