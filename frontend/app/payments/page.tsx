import type { Metadata } from "next"

import { PaymentsPage } from "@/components/pages/payments-page"

export const metadata: Metadata = {
  title: "Payments",
}

// Renders the payment history route.
export default function Page() {
  return <PaymentsPage />
}
