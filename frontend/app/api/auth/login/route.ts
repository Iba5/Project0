import { NextResponse } from "next/server"

import { proxyOrFallback, jsonError } from "@/app/api/_lib/backend"

// Authenticates an admin user and returns the token shape the frontend expects.
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { email?: string; password?: string; rememberMe?: boolean }
    | null

  if (!body?.email || !body.password) {
    return jsonError("Enter both your email address and password to continue.")
  }

  return proxyOrFallback({
    request,
    path: "/auth/login",
    method: "POST",
    body,
    fallback: () =>
      NextResponse.json({
        message: "Signed in locally.",
        token: "mock-admin-token",
        user: {
          id: "admin-001",
          name: "Admin User",
          email: body.email,
          role: "Administrator",
        },
      }),
  })
}
