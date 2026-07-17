import { NextResponse } from "next/server"

import { proxyOrFallback } from "@/app/api/_lib/backend"
import { store } from "@/app/api/_store"

// Returns platform sync status for the social media router panel.
export async function GET(request: Request) {
  return proxyOrFallback({
    request,
    path: "/social-router",
    method: "GET",
    fallback: () => NextResponse.json({ items: store.social }),
  })
}
