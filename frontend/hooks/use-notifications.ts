'use client'

import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'

export type NotificationPermissionState = 'default' | 'granted' | 'denied'

export interface ShowNotificationOptions {
  body?: string
  icon?: string
  badge?: string
  tag?: string
  data?: unknown
  /** Sonner toast variant to use as fallback when notifications are denied/unsupported. */
  fallbackVariant?: 'default' | 'success' | 'error' | 'warning' | 'info'
  /** Optional sonner toast id (so callers can update/dismiss it later). */
  toastId?: string | number
}

/**
 * SSR-safe wrapper around the browser Notification API.
 *
 * - Exposes the current `permission` state and refreshes it on mount.
 * - `requestPermission()` triggers the browser permission prompt.
 * - `showNotification()` shows a native notification when permission is granted,
 *   otherwise it gracefully falls back to a sonner toast so the user always
 *   receives the signal even after denying (or on browsers without support).
 * - `showMilestoneNotification()` is a thin convenience wrapper for the
 *   "X reached Y votes" milestone pattern used across Phase 9.
 *
 * All paths are SSR-safe (`typeof window !== 'undefined'` checks) so the hook
 * can be called from any client component without hydration issues.
 */
export function useNotifications() {
  // Lazy initializer so the permission state is read once on the client
  // during the first render — no synchronous setState in an effect, no
  // cascading renders. Falls back to 'default' on SSR / unsupported browsers.
  const [permission, setPermission] = useState<NotificationPermissionState>(
    () => {
      if (typeof window === 'undefined') return 'default'
      if (!('Notification' in window)) return 'default'
      return Notification.permission as NotificationPermissionState
    },
  )
  const [hasMounted, setHasMounted] = useState(false)

  // Refresh the cached permission when the window regains focus (e.g. the
  // user grants/denies from browser settings and returns to the tab).
  // setState is only called inside the event handler, never synchronously
  // in the effect body, so this is compliant with the lint rule.
  useEffect(() => {
    setHasMounted(true)

    if (typeof window === 'undefined') return
    if (!('Notification' in window)) return

    const handleVisibility = () => {
      const current = Notification.permission as NotificationPermissionState
      setPermission((prev) => (prev === current ? prev : current))
    }

    window.addEventListener('focus', handleVisibility)
    return () => window.removeEventListener('focus', handleVisibility)
  }, [])

  const requestPermission = useCallback(async (): Promise<NotificationPermissionState> => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'denied'
    }
    try {
      const result = await Notification.requestPermission()
      setPermission(result as NotificationPermissionState)
      return result as NotificationPermissionState
    } catch {
      return 'denied'
    }
  }, [])

  const showNotification = useCallback(
    (
      title: string,
      body?: string,
      options: ShowNotificationOptions = {},
    ) => {
      const {
        icon,
        badge,
        tag,
        data,
        fallbackVariant = 'default',
        toastId,
      } = options

      // Try a native notification first when explicitly granted.
      if (
        typeof window !== 'undefined' &&
        'Notification' in window &&
        Notification.permission === 'granted'
      ) {
        try {
          const native = new Notification(title, {
            body,
            icon,
            badge,
            tag,
            data: data as NotificationOptions['data'],
          })
          // Auto-close after 6 seconds to avoid lingering notifications.
          setTimeout(() => native.close(), 6000)
          return
        } catch {
          // Fall through to toast fallback below.
        }
      }

      // Fallback: sonner toast (works on unsupported / denied browsers).
      const message = body ? `${title}\n${body}` : title
      switch (fallbackVariant) {
        case 'success':
          toast.success(message, { id: toastId })
          break
        case 'error':
          toast.error(message, { id: toastId })
          break
        case 'warning':
          toast.warning(message, { id: toastId })
          break
        case 'info':
          toast.info(message, { id: toastId })
          break
        default:
          toast(message, { id: toastId })
      }
    },
    [],
  )

  const showMilestoneNotification = useCallback(
    (
      participantName: string,
      totalVotes: number,
      milestone: number,
    ) => {
      const title = `🏆 ${participantName} reached ${milestone.toLocaleString()} votes!`
      const body = `They're now at ${totalVotes.toLocaleString()} total votes. Keep it going!`
      showNotification(title, body, {
        tag: `milestone-${participantName}-${milestone}`,
        fallbackVariant: 'success',
      })
    },
    [showNotification],
  )

  const isSupported =
    typeof window !== 'undefined' && 'Notification' in window

  return {
    isSupported,
    isReady: hasMounted,
    permission,
    requestPermission,
    showNotification,
    showMilestoneNotification,
  }
}
