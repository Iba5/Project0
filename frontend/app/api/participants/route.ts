import { NextResponse } from "next/server"

import { jsonError, proxyOrFallback } from "@/app/api/_lib/backend"
import { recordActivity, store, upsertParticipant } from "@/app/api/_store"
import type { ParticipantRecord } from "@/lib/types"

// Returns the participant list so the UI can search, filter, and paginate it.
export async function GET(request: Request) {
  return proxyOrFallback({
    request,
    path: "/participants/",
    method: "GET",
    fallback: () => NextResponse.json({ items: store.participants }),
  })
}

// Creates a new participant.
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Partial<ParticipantRecord> | null

  if (!body?.name || !body.category || !body.platform || !body.videoUrl) {
    return jsonError(
      "Please complete every participant field before saving.",
      "Name, category, platform, and video URL are required."
    )
  }

  const payload: ParticipantRecord = {
    id: body.id || `part-${Date.now()}`,
    name: body.name,
    category: body.category,
    platform: body.platform,
    videoUrl: body.videoUrl,
    status: body.status ?? "Pending",
    votes: body.votes ?? 0,
  }

  return proxyOrFallback({
    request,
    path: "/participants/",
    method: "POST",
    body: payload,
    fallback: () => {
      const item = upsertParticipant(payload)
      recordActivity("Participant added", `${item.name} was registered locally.`)
      return NextResponse.json({ message: "Participant saved locally.", item })
    },
  })
}
