import { NextRequest, NextResponse } from 'next/server'

const API_URL = process.env.API_URL || 'http://localhost:8000/api/v1'

export async function GET(request: NextRequest) {
  const token = request.cookies.get('vw_session')?.value

  if (!token) {
    return NextResponse.json({ user: null }, { status: 401 })
  }

  try {
    const userStr = request.cookies.get('vw_user')?.value
    if (!userStr) {
      return NextResponse.json({ user: null }, { status: 401 })
    }

    const res = await fetch(`${API_URL}/dashboard`, {
      headers: { 'Authorization': `Bearer ${token}` },
    })

    if (!res.ok) {
      return NextResponse.json({ user: null }, { status: 401 })
    }

    const user = JSON.parse(userStr)
    return NextResponse.json({ user })
  } catch {
    return NextResponse.json({ user: null }, { status: 401 })
  }
}