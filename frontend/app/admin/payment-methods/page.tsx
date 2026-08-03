import { AdminShell } from '@/components/admin/admin-shell'
import AdminPaymentMethodsView from '@/components/views/admin-payment-methods-view'

export default function PaymentMethodsPage() {
  return (
    <AdminShell>
      <AdminPaymentMethodsView />
    </AdminShell>
  )
}
