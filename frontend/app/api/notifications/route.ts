import { NextResponse } from "next/server"

import { proxyOrFallback } from "@/app/api/_lib/backend"
import { store } from "@/app/api/_store"

// Returns the notifications list with unread count for the top-nav bell.
export async function GET(request: Request) {
  return proxyOrFallback({
    request,
    path: "/notifications/",
    method: "GET",
    fallback: () => {
      const items = store.notifications
      const unread = items.filter((n) => !n.read).length
      return NextResponse.json({ items, unread })
    },
  })
}
