import { apiUrl, apiFetch, storeToken, clearToken } from './api-client'
import type { AdminUser } from './store'
import { useAppStore } from './store'

// ─── Auth ────────────────────────────────────────────────────────

export async function login(email: string, password: string): Promise<{ user: AdminUser }> {
  console.log('[API] Login called for:', email)
  const response = await apiFetch<{ user: AdminUser; token: string; refreshToken?: string }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  
  console.log('[API] Login response:', response)
  
  // Store the access token for subsequent requests (refresh token is in httpOnly cookie)
  if (response.token) {
    console.log('[API] Storing token:', response.token.substring(0, 20) + '...')
    storeToken(response.token)
  }
  
  // Update the store with user data from backend
  if (typeof window !== 'undefined') {
    const { setAdminUser } = useAppStore.getState()
    setAdminUser(response.user)
  }
  
  return { user: response.user }
}

export async function logout(): Promise<void> {
  try {
    await apiFetch('/auth/logout', { method: 'POST' })
  } finally {
    // Clear access token regardless of logout success (refresh token is cleared by backend)
    clearToken()
    // Clear admin user from store
    if (typeof window !== 'undefined') {
      const { setAdminUser } = useAppStore.getState()
      setAdminUser(null)
    }
  }
}

export async function getMe(): Promise<{ user: AdminUser }> {
  console.log('[API] getMe called')
  try {
    const result = await apiFetch('/auth/me')
    console.log('[API] getMe result:', result)
    // Update the store with user data from backend
    if (typeof window !== 'undefined') {
      const { setAdminUser } = useAppStore.getState()
      setAdminUser(result.user)
    }
    return result
  } catch (error) {
    console.error('[API] getMe failed:', error)
    throw error
  }
}

export async function signup(
  name: string,
  email: string,
  password: string,
): Promise<{ user: AdminUser; isFirstUser: boolean }> {
  const response = await apiFetch<{ user: AdminUser; token: string; refreshToken?: string; isFirstUser: boolean }>('/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ name, email, password }),
  })
  
  // Store the access token for subsequent requests (refresh token is in httpOnly cookie)
  if (response.token) {
    storeToken(response.token)
  }
  
  // Update the store with user data from backend
  if (typeof window !== 'undefined') {
    const { setAdminUser } = useAppStore.getState()
    setAdminUser(response.user)
  }
  
  return { user: response.user, isFirstUser: response.isFirstUser }
}

export async function forgotPassword(email: string): Promise<{ message: string }> {
  return apiFetch('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  })
}

export async function resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
  return apiFetch('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token, newPassword }),
  })
}
// ─── Dashboard ───────────────────────────────────────────────────

export type DashboardRange = '7d' | '30d' | '90d' | 'ytd' | 'all'

export interface RevenueTrendPoint {
  date: string
  total: number
}

export interface VotesByCategoryPoint {
  category: string
  votes: number
}

export interface TopPaymentMethodPoint {
  method: string
  total: number
  count: number
}

export interface VoteTrendPoint {
  date: string
  votes: number
}

export interface TopPerformerEntry {
  id: string
  name: string
  category: string
  votes: number
  trend: 'up' | 'down' | 'same'
  trendVotes: number
  imageUrl: string | null
  thumbnailUrl: string | null
}

export interface EnhancedActivityEntry {
  id: string
  title: string
  detail: string | null
  time: string
  category: string | null
  participantName: string | null
  voteCount: number | null
}

export interface DashboardSummary {
  activeEvent: {
    id: string
    name: string
    status: string
  } | null
  totalParticipants: number
  totalVotes: number
  totalRevenue: number
  recentPayments: Array<{
    id: string
    reference: string
    amount: number
    status: string
    paymentMethod: string
    createdAt: string
  }>
  recentActivity: Array<{
    id: string
    title: string
    detail: string | null
    time: string
  }>
  range: DashboardRange
  dateFrom: string | null
  revenueTrend: RevenueTrendPoint[]
  votesByCategory: VotesByCategoryPoint[]
  topPaymentMethods: TopPaymentMethodPoint[]
  voteTrend: VoteTrendPoint[]
  topPerformers: TopPerformerEntry[]
  enhancedRecentActivity: EnhancedActivityEntry[]
}

export async function getDashboardSummary(
  range?: DashboardRange | string,
): Promise<DashboardSummary> {
  const qs = range ? `?range=${encodeURIComponent(range)}` : ''
  return apiFetch(`/dashboard${qs}`)
}

