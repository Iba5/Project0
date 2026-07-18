import { NextResponse } from "next/server"
import { headers } from "next/headers"

type ProxyOptions = {
  request?: Request
  path: string
  method: string
  body?: unknown
  fallback: () => Promise<NextResponse> | NextResponse
}

// Proxies a request to the external service when configured, otherwise returns the local fallback.
export async function proxyOrFallback({ request, path, method, body, fallback }: ProxyOptions) {
  const baseUrl = process.env.BACKEND_API_URL

  if (!baseUrl) {
    return fallback()
  }

  try {
    // Resolve search parameters from incoming request if provided
    let url = `${baseUrl}${path}`
    if (request) {
      const { search } = new URL(request.url)
      if (search) {
        url += search
      }
    }

    // Capture authorization token dynamically from active request headers
    const reqHeaders = await headers()
    const authorization = reqHeaders.get("authorization")

    const headersToSend: Record<string, string> = {
      "Content-Type": "application/json",
    }

    if (authorization) {
      headersToSend["Authorization"] = authorization
    }

    const response = await fetch(url, {
      method,
      headers: headersToSend,
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    })

    const contentType = response.headers.get("content-type") || ""
    let payload = contentType.includes("application/json")
      ? await response.json()
      : { message: await response.text() }

    // Standardize list responses: wrap direct arrays in an { items: [...] } envelope
    if (Array.isArray(payload)) {
      payload = { items: payload }
    }

    return NextResponse.json(payload, { status: response.status })
  } catch (error) {
    console.error("Proxy Error connecting to external service:", error)
    const detail =
      error instanceof Error ? error.message : "An unexpected error occurred while reaching the service."
    return NextResponse.json(
      {
        message: "The service is currently unreachable.",
        hint: detail,
      },
      { status: 503 }
    )
  }
}

// Builds a consistent response for local mock mode and validation failures.
export function jsonError(message: string, hint?: string, status = 400) {
  return NextResponse.json({ message, hint }, { status })
}
