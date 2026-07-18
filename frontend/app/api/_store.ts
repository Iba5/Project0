import {
  initialActivity,
  initialEvents,
  initialNotifications,
  initialParticipants,
  initialPayments,
  initialSettings,
  initialSocialStatus,
} from "@/lib/mock-data"
import type { ActivityRecord, EventRecord, NotificationRecord, ParticipantRecord, SettingsProfile, SocialPlatformRecord } from "@/lib/types"

export const store = {
  events: structuredClone(initialEvents),
  participants: structuredClone(initialParticipants),
  payments: structuredClone(initialPayments),
  activity: structuredClone(initialActivity),
  social: structuredClone(initialSocialStatus),
  settings: structuredClone(initialSettings),
  notifications: structuredClone(initialNotifications),
}

// Updates a stored event record and keeps the list ordered by start date.
export function upsertEvent(input: EventRecord) {
  const index = store.events.findIndex((event) => event.id === input.id)

  if (index >= 0) {
    store.events[index] = input
    return input
  }

  store.events.unshift(input)
  return input
}

// Updates or inserts a participant record into the local store.
export function upsertParticipant(input: ParticipantRecord) {
  const index = store.participants.findIndex((p) => p.id === input.id)

  if (index >= 0) {
    store.participants[index] = input
    return input
  }

  store.participants.unshift(input)
  return input
}

// Persists a simple settings payload for the local storage mode.
export function updateSettings(input: SettingsProfile) {
  store.settings = input
  return store.settings
}

// Updates the social sync items to mirror manual refresh actions.
export function updateSocialStatus(input: SocialPlatformRecord[]) {
  store.social = input
  return store.social
}

// Prepends a human-readable activity item so dashboard recency stays useful.
export function recordActivity(title: string, detail: string) {
  const item: ActivityRecord = {
    id: `act-${Date.now()}`,
    title,
    detail,
    time: "Just now",
  }

  store.activity.unshift(item)
  store.activity = store.activity.slice(0, 8)

  return item
}

// Builds the dashboard payload from the live mock store values.
export function buildDashboardSummary() {
  const activeEvent = store.events.find((event) => event.status === "Ongoing") ?? store.events[0]
  const totalVotes = store.participants.reduce((sum, participant) => sum + participant.votes, 0)
  const totalRevenue = store.payments.reduce((sum, payment) => {
    return sum + (Number.isFinite(payment.amountCents) ? payment.amountCents / 100 : 0)
  }, 0)

  return {
    activeEvent: activeEvent?.name ?? "No active event",
    totalParticipants: store.participants.length,
    totalVotes,
    totalRevenue: new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(totalRevenue),
    recentPayments: store.payments.slice(0, 3),
    recentActivity: store.activity.slice(0, 3),
  }
}
