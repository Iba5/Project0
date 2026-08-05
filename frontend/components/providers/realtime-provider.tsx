'use client'

import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import { getApiBaseUrl } from '@/lib/api-client'

// ─── Connection status types ──────────────────────────────────────

export type RealtimeStatus =
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'error'
  | 'polling' // fallback polling mode

export interface RealtimeState {
  socket: Socket | null
  status: RealtimeStatus
  /** True when the Socket.IO transport failed and the app is polling */
  isPollingFallback: boolean
  /** Last error message, if any */
  lastError: string | null
  /** Number of consecutive connection failures */
  failureCount: number
}

// ─── Context ─────────────────────────────────────────────────────

interface RealtimeContextValue extends RealtimeState {
  /** Force a manual reconnect attempt */
  reconnect: () => void
}

const RealtimeContext = createContext<RealtimeContextValue>({
  socket: null,
  status: 'connecting',
  isPollingFallback: false,
  lastError: null,
  failureCount: 0,
  reconnect: () => {},
})

// ─── Polling fallback ─────────────────────────────────────────────

const POLLING_INTERVAL_MS = 15_000 // 15 s
const MAX_FAILURES_BEFORE_POLLING = 3

// ─── Provider ─────────────────────────────────────────────────────

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const socketRef = useRef<Socket | null>(null)
  const pollingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const failureCountRef = useRef(0)

  const [state, setState] = useState<RealtimeState>({
    socket: null,
    status: 'connecting',
    isPollingFallback: false,
    lastError: null,
    failureCount: 0,
  })

  // ── Polling fallback: broadcast a custom DOM event every N seconds ──
  const startPollingFallback = useCallback(() => {
    if (pollingTimerRef.current) return // already running
    console.warn('[Realtime] Switching to polling fallback (Socket.IO unavailable)')

    setState((prev) => ({ ...prev, status: 'polling', isPollingFallback: true }))

    pollingTimerRef.current = setInterval(() => {
      // Dispatch a custom event that any hook/component can listen to
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('realtime:poll'))
      }
    }, POLLING_INTERVAL_MS)
  }, [])

  const stopPollingFallback = useCallback(() => {
    if (pollingTimerRef.current) {
      clearInterval(pollingTimerRef.current)
      pollingTimerRef.current = null
    }
  }, [])

  // ── Socket initialisation ──────────────────────────────────────
  const initSocket = useCallback(() => {
    // Clean up any existing socket first
    if (socketRef.current) {
      socketRef.current.disconnect()
      socketRef.current = null
    }

    const rawApiUrl = getApiBaseUrl()
    let socketOrigin = rawApiUrl

    try {
      const urlObj = new URL(rawApiUrl)
      socketOrigin = urlObj.origin
    } catch {
      socketOrigin =
        typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8000'
    }

    setState((prev) => ({
      ...prev,
      status: 'connecting',
      lastError: null,
    }))

    const s = io(socketOrigin, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10_000,
      withCredentials: true,
    })

    // ── connect ──
    s.on('connect', () => {
      console.log('[Realtime] Connected:', s.id)
      failureCountRef.current = 0
      stopPollingFallback()
      setState({
        socket: s,
        status: 'connected',
        isPollingFallback: false,
        lastError: null,
        failureCount: 0,
      })
    })

    // ── disconnect ──
    s.on('disconnect', (reason) => {
      console.warn('[Realtime] Disconnected:', reason)
      setState((prev) => ({
        ...prev,
        status: 'disconnected',
        lastError: `Disconnected: ${reason}`,
      }))

      // Socket.IO will auto-reconnect for most reasons.
      // For explicit server-side disconnects we start polling immediately.
      if (reason === 'io server disconnect' || reason === 'transport close') {
        failureCountRef.current += 1
        if (failureCountRef.current >= MAX_FAILURES_BEFORE_POLLING) {
          startPollingFallback()
        }
      }
    })

    // ── connect_error ──
    s.on('connect_error', (error) => {
      failureCountRef.current += 1
      const message = error?.message ?? 'Unknown connection error'

      const errObj = error as unknown as Record<string, unknown>
      console.warn('[Realtime] Connection error:', {
        message,
        description: errObj?.description,
        context: errObj?.context,
        type: errObj?.type,
        failureCount: failureCountRef.current,
      })

      setState((prev) => ({
        ...prev,
        status: 'error',
        lastError: message,
        failureCount: failureCountRef.current,
      }))

      // After N consecutive failures, activate polling so the app
      // continues to receive fresh data without a live socket.
      if (failureCountRef.current >= MAX_FAILURES_BEFORE_POLLING) {
        startPollingFallback()
      }
    })

    // ── reconnect_failed ──
    s.io.on('reconnect_failed', () => {
      console.error('[Realtime] All reconnection attempts exhausted — activating polling fallback')
      setState((prev) => ({
        ...prev,
        status: 'error',
        lastError: 'Could not reconnect to realtime server',
        isPollingFallback: true,
      }))
      startPollingFallback()
    })

    // ── reconnect ──
    s.io.on('reconnect', (attempt: number) => {
      console.log('[Realtime] Reconnected after', attempt, 'attempt(s)')
      failureCountRef.current = 0
      stopPollingFallback()
      setState((prev) => ({
        ...prev,
        status: 'connected',
        isPollingFallback: false,
        lastError: null,
        failureCount: 0,
      }))
    })

    socketRef.current = s
    setState((prev) => ({ ...prev, socket: s }))

    return s
  }, [startPollingFallback, stopPollingFallback])

  // ── Manual reconnect exposed to consumers ──
  const reconnect = useCallback(() => {
    failureCountRef.current = 0
    stopPollingFallback()
    initSocket()
  }, [initSocket, stopPollingFallback])

  // ── Lifecycle ──
  useEffect(() => {
    initSocket()
    return () => {
      socketRef.current?.disconnect()
      socketRef.current = null
      stopPollingFallback()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const contextValue: RealtimeContextValue = {
    ...state,
    reconnect,
  }

  return (
    <RealtimeContext.Provider value={contextValue}>{children}</RealtimeContext.Provider>
  )
}

// ─── Hooks ────────────────────────────────────────────────────────

/** Internal — use the `useRealtime()` hook in `hooks/use-realtime.ts` instead. */
export function useRealtimeSocket() {
  return useContext(RealtimeContext).socket
}

/**
 * Full realtime state — connection status, polling fallback flag,
 * last error message, and a manual reconnect trigger.
 */
export function useRealtimeState(): RealtimeContextValue {
  return useContext(RealtimeContext)
}