export const getDashboard = getDashboardSummary

// ─── Events ──────────────────────────────────────────────────────

export interface EventItem {
  id: string
  name: string
  description: string | null
  banner: string | null
  startDate: string
  endDate: string
  status: string
  computedStatus?: string
  votePrice: number
  votesPerPayment: number
  currency: string
  registrationOpens: string | null
  registrationCloses: string | null
  votingOpens: string | null
  votingCloses: string | null
  publicLeaderboard: boolean
  requireContestantApproval: boolean
  enableVideos: boolean
  shareLink: string | null
  eventId: string | null
  competitionId: string | null
  createdAt: string
  deletedAt: string | null
  participantCount?: number
}

export interface ListEventsParams {
  search?: string
  status?: string
}

export async function listEvents(params?: ListEventsParams): Promise<{ events: EventItem[] }> {
  const searchParams = new URLSearchParams()
  if (params?.search) searchParams.set('search', params.search)
  if (params?.status) searchParams.set('status', params.status)
  const qs = searchParams.toString()
  return apiFetch(`/events${qs ? `?${qs}` : ''}`)
}

export async function listPublicEvents(): Promise<{ events: EventItem[] }> {
  return apiFetch('/events')
}

export async function getEvent(id: string): Promise<{ event: EventItem }> {
  return apiFetch(`/events/${id}`)
}

