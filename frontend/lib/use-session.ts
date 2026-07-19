'use client'
import { useEffect, useState, useCallback } from 'react'

export type AdminUser = {
  id: string; name: string; email: string; role: string
} | null

export function useSession() {
  const [user, setUser] = useState<AdminUser>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me')
      if (res.ok) {
        const data = await res.json()
        setUser(data.user)
      } else {
        setUser(null)
      }
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  return { user, loading, refresh }
}