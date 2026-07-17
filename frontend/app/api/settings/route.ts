import { NextResponse } from "next/server"

import { jsonError, proxyOrFallback } from "@/app/api/_lib/backend"
import { recordActivity, store, updateSettings } from "@/app/api/_store"
import type { SettingsProfile } from "@/lib/types"

// Returns and updates the current admin preferences payload.
export async function GET(request: Request) {
  return proxyOrFallback({
    request,
    path: "/settings/",
    method: "GET",
    fallback: () => NextResponse.json(store.settings),
  })
}

// Saves account settings.
export async function PUT(request: Request) {
  const body = (await request.json().catch(() => null)) as SettingsProfile | null

  if (!body?.companyName || !body.supportEmail || !body.timezone) {
    return jsonError(
      "Please complete the company name, support email, and timezone fields.",
      "Those fields are used to keep notification and scheduling data consistent."
    )
  }

  return proxyOrFallback({
    request,
    path: "/settings/",
    method: "PUT",
    body,
    fallback: () => {
      const item = updateSettings(body)
      recordActivity("Settings updated", `${item.companyName} preferences were saved locally.`)
      return NextResponse.json({ message: "Settings saved locally.", item })
    },
  })
}
