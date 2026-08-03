import { create } from 'zustand'

// ─── Types ────────────────────────────────────────────────────────

export type NotificationType =
  | 'vote_received'
  | 'milestone_reached'
  | 'event_starting'
  | 'event_closing'
  | 'contestant_update'

export interface Notification {
  id: string
  type: NotificationType
  title: string
  message: string
  timestamp: number
  read: boolean
  link?: string
}

// ─── Constants ────────────────────────────────────────────────────

const STORAGE_KEY = 'vibe-hub-notifications'
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000 // 7 days
const MAX_NOTIFICATIONS = 50

// ─── Helpers ──────────────────────────────────────────────────────

function generateId(): string {
  return `notif-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function pruneOldNotifications(notifications: Notification[]): Notification[] {
  const cutoff = Date.now() - MAX_AGE_MS
  return notifications.filter((n) => n.timestamp > cutoff)
}

function loadFromStorage(): Notification[] {
  if (typeof window === 'undefined') return []
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (!stored) return []
    const parsed = JSON.parse(stored)
    if (!Array.isArray(parsed)) return []
    const valid = parsed.filter(
      (n: unknown): n is Notification =>
        typeof n === 'object' &&
        n !== null &&
        typeof (n as Notification).id === 'string' &&
        typeof (n as Notification).type === 'string' &&
        typeof (n as Notification).title === 'string' &&
        typeof (n as Notification).message === 'string' &&
        typeof (n as Notification).timestamp === 'number' &&
        typeof (n as Notification).read === 'boolean',
    )
    return pruneOldNotifications(valid)
  } catch {
    return []
  }
}

function saveToStorage(notifications: Notification[]): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications))
  } catch {
    // Ignore quota / serialization errors
  }
}

// ─── Store Interface ──────────────────────────────────────────────

interface NotificationStore {
  notifications: Notification[]
  addNotification: (payload: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void
  markAsRead: (id: string) => void
  markAllAsRead: () => void
  clearAll: () => void
  getUnreadCount: () => number
}

// ─── Store ────────────────────────────────────────────────────────

export const useNotificationStore = create<NotificationStore>((set, get) => ({
  notifications: loadFromStorage(),

  addNotification: (payload) => {
    const notification: Notification = {
      ...payload,
      id: generateId(),
      timestamp: Date.now(),
      read: false,
    }
    set((state) => {
      const updated = pruneOldNotifications([notification, ...state.notifications]).slice(
        0,
        MAX_NOTIFICATIONS,
      )
      saveToStorage(updated)
      return { notifications: updated }
    })
  },

  markAsRead: (id) => {
    set((state) => {
      const updated = state.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n,
      )
      saveToStorage(updated)
      return { notifications: updated }
    })
  },

  markAllAsRead: () => {
    set((state) => {
      const updated = state.notifications.map((n) => ({ ...n, read: true }))
      saveToStorage(updated)
      return { notifications: updated }
    })
  },

  clearAll: () => {
    saveToStorage([])
    set({ notifications: [] })
  },

  getUnreadCount: () => {
    return get().notifications.filter((n) => !n.read).length
  },
}))

// Persist to localStorage on every change
if (typeof window !== 'undefined') {
  useNotificationStore.subscribe((state, prevState) => {
    if (state.notifications === prevState.notifications) return
    saveToStorage(state.notifications)
  })
}
