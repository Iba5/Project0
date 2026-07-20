import { NextRequest, NextResponse } from 'next/server'

const API_URL = process.env.BACKEND_API_URL

type Ctx = { params: Promise<{ path: string[] }> }

export async function GET(request: NextRequest, ctx: Ctx) {
  return proxyRequest(request, 'GET', ctx.params)
}
export async function POST(request: NextRequest, ctx: Ctx) {
  return proxyRequest(request, 'POST', ctx.params)
}
export async function PUT(request: NextRequest, ctx: Ctx) {
  return proxyRequest(request, 'PUT', ctx.params)
}
export async function PATCH(request: NextRequest, ctx: Ctx) {
  return proxyRequest(request, 'PATCH', ctx.params)
}
export async function DELETE(request: NextRequest, ctx: Ctx) {
  return proxyRequest(request, 'DELETE', ctx.params)
}

async function proxyRequest(
  request: NextRequest,
  method: string,
  paramsPromise: Promise<{ path: string[] }>
) {
  const { path } = await paramsPromise
  const token = request.cookies.get('vw_session')?.value
  const cleanSegments = path.filter(Boolean)
  const backendPath = cleanSegments.join('/')

  // Backend routes mounted at "" under these prefixes require a trailing
  // slash when called with no sub-path (e.g. GET /dashboard/, not /dashboard).
  // Adding it here (server-side, after Next's own routing already resolved
  // the request) avoids Next.js canonicalizing away a trailing slash on the
  // client-facing /api/proxy/* URL.
  const SLASH_REQUIRED_ROOTS = new Set([
    'dashboard', 'events', 'participants', 'payments', 'settings', 'social-router',
  ])
  const needsTrailingSlash =
    cleanSegments.length === 1 && SLASH_REQUIRED_ROOTS.has(cleanSegments[0])

  const url = `${API_URL}/${backendPath}${needsTrailingSlash ? '/' : ''}${request.nextUrl.search}`

  const headers: Record<string, string> = {}
  if (token) headers['Authorization'] = `Bearer ${token}`

  const fetchOptions: RequestInit = { method, headers }

  if (method !== 'GET' && method !== 'HEAD') {
    fetchOptions.body = await request.text()
    headers['Content-Type'] = request.headers.get('content-type') || 'application/json'
  }

  try {
    const res = await fetch(url, fetchOptions)
    const body = await res.text()

    const response = new NextResponse(body, {
      status: res.status,
      headers: { 'Content-Type': res.headers.get('content-type') || 'application/json' },
    })

    const newToken = res.headers.get('x-new-token')
    if (newToken) {
      response.cookies.set('vw_session', newToken, {
        httpOnly: true, secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24,
      })
    }

    return response
  } catch {
    return NextResponse.json(
      { success: false, message: 'Backend unavailable.' },
      { status: 502 }
    )
  }
}