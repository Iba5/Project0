import type {
  ActivityRecord,
  DashboardSummary,
  EventRecord,
  NotificationRecord,
  ParticipantRecord,
  PaymentRecord,
  SettingsProfile,
  SocialPlatformRecord,
} from "@/lib/types"

export const initialEvents: EventRecord[] = [
  {
    id: "evt-001",
    name: "Summer Spotlight 2026",
    description: "A flagship creative showdown for the biggest fan vote of the season.",
    banner: "https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=1200&q=80",
    startDate: "2026-07-01",
    endDate: "2026-07-28",
    status: "Ongoing",
  },
  {
    id: "evt-002",
    name: "Campus Crown",
    description: "Regional campus contest with platform-driven voting and weekly eliminations.",
    banner: "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=1200&q=80",
    startDate: "2026-08-04",
    endDate: "2026-08-24",
    status: "Upcoming",
  },
  {
    id: "evt-003",
    name: "Night Stage Finals",
    description: "Archived finale event with completed vote processing and payouts.",
    banner: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=1200&q=80",
    startDate: "2026-05-12",
    endDate: "2026-06-02",
    status: "Expired",
  },
]

export const initialParticipants: ParticipantRecord[] = [
  {
    id: "part-001",
    name: "Mira Patel",
    category: "Dance",
    platform: "TikTok",
    videoUrl: "https://www.tiktok.com/@mira/video/1",
    status: "Active",
    votes: 12840,
  },
  {
    id: "part-002",
    name: "Jordan Lewis",
    category: "Singing",
    platform: "Instagram",
    videoUrl: "https://instagram.com/reel/abc123",
    status: "Active",
    votes: 9875,
  },
  {
    id: "part-003",
    name: "Anika Sharma",
    category: "Comedy",
    platform: "YouTube",
    videoUrl: "https://youtube.com/watch?v=demo",
    status: "Pending",
    votes: 6120,
  },
  {
    id: "part-004",
    name: "Chris Barnes",
    category: "Fashion",
    platform: "Facebook",
    videoUrl: "https://facebook.com/watch/demo",
    status: "Suspended",
    votes: 2101,
  },
]

export const initialPayments: PaymentRecord[] = [
  {
    id: "pay-001",
    reference: "VOTE-2026-1048",
    contestant: "Mira Patel",
    amountCents: 32000,
    currency: "USD",
    paymentMethod: "Stripe",
    status: "Successful",
    date: "2026-07-15T09:18:00Z",
  },
  {
    id: "pay-002",
    reference: "VOTE-2026-1059",
    contestant: "Jordan Lewis",
    amountCents: 14000,
    currency: "USD",
    paymentMethod: "PayPal",
    status: "Pending",
    date: "2026-07-15T11:02:00Z",
  },
  {
    id: "pay-003",
    reference: "VOTE-2026-1061",
    contestant: "Anika Sharma",
    amountCents: 25500,
    currency: "USD",
    paymentMethod: "Card",
    status: "Failed",
    date: "2026-07-14T18:30:00Z",
  },
]

export const initialActivity: ActivityRecord[] = [
  {
    id: "act-001",
    title: "Votes synchronized",
    detail: "Processed 1,250 TikTok votes for the active event.",
    time: "5 minutes ago",
  },
  {
    id: "act-002",
    title: "Payment captured",
    detail: "Successful payout batch completed for two contestants.",
    time: "18 minutes ago",
  },
  {
    id: "act-003",
    title: "Event published",
    detail: "Campus Crown moved to the upcoming schedule.",
    time: "1 hour ago",
  },
]

export const initialSocialStatus: SocialPlatformRecord[] = [
  {
    id: "soc-001",
    platform: "TikTok",
    status: "Connected",
    lastSync: "2 minutes ago",
    detail: "Realtime vote sync is active and healthy.",
  },
  {
    id: "soc-002",
    platform: "Facebook",
    status: "Syncing",
    lastSync: "Now",
    detail: "Queued metadata updates are being processed.",
  },
  {
    id: "soc-003",
    platform: "Instagram",
    status: "Failed",
    lastSync: "26 minutes ago",
    detail: "The last payload was rejected during processing.",
  },
  {
    id: "soc-004",
    platform: "YouTube",
    status: "Disconnected",
    lastSync: "3 hours ago",
    detail: "Reconnect required before vote aggregation can continue.",
  },
]

export const initialDashboardSummary: DashboardSummary = {
  activeEvent: "Summer Spotlight 2026",
  totalParticipants: initialParticipants.length,
  totalVotes: 145280,
  totalRevenue: "$24,480",
  recentPayments: initialPayments,
  recentActivity: initialActivity,
}

export const initialNotifications: NotificationRecord[] = [
  {
    id: "notif-001",
    title: "New vote batch synced",
    detail: "1,250 votes were processed in the active event.",
    route: "/dashboard",
    read: false,
    time: "5 minutes ago",
  },
  {
    id: "notif-002",
    title: "Payment review needed",
    detail: "One settlement is pending manual confirmation.",
    route: "/payments",
    read: false,
    time: "18 minutes ago",
  },
  {
    id: "notif-003",
    title: "Instagram sync failed",
    detail: "The system should retry the latest social payload.",
    route: "/social-router",
    read: true,
    time: "1 hour ago",
  },
]

export const initialSettings: SettingsProfile = {
  companyName: "VibeWave Admin",
  supportEmail: "support@vibewave.example",
  timezone: "Asia/Kolkata",
  notifications: {
    email: true,
    sms: false,
    marketing: false,
  },
}
