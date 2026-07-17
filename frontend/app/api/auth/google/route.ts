import { NextResponse } from "next/server"

import { proxyOrFallback } from "@/app/api/_lib/backend"

// Starts the Google OAuth handoff through the backend route when available.
export async function GET(request: Request) {
  return proxyOrFallback({
    request,
    path: "/auth/google",
    method: "GET",
    fallback: () =>
      NextResponse.json({
        authorizationUrl: "/dashboard",
        message: "Google sign-in is running in local mock mode.",
      }),
  })
}
