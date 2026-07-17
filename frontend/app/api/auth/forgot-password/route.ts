import { NextResponse } from "next/server"

import { proxyOrFallback, jsonError } from "@/app/api/_lib/backend"

// Starts the password reset flow.
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { email?: string } | null

  if (!body?.email) {
    return jsonError("Tell us which email address should receive the reset link.")
  }

  return proxyOrFallback({
    request,
    path: "/auth/forgot-password",
    method: "POST",
    body,
    fallback: () =>
      NextResponse.json({
        message: "Password reset instructions were prepared locally.",
      }),
  })
}
