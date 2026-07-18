import { NextResponse } from "next/server"

import { proxyOrFallback, jsonError } from "@/app/api/_lib/backend"
import { store, updateSocialStatus, recordActivity } from "@/app/api/_store"
import type { SocialStatus } from "@/lib/types"

// Returns platform sync status for the social media router panel.
export async function GET(request: Request) {
  return proxyOrFallback({
    request,
    path: "/social-router/",
    method: "GET",
    fallback: () => NextResponse.json({ items: store.social }),
  })
}

// Toggles the connection status of a social platform.
export async function PATCH(request: Request) {
  return proxyOrFallback({
    request,
    path: "/social-router/",
    method: "PATCH",
    body: await request.json().catch(() => null),
    fallback: async () => {
      let body: { platformId: string; action: "connect" | "disconnect" } | null = null
      try {
        body = await request.clone().json()
      } catch {
        return jsonError("Invalid request body.")
      }

      if (!body?.platformId || !body?.action) {
        return jsonError("platformId and action (connect | disconnect) are required.")
      }

      const platform = store.social.find((p) => p.id === body!.platformId)
      if (!platform) {
        return jsonError("Platform not found.", undefined, 404)
      }

      const newStatus: SocialStatus = body.action === "connect" ? "Connected" : "Disconnected"
      platform.status = newStatus
      platform.lastSync = body.action === "connect" ? "Just now" : platform.lastSync
      platform.detail =
        body.action === "connect"
          ? "Connection established and ready for sync."
          : "Platform disconnected by administrator."

      updateSocialStatus(store.social)
      recordActivity(
        `${platform.platform} ${body.action === "connect" ? "connected" : "disconnected"}`,
        `Social router ${body.action} action for ${platform.platform}.`
      )

      return NextResponse.json({
        message: `${platform.platform} ${body.action === "connect" ? "connected" : "disconnected"} successfully.`,
        item: platform,
      })
    },
  })
}
