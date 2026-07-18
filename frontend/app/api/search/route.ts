import { NextResponse } from "next/server"

import { proxyOrFallback } from "@/app/api/_lib/backend"
import { store } from "@/app/api/_store"

type SearchHit = {
  id: string
  type: "event" | "participant" | "payment"
  label: string
  sublabel: string
  href: string
}

// Searches events by name, participants by name, and payments by reference.
export async function GET(request: Request) {
  return proxyOrFallback({
    request,
    path: "/search/",
    method: "GET",
    fallback: () => {
      const { searchParams } = new URL(request.url)
      const q = (searchParams.get("q") ?? "").trim().toLowerCase()

      if (!q) {
        return NextResponse.json({ items: [] })
      }

      const hits: SearchHit[] = []

      for (const event of store.events) {
        if (event.name.toLowerCase().includes(q)) {
          hits.push({
            id: event.id,
            type: "event",
            label: event.name,
            sublabel: event.status,
            href: "/events",
          })
        }
      }

      for (const participant of store.participants) {
        if (participant.name.toLowerCase().includes(q) || participant.category.toLowerCase().includes(q)) {
          hits.push({
            id: participant.id,
            type: "participant",
            label: participant.name,
            sublabel: participant.category,
            href: "/participants",
          })
        }
      }

      for (const payment of store.payments) {
        if (payment.reference.toLowerCase().includes(q) || payment.contestant.toLowerCase().includes(q)) {
          hits.push({
            id: payment.id,
            type: "payment",
            label: payment.reference,
            sublabel: payment.contestant,
            href: "/payments",
          })
        }
      }

      return NextResponse.json({ items: hits.slice(0, 12) })
    },
  })
}
