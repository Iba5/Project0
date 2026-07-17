import { NextResponse } from "next/server"

import { proxyOrFallback, jsonError } from "@/app/api/_lib/backend"

// Creates a new admin account using the backend or the local mock mode.
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { name?: string; email?: string; password?: string }
    | null

  if (!body?.name || !body.email || !body.password) {
    return jsonError("Add your name, email, and password before creating an account.")
  }

  return proxyOrFallback({
    request,
    path: "/auth/register",
    method: "POST",
    body,
    fallback: () =>
      NextResponse.json({
        message: "Account created locally.",
        token: "mock-admin-token",
        user: {
          id: "admin-002",
          name: body.name,
          email: body.email,
          role: "Administrator",
        },
      }),
  })
}
