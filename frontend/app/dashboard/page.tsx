import type { Metadata } from "next"

import { DashboardPage } from "@/components/pages/dashboard-page"

export const metadata: Metadata = {
  title: "Dashboard",
}

// Renders the main admin overview route.
export default function Page() {
  return <DashboardPage />
}
