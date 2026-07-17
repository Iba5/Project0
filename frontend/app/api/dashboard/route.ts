import { NextResponse } from "next/server"

import { proxyOrFallback } from "@/app/api/_lib/backend"
import { buildDashboardSummary } from "@/app/api/_store"

// Returns the dashboard summary for the admin overview page.
export async function GET(request: Request) {
  return proxyOrFallback({
    request,
    path: "/dashboard",
    method: "GET",
    fallback: () => NextResponse.json(buildDashboardSummary()),
  })
}
