import { NextResponse } from "next/server"

import { proxyOrFallback } from "@/app/api/_lib/backend"
import { store } from "@/app/api/_store"

// Returns payment history for the revenue and transaction views.
export async function GET(request: Request) {
  return proxyOrFallback({
    request,
    path: "/payments",
    method: "GET",
    fallback: () => NextResponse.json({ items: store.payments }),
  })
}
