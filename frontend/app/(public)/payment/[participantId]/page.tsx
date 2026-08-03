import PaymentView from '@/components/views/payment-view'

export default function Page({ params }: { params: { participantId: string } }) {
  return <PaymentView participantId={params.participantId} />
}
