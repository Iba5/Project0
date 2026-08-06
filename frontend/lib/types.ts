export type UserRole = "super_admin" | "admin" | "moderator"

export type EventStatus =
  | "draft"
  | "published"
  | "cancelled"
  | "archived"

export type ComputedEventStatus =
  | "draft"
  | "published"
  | "cancelled"
  | "archived"
  | "upcoming"
  | "registration_open"
  | "voting_open"
  | "voting_closed"
  | "completed"

export type ContestantStatus =
  | "approved"
  | "disqualified"

export type PaymentStatus =
  | "created"
  | "pending"
  | "processing"
  | "paid"
  | "failed"
  | "cancelled"
  | "refunded"
  | "expired"

export type ViewName =
  | "landing"
  | "contestants"
  | "contestant-detail"
  | "leaderboard"
  | "events"
  | "payment"
  | "top-voters"
  | "favorites"
  | "admin-login"
  | "admin-dashboard"
  | "admin-events"
  | "admin-participants"
  | "admin-payments"
  | "admin-admins"
  | "admin-settings"
  | "admin-forgot-password"
  | "compare"
  | "notifications"

export type EventRecord = {
  id: string
  name: string
  description: string | null
  banner: string | null
  startDate: string
  endDate: string
  status: EventStatus
  computedStatus?: ComputedEventStatus
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
}

export type PaymentConfiguration = {
  votePrice: number
  minimumPayment: number
  currency: string
  votingOpen: boolean
}

export type ParticipantRecord = {
  id: string
  name: string
  category: string
  videoUrl: string | null
  imageUrl: string | null
  thumbnailUrl: string | null
  bio: string | null
  status: ContestantStatus
  votes: number
  eventId: string
  paymentConfiguration?: PaymentConfiguration
}

export type PaymentRecord = {
  id: string
  reference: string
  contestantId: string | null
  contestantName?: string
  amount: number
  paymentMethod: string
  status: PaymentStatus
  date: string
}

export type VoterMeResponse = {
  user: {
    id: string
    name: string
    email: string
    role: string
  }
  voterProfile: {
    id: string
    phone: string | null
    votesCount: number
  }
  totalSpent: number
  totalVotes: number
  votedContestantsCount: number
  favoriteCategory: string | null
  votedContestants: Array<{
    id: string
    name: string
    category: string | null
    imageUrl: string | null
    thumbnailUrl: string | null
    totalVotes: number
    totalSpent: number
  }>
  recentVotes: Array<{
    id: string
    date: string
    contestantName: string
    contestantId: string | null
    amount: number
    status: string
    paymentMethod: string
  }>
}

export type ActivityRecord = {
  id: string
  title: string
  detail: string | null
  time: string
}

export type AuthResult = {
  token: string
  user: {
    id: string
    name: string
    email: string
    role: UserRole
  }
  message: string
}

export type SettingsProfile = {
  companyName: string
  supportEmail: string
  timezone: string
  notifications: {
    email: boolean
    sms: boolean
    marketing: boolean
  }
}

export type PaymentMethodOption = {
  id: string
  name: string
  type: "mobile_money" | "card" | "digital_wallet"
  isPrimary?: boolean
}
