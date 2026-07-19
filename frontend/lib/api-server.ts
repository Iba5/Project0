import { cookies } from 'next/headers'

const API_URL = process.env.API_URL || 'http://localhost:8000/api/v1'

export async function apiServer<T>(path: string, options: RequestInit = {}): Promise<T> {
  const cookieStore = await cookies()
  const token = cookieStore.get('vw_session')?.value

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }

  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${API_URL}/${path}`, { ...options, headers })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body?.message ?? body?.detail ?? `API error ${res.status}`)
  }

  if (res.status === 204) return undefined as T
  return res.json()
}