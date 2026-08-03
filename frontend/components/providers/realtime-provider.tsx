'use client'

import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import { getApiBaseUrl } from '@/lib/api-client'

const RealtimeContext = createContext<Socket | null>(null)

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const socketRef = useRef<Socket | null>(null)
  const [socket, setSocket] = useState<Socket | null>(null)

  useEffect(() => {
    // Extract base origin (e.g. "http://localhost:8000") without any path suffix like "/api/v1"
    const rawApiUrl = getApiBaseUrl()
    let socketOrigin = rawApiUrl

    try {
      const urlObj = new URL(rawApiUrl)
      socketOrigin = urlObj.origin
    } catch {
      // Fallback if rawApiUrl is relative or invalid
      socketOrigin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8000'
    }

    // Connect to the FastAPI backend's WebSocket server root.
    // This is created ONCE for the whole app — individual views/hooks
    // consume this shared connection via useRealtime() instead of each
    // opening their own socket.
    const s = io(socketOrigin, {
      path: '/socket.io', // Standard Socket.io server path
      transports: ['websocket', 'polling'], // Try websocket first, fallback to polling
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
      withCredentials: true,
    })

    s.on('connect', () => {
      console.log('[Realtime] Connected:', s.id)
    })

    s.on('disconnect', (reason) => {
      console.log('[Realtime] Disconnected:', reason)
    })

    s.on('connect_error', (error: any) => {
    console.warn('[Realtime] Connection error:', {
      message: error?.message,
      description: error?.description,
      context: error?.context,
      type: error?.type,
    })  
  })

    socketRef.current = s
    setSocket(s)

    return () => {
      s.disconnect()
      socketRef.current = null
    }
  }, [])

  return <RealtimeContext.Provider value={socket}>{children}</RealtimeContext.Provider>
}

/** Internal — use the `useRealtime()` hook in `hooks/use-realtime.ts` instead. */
export function useRealtimeSocket() {
  return useContext(RealtimeContext)
}
