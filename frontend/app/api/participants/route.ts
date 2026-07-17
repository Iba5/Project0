import { NextResponse } from "next/server"

import { proxyOrFallback } from "@/app/api/_lib/backend"
import { store } from "@/app/api/_store"

// Returns the participant list so the UI can search, filter, and paginate it.
export async function GET(request: Request) {
  return proxyOrFallback({
    request,
    path: "/participants/",
    method: "GET",
    fallback: () => NextResponse.json({ items: store.participants }),
  })
}
