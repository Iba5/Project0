import { NextResponse } from "next/server"

import { proxyOrFallback, jsonError } from "@/app/api/_lib/backend"
import { recordActivity, store } from "@/app/api/_store"
import type { EventRecord } from "@/lib/types"

// Updates or deletes a single event based on the request method.
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = (await request.json().catch(() => null)) as Partial<EventRecord> | null

  if (!body?.name || !body.description || !body.startDate || !body.endDate || !body.status) {
    return jsonError("All event details must be provided to update the record.")
  }

  const current = store.events.find((event) => event.id === id)

  if (!current) {
    return jsonError("The event could not be found.", "Refresh the page and try again.", 404)
  }

  const updated: EventRecord = {
    ...current,
    ...body,
    id,
  }

  return proxyOrFallback({
    request,
    path: `/events/${id}`,
    method: "PUT",
    body: updated,
    fallback: () => {
      const index = store.events.findIndex((event) => event.id === id)
      store.events[index] = updated
      recordActivity("Event updated", `${updated.name} was changed locally.`)
      return NextResponse.json({ message: "Event updated locally.", item: updated })
    },
  })
}

// Removes an event locally or forwards the request to the backend.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const exists = store.events.some((event) => event.id === id)

  if (!exists) {
    return jsonError("The selected event is no longer available.", "Reload the page and retry.", 404)
  }

  return proxyOrFallback({
    request,
    path: `/events/${id}`,
    method: "DELETE",
    fallback: () => {
      const removed = store.events.find((event) => event.id === id)
      store.events = store.events.filter((event) => event.id !== id)
      if (removed) {
        recordActivity("Event deleted", `${removed.name} was removed locally.`)
      }
      return NextResponse.json({ message: "Event removed locally." })
    },
  })
}