export async function createEvent(payload: Record<string, unknown>): Promise<{ event: EventItem }> {
  return apiFetch('/events', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateEvent(id: string, payload: Record<string, unknown>): Promise<{ event: EventItem }> {
  return apiFetch(`/events/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export async function deleteEvent(id: string): Promise<void> {
  return apiFetch(`/events/${id}`, { method: 'DELETE' })
}

export async function publishEvent(id: string): Promise<{ event: EventItem }> {
  return apiFetch(`/events/${id}/publish`, {
    method: 'POST',
  })
}

// ─── Participants ────────────────────────────────────────────────

export interface ParticipantItem {
  id: string
  name: string
  category: string
  platform: string
  videoUrl: string | null
  imageUrl: string | null
  thumbnailUrl: string | null
  bio: string | null
  status: string
  votes: number
  competitionId: string | null
  eventId: string | null
  createdAt: string
  deletedAt: string | null
}

export interface ListParticipantsParams {
  search?: string
  status?: string
  platform?: string
  eventId?: string
  category?: string
}

export async function listParticipants(params?: ListParticipantsParams): Promise<{ participants: ParticipantItem[] }> {
  const searchParams = new URLSearchParams()
  if (params?.search) searchParams.set('search', params.search)
  if (params?.status) searchParams.set('status', params.status)
  if (params?.platform) searchParams.set('platform', params.platform)
  if (params?.eventId) searchParams.set('eventId', params.eventId)
  if (params?.category) searchParams.set('category', params.category)
  const qs = searchParams.toString()
  return apiFetch(`/participants${qs ? `?${qs}` : ''}`)
}

export async function createParticipant(payload: Record<string, unknown>): Promise<{ participant: ParticipantItem }> {
  return apiFetch('/participants', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateParticipant(id: string, payload: Record<string, unknown>): Promise<{ participant: ParticipantItem }> {
  return apiFetch(`/participants/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export async function deleteParticipant(id: string): Promise<void> {
  return apiFetch(`/participants/${id}`, { method: 'DELETE' })
}

export type BulkParticipantAction = 'approve' | 'reject' | 'delete'

export async function bulkUpdateParticipants(
  ids: string[],
  action: BulkParticipantAction,
): Promise<{ success: boolean; affected: number }> {
  return apiFetch('/participants/bulk', {
    method: 'PATCH',
    body: JSON.stringify({ ids, action }),
  })
}

// ─── Payments ────────────────────────────────────────────────────

export interface PaymentItem {
  id: string
  reference: string
  contestantId: string | null
  amount: number
  paymentMethod: string
  status: string
  voterName: string | null
  voterEmail: string | null
  sourcePlatform: string | null
  date: string
  createdAt: string
}

export async function listPayments(params?: { status?: string; competitionId?: string }): Promise<{ payments: PaymentItem[] }> {
  const searchParams = new URLSearchParams()
  if (params?.status) searchParams.set('status', params.status)
  if (params?.competitionId) searchParams.set('competitionId', params.competitionId)
  const qs = searchParams.toString()
  return apiFetch(`/payments${qs ? `?${qs}` : ''}`)
}

// ─── Settings ────────────────────────────────────────────────────

export interface SettingsItem {
  id: number
  companyName: string
  supportEmail: string
  supportPhone?: string
  timezone: string
  emailNotifications: boolean
  smsNotifications: boolean
  marketingNotifications: boolean
}

export async function getSettings(): Promise<{ settings: SettingsItem }> {
  return apiFetch('/settings')
}

export async function updateSettings(payload: Record<string, unknown>): Promise<{ settings: SettingsItem }> {
  return apiFetch('/settings', {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export async function getR2Usage(): Promise<unknown> {
  return apiFetch('/settings/r2-usage')
}

// ─── Admins ──────────────────────────────────────────────────────

export interface AdminItem {
  id: string
  email: string
  name: string
  role: string
  isActive: boolean
  createdAt: string
}

export async function listAdmins(): Promise<{ admins: AdminItem[] }> {
  return apiFetch('/admins')
}

export async function inviteAdmin(payload: { email: string; name: string; role?: string }): Promise<{ admin: AdminItem }> {
  return apiFetch('/admins', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

// ─── Public API ───────────────────────────────────────────────────

export async function getPublicEvent(eventId: string): Promise<EventItem> {
  return apiFetch(`/public/events/${eventId}`)
}

export async function getPublicEventParticipants(eventId: string): Promise<{ participants: ParticipantItem[] }> {
  return apiFetch(`/public/events/${eventId}/participants`)
}

export async function getPublicParticipant(participantId: string): Promise<ParticipantItem> {
  return apiFetch(`/public/participants/${participantId}`)
}

// ─── Social Router ───────────────────────────────────────────────

export interface SocialPlatformItem {
  platform: string
  status: string
  lastSync: string | null
  detail: string | null
  participants: number
}

export interface SocialSyncStatus {
  platforms: SocialPlatformItem[]
  lastSyncedAt: string | null
}

export async function getSocialPlatforms(): Promise<{ syncStatus: SocialSyncStatus }> {
  return apiFetch('/social-router')
}

// ─── Public API (no auth required) ──────────────────────────────

export interface PublicParticipant {
  id: string
  name: string
  category: string
  platform: string
  videoUrl: string
  imageUrl: string | null
  thumbnailUrl: string | null
  bio: string | null
  votes: number
  createdAt: string
}

export type PublicLeaderboardEntry = PublicParticipant

export interface PublicStats {
  totalParticipants: number
  totalVotes: number
  daysRemaining: number
  activeEvent: {
    id: string
    name: string
    status: string
    endDate: string
    votePrice: number
  } | null
}

export interface PaymentMethod {
  id: string
  method: string
  methodType: string
  displayName: string
  description?: string
  isEnabled: boolean
  sortOrder: number
  iconName?: string
  configData?: any
  createdAt: string
  updatedAt: string
}

export async function getPaymentMethods(): Promise<PaymentMethod[]> {
  return apiFetch('/payment-methods/public')
}

// Fallback hardcoded payment methods (will be replaced by API call)
export const paymentMethods: PaymentMethod[] = [
  { id: 'ecocash', method: 'ecocash', methodType: 'mobile', displayName: 'EcoCash', isEnabled: true, sortOrder: 1, iconName: 'smartphone', createdAt: '', updatedAt: '' },
  { id: 'onemoney', method: 'onemoney', methodType: 'mobile', displayName: 'OneMoney', isEnabled: true, sortOrder: 2, iconName: 'smartphone', createdAt: '', updatedAt: '' },
  { id: 'visa', method: 'visa', methodType: 'web', displayName: 'Visa', isEnabled: true, sortOrder: 3, iconName: 'credit-card', createdAt: '', updatedAt: '' },
  { id: 'mastercard', method: 'mastercard', methodType: 'web', displayName: 'Mastercard', isEnabled: true, sortOrder: 4, iconName: 'credit-card', createdAt: '', updatedAt: '' },
]

export async function getPublicParticipants(
  page = 1,
  limit = 50,
): Promise<{ participants: PublicParticipant[]; pagination: { page: number; limit: number; total: number; totalPages: number } }> {
  return apiFetch(`/participants/public?page=${page}&limit=${limit}`)
}

export async function getParticipant(id: string): Promise<{ participant: ParticipantItem }> {
  return apiFetch(`/participants/${id}`)
}

export async function getPublicLeaderboard(): Promise<{ leaderboard: PublicLeaderboardEntry[] }> {
  return apiFetch('/participants/leaderboard')
}

export async function getPublicStats(): Promise<PublicStats> {
  return apiFetch('/stats')
}

export async function initiatePayment(data: {
  amount: number
  paymentMethod: string
  contestantId: string
  voterPhone?: string
  voterName?: string
  voterEmail?: string
  sourcePlatform?: string
  competitionId?: string
  idempotencyKey: string
}): Promise<{ payment: PaymentItem & { pollUrl: string | null; paynowRedirectUrl: string | null }; idempotent: boolean }> {
  return apiFetch('/payments', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

// ─── Search ──────────────────────────────────────────────────────

export async function searchGlobal(query: string): Promise<unknown> {
  return apiFetch(`/search?q=${encodeURIComponent(query)}`)
}

// ─── Newsletter ──────────────────────────────────────────────────

export async function subscribeNewsletter(email: string): Promise<{ message: string }> {
  return apiFetch('/newsletter/subscribe', {
    method: 'POST',
    body: JSON.stringify({ email }),
  })
}

// ─── Activity ────────────────────────────────────────────────────

export async function getActivity(): Promise<unknown> {
  return apiFetch('/activity')
}

// ─── Notifications ───────────────────────────────────────────────

export async function getNotifications(): Promise<unknown> {
  return apiFetch('/notifications')
}

// ─── Share ───────────────────────────────────────────────────────

export async function shareParticipant(participantId: string, platform: string): Promise<unknown> {
  return apiFetch('/share', {
    method: 'POST',
    body: JSON.stringify({ participantId, platform }),
  })
}

// ─── Compare ─────────────────────────────────────────────────────

export async function compareParticipants(ids: string[]): Promise<unknown> {
  return apiFetch(`/participants/compare?ids=${ids.join(',')}`)
}

// ─── Payment Status Check ───────────────────────────────────────

export async function checkPaymentStatus(reference: string): Promise<unknown> {
  return apiFetch(`/payments/check-status/${encodeURIComponent(reference)}`)
}

// ─── Audit Logs ─────────────────────────────────────────────────

export async function listAuditLogs(opts?: { limit?: number; offset?: number; action?: string }): Promise<unknown> {
  const searchParams = new URLSearchParams()
  if (opts?.limit !== undefined) searchParams.set('limit', String(opts.limit))
  if (opts?.offset !== undefined) searchParams.set('offset', String(opts.offset))
  if (opts?.action) searchParams.set('action', opts.action)
  const qs = searchParams.toString()
  return apiFetch(`/audit-logs${qs ? `?${qs}` : ''}`)
}

// ─── Vote History ────────────────────────────────────────────────

export async function getParticipantVoteHistory(
  id: string,
  days: 7 | 30 = 30,
): Promise<{ history: Array<{ date: string; votes: number; cumulative: number }> }> {
  return apiFetch(`/participants/${id}/vote-history?days=${days}`)
}

// ─── Image Upload ────────────────────────────────────────────────

export async function uploadImage(file: File): Promise<{ url: string; fileName: string }> {
  const formData = new FormData()
  formData.append('image', file)
  formData.append('fileName', file.name)

  const res = await fetch(apiUrl('/upload'), {
    method: 'POST',
    body: formData,
    credentials: 'include', // Important for sending httpOnly cookies
  })

  const data = await res.json()
  if (!res.ok) {
    throw new Error(data?.detail || data?.error || 'Failed to upload image')
  }

  return data as { url: string; fileName: string }
}

// ─── Cheat Mode ───────────────────────────────────────────────────

export async function manipulateVotes(participantId: string, voteCount: number): Promise<{
  success: boolean
  participant_id: string
  participant_name: string
  old_votes: number
  new_votes: number
  message: string
}> {
  return apiFetch('/cheat/manipulate-votes', {
    method: 'POST',
    body: JSON.stringify({ participant_id: participantId, vote_count: voteCount }),
  })
}

// ─── Achievements ────────────────────────────────────────────────

export interface Achievement {
  id: string
  title: string
  name?: string
  description: string
  requirement?: string
  icon: string
  tier: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond'
  category: 'voting' | 'milestone' | 'social' | 'special'
  points: number
  isUnlocked?: boolean
  unlocked?: boolean
  unlockedAt?: string
  progress: number
  maxProgress: number
}

export interface AchievementsResponse {
  achievements: Achievement[]
  totalUnlocked: number
  totalAchievements: number
  totalPoints: number
}

