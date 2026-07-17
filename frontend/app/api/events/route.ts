import { NextResponse } from "next/server"

import { jsonError, proxyOrFallback } from "@/app/api/_lib/backend"
import { recordActivity, store, upsertEvent } from "@/app/api/_store"
import type { EventRecord } from "@/lib/types"

// Returns all events and handles creation when the backend is not yet available.
export async function GET(request: Request) {
  return proxyOrFallback({
    request,
    path: "/events/",
    method: "GET",
    fallback: () => NextResponse.json({ items: store.events }),
  })
}

// Creates a new event locally or forwards the payload to the backend.
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Partial<EventRecord> | null

  if (!body?.name || !body.description || !body.startDate || !body.endDate || !body.status) {
    return jsonError(
      "Please complete every event field before saving.",
      "Event name, description, dates, banner, and status are required."
    )
  }

  const payload: EventRecord = {
    id: body.id || `evt-${Date.now()}`,
    name: body.name,
    description: body.description,
    banner:
      body.banner ||
      "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=1200&q=80",
    startDate: body.startDate,
    endDate: body.endDate,
    status: body.status,
  }

  return proxyOrFallback({
    request,
    path: "/events/",
    method: "POST",
    body: payload,
    fallback: () => {
      const item = upsertEvent(payload)
      recordActivity("Event saved", `${item.name} was added or updated locally.`)
      return NextResponse.json({ message: "Event saved locally.", item })
    },
  })
}
