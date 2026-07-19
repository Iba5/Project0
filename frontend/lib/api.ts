// Client-side API client.
// All requests go through /api/proxy/* — the Next.js server attaches the
// httpOnly auth cookie and forwards to the FastAPI backend.
// JWT never touches browser JavaScript.

const PROXY_BASE = '/api/proxy'

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }

  const res = await fetch(`${PROXY_BASE}/${path}`, { ...options, headers })

  if (!res.ok) {
    if (res.status === 401) {
      if (typeof window !== 'undefined') window.location.href = '/admin/login'
      throw new ApiError('Session expired', 401)
    }
    const body = await res.json().catch(() => ({}))
    throw new ApiError(body?.message ?? body?.detail ?? 'Request failed', res.status, body)
  }

  if (res.status === 204) return undefined as T
  return res.json()
}

export class ApiError extends Error {
  status: number
  body: unknown
  constructor(message: string, status: number, body?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

// --- Types ---

export type AuthResult = {
  token: string
  user: { id: string; name: string; email: string; role: string }
  message: string
}

export type DashboardSummaryApi = {
  activeEvent: string
  totalParticipants: number
  totalVotes: number
  totalRevenue: string
  recentPayments: PaymentApi[]
  recentActivity: ActivityApi[]
}

export type EventApi = {
  id: string
  name: string
  description: string | null
  banner: string | null
  startDate: string
  endDate: string
  status: string
  votePrice: number
  votesPerPayment: number
  currency: string
  votingOpens: string | null
  votingCloses: string | null
  publicLeaderboard: boolean
  allowedCategories: string
  allowedPlatforms: string
  requireContestantApproval?: boolean
}

export type EventCreateApi = {
  name: string
  description?: string | null
  banner?: string | null
  startDate: string
  endDate: string
  status?: string
  votePrice?: number
  votesPerPayment?: number
  currency?: string
  votingOpens?: string | null
  votingCloses?: string | null
  publicLeaderboard?: boolean
  allowedCategories?: string
  allowedPlatforms?: string
  requireContestantApproval?: boolean
}

export type EventUpdateApi = EventCreateApi

export type ParticipantApi = {
  id: string
  name: string
  category: string
  platform: string
  videoUrl: string
  status: string
  votes: number
  bio?: string | null
  imageUrl?: string | null
  eventId?: string | null
}

export type ParticipantCreateApi = {
  name: string
  category: string
  platform: string
  videoUrl: string
  status?: string
  votes?: number
  bio?: string | null
}

export type PaymentApi = {
  id: string
  reference: string
  contestant: string
  amount: string
  paymentMethod: string
  status: string
  date: string
}

export type ActivityApi = {
  id: string
  title: string
  detail: string | null
  time: string
}

export type SettingsApi = {
  companyName: string
  supportEmail: string
  timezone: string
  notifications: { email: boolean; sms: boolean; marketing: boolean }
}

export type SettingsUpdateApi = SettingsApi

export type SocialPlatformApi = {
  id: string
  platform: string
  status: string
  lastSync: string | null
  detail: string | null
}

export type AdminUserApi = {
  id: string
  name: string
  email: string
  role: string
}

// --- Auth ---

// Login goes DIRECTLY to our cookie-setting route, NOT through the proxy
export async function login(email: string, password: string) {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const data = await res.json()
  if (!res.ok) {
    throw new ApiError(data?.message ?? 'Login failed', res.status, data)
  }
  return data
}

// Logout goes directly to cookie-clearing route
export async function logout() {
  await fetch('/api/auth/logout', { method: 'POST' })
}

export function resetPassword(token: string, password: string) {
  return request<{ message: string }>('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({
      token,
      newPassword : password,
    }),
  })
}
// --- Dashboard ---
export function getDashboardSummary() {
  return request<DashboardSummaryApi>('/dashboard')
}

// --- Events ---
export function listEvents() {
  return request<EventApi[]>('/events')
}

export function createEvent(data: EventCreateApi) {
  return request<EventApi>('/events', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function updateEvent(id: string, data: EventUpdateApi) {
  return request<EventApi>(`/events/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export function deleteEvent(id: string) {
  return request<void>(`/events/${id}`, { method: 'DELETE' })
}

// --- Participants ---
export function listParticipants(params?: {
  search?: string
  status?: string
  platform?: string
}) {
  const qs = new URLSearchParams()
  if (params?.search) qs.set('search', params.search)
  if (params?.status) qs.set('status', params.status)
  if (params?.platform) qs.set('platform', params.platform)
  const q = qs.toString()
  return request<ParticipantApi[]>(`/participants${q ? `?${q}` : ''}`)
}

export function getParticipant(id: string) {
  return request<ParticipantApi>(`/participants/${id}`)
}

export function createParticipant(data: ParticipantCreateApi) {
  return request<ParticipantApi>('/participants', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function updateParticipantStatus(id: string, status: string) {
  return request<ParticipantApi>(
    `/participants/${id}/status?status=${encodeURIComponent(status)}`,
    { method: 'PATCH' }
  )
}

// --- Payments ---
export function listPayments() {
  return request<PaymentApi[]>('/payments')
}

export function initiatePayment(data: {
  contestantId: string
  amount: number
  paymentMethod: string
}) {
  return request<{ reference: string; redirectUrl: string }>('/payments/initiate', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

// --- Settings ---
export function getSettings() {
  return request<SettingsApi>('/settings')
}

export function updateSettings(data: SettingsUpdateApi) {
  return request<SettingsApi>('/settings', {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

// --- Social Router ---
export function getSocialPlatforms() {
  return request<{ items: SocialPlatformApi[] }>('/social-router')
}

// --- Admins ---
export function listAdmins() {
  return request<AdminUserApi[]>('/admins/list')
}

export function inviteAdmin(email: string, role: string) {
  return request<{
    email: string
    role: string
    invitationLink: string
    expiresAt: string
  }>('/auth/invite-admin', {
    method: 'POST',
    body: JSON.stringify({ email, role }),
  })
}

export function invalidateAdmin(adminId: string) {
  return request<{ message: string }>('/auth/invalidate-admin', {
    method: 'POST',
    body: JSON.stringify({ adminId }),
  })
}

// --- Public ---
type PaginatedResponse<T> = {
  items: T[]
  pagination: {
    page: number
    pageSize: number
    totalItems: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}
export function getPublicParticipants() {
  return request<PaginatedResponse<ParticipantApi>>(
    '/participants/public'
  )
}
export function getPublicLeaderboard() {
  return request<ParticipantApi[]>('/participants/leaderboard/view')
}
export function forgotPassword(email: string) {
  return request<{ message: string }>('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({
      email,
    }),
  })
}