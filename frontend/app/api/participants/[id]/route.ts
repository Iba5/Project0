import { NextResponse } from "next/server"

import { jsonError, proxyOrFallback } from "@/app/api/_lib/backend"
import { recordActivity, store, upsertParticipant } from "@/app/api/_store"
import type { ParticipantRecord } from "@/lib/types"

// Updates a single participant by ID.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = (await request.json().catch(() => null)) as Partial<ParticipantRecord> | null

  if (!body?.name || !body.category || !body.platform || !body.videoUrl) {
    return jsonError("All participant details must be provided to update the record.")
  }

  const current = store.participants.find((p) => p.id === id)

  if (!current) {
    return jsonError("The participant could not be found.", "Refresh the page and try again.", 404)
  }

  const updated: ParticipantRecord = { ...current, ...body, id }

  return proxyOrFallback({
    request,
    path: `/participants/${id}`,
    method: "PATCH",
    body: updated,
    fallback: () => {
      const item = upsertParticipant(updated)
      recordActivity("Participant updated", `${item.name} was changed locally.`)
      return NextResponse.json({ message: "Participant updated locally.", item })
    },
  })
}

// Removes a participant.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const exists = store.participants.some((p) => p.id === id)

  if (!exists) {
    return jsonError("The selected participant is no longer available.", "Reload the page and retry.", 404)
  }

  return proxyOrFallback({
    request,
    path: `/participants/${id}`,
    method: "DELETE",
    fallback: () => {
      const removed = store.participants.find((p) => p.id === id)
      store.participants = store.participants.filter((p) => p.id !== id)
      if (removed) {
        recordActivity("Participant removed", `${removed.name} was deleted locally.`)
      }
      return NextResponse.json({ message: "Participant removed locally." })
    },
  })
}
