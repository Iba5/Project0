export type UserRole = "Super Admin" | "Admin" | "Moderator"

export type EventStatus =
  | "Draft"
  | "Published"
  | "Cancelled"
  | "Archived"

export type ComputedEventStatus =
  | "Draft"
  | "Published"
  | "Cancelled"
  | "Archived"
  | "Upcoming"
  | "Registration Open"
  | "Voting Open"
  | "Voting Closed"
  | "Completed"

export type ContestantStatus =
  | "Draft"
  | "Submitted"
  | "Under Review"
  | "Approved"
  | "Rejected"
  | "Disqualified"
  | "Archived"

export type PaymentStatus =
  | "Created"
  | "Pending"
  | "Processing"
  | "Paid"
  | "Failed"
  | "Cancelled"
  | "Refunded"
  | "Expired"

export type SocialPlatformType = "TikTok" | "Facebook" | "Instagram" | "YouTube"

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
  | "admin-social-router"
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

export type ParticipantRecord = {
  id: string
  name: string
  category: string
  platform: SocialPlatformType
  videoUrl: string | null
  imageUrl: string | null
  thumbnailUrl: string | null
  bio: string | null
  status: ContestantStatus
  votes: number
  eventId: string | null
  competitionId: string | null
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

export type DashboardSummary = {
  activeEvent: string
  totalParticipants: number
  totalVotes: number
  totalRevenue: string
  recentPayments: PaymentRecord[]
  recentActivity: ActivityRecord[]
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

export type SocialPlatformStatus = {
  id: string
  platform: string
  status: "Connected" | "Syncing" | "Failed" | "Disconnected"
  lastSync: string | null
  detail: string | null
}
