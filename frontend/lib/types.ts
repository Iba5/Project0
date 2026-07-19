export type UserRole = "Super Admin" | "Admin" | "Moderator"

export type EventStatus =
  | "Draft"
  | "Upcoming"
  | "Registration Open"
  | "Voting Open"
  | "Voting Closed"
  | "Completed"
  | "Archived"

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

export type EventRecord = {
  id: string
  name: string
  description: string | null
  banner: string | null
  startDate: string
  endDate: string
  status: EventStatus
  votePrice: number
  votesPerPayment: number
  currency: string
  votingOpens: string | null
  votingCloses: string | null
  publicLeaderboard: boolean
  allowedCategories: string
  allowedPlatforms: string
}

export type ParticipantRecord = {
  id: string
  name: string
  category: string
  platform: SocialPlatformType
  videoUrl: string
  status: ContestantStatus
  votes: number
  bio: string | null
  imageUrl: string | null
  eventId: string | null
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

export type ViewName =
  | "landing"
  | "contestants"
  | "contestant-detail"
  | "payment"
  | "leaderboard"
  | "admin-login"
  | "admin-dashboard"
  | "admin-events"
  | "admin-participants"
  | "admin-payments"
  | "admin-admins"
  | "admin-settings"
  | "admin-social-router"
  | "admin-forgot-password"

export type SocialPlatformStatus = {
  id: string
  platform: string
  status: "Connected" | "Syncing" | "Failed" | "Disconnected"
  lastSync: string
  detail: string
}