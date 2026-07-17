export type ApiErrorShape = {
  message: string
  hint?: string
  status?: number
}

export type DashboardSummary = {
  activeEvent: string
  totalParticipants: number
  totalVotes: number
  totalRevenue: string
  recentPayments: PaymentRecord[]
  recentActivity: ActivityRecord[]
}

export type EventStatus = "Upcoming" | "Ongoing" | "Expired"

export type EventRecord = {
  id: string
  name: string
  description: string
  banner: string
  startDate: string
  endDate: string
  status: EventStatus
}

export type ParticipantStatus = "Active" | "Pending" | "Suspended"

export type ParticipantRecord = {
  id: string
  name: string
  category: string
  platform: "TikTok" | "Facebook" | "Instagram" | "YouTube"
  videoUrl: string
  status: ParticipantStatus
  votes: number
}

export type PaymentStatus = "Pending" | "Successful" | "Failed"

export type PaymentRecord = {
  id: string
  reference: string
  contestant: string
  amountCents: number
  currency: string
  paymentMethod: string
  status: PaymentStatus
  date: string
}

export type ActivityRecord = {
  id: string
  title: string
  detail: string
  time: string
}

export type SocialStatus = "Connected" | "Syncing" | "Failed" | "Disconnected"

export type SocialPlatformRecord = {
  id: string
  platform: "TikTok" | "Facebook" | "Instagram" | "YouTube"
  status: SocialStatus
  lastSync: string
  detail: string
}

export type AuthResult = {
  token: string
  user: {
    id: string
    name: string
    email: string
    role: string
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

export type NotificationRecord = {
  id: string
  title: string
  detail: string
  route: string
  read: boolean
  time: string
}
