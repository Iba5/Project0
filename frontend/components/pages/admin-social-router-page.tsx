'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { RefreshCw, CheckCircle2, AlertCircle, Loader2, Unplug, Info } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { getSocialPlatforms, type SocialPlatformApi } from '@/lib/api'

const platformIcons: Record<string, React.ReactNode> = {
  TikTok: (
    <svg viewBox="0 0 24 24" className="size-5" fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 0 0-.79-.05A6.34 6.34 0 0 0 3.15 15.2a6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.98a8.22 8.22 0 0 0 4.76 1.52V7.05a4.83 4.83 0 0 1-1-.36z" />
    </svg>
  ),
  Facebook: (
    <svg viewBox="0 0 24 24" className="size-5" fill="currentColor">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  ),
  Instagram: (
    <svg viewBox="0 0 24 24" className="size-5" fill="currentColor">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z" />
    </svg>
  ),
  YouTube: (
    <svg viewBox="0 0 24 24" className="size-5" fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  ),
}

const platformColors: Record<string, string> = {
  TikTok: '#000000',
  Facebook: '#1877F2',
  Instagram: '#E4405F',
  YouTube: '#FF0000',
}

function statusConfig(status: string) {
  switch (status) {
    case 'Connected':
      return {
        badge: <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800">Connected</Badge>,
        icon: <CheckCircle2 className="size-5 text-emerald-600 dark:text-emerald-400" />,
        action: 'Sync Now',
        actionVariant: 'outline' as const,
      }
    case 'Syncing':
      return {
        badge: <Badge className="bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-50 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800">Syncing</Badge>,
        icon: <Loader2 className="size-5 text-amber-600 dark:text-amber-400 animate-spin" />,
        action: 'Syncing…',
        actionVariant: 'outline' as const,
        actionDisabled: true,
      }
    case 'Failed':
      return {
        badge: <Badge className="bg-red-50 text-red-700 border-red-200 hover:bg-red-50 dark:bg-red-950 dark:text-red-400 dark:border-red-800">Failed</Badge>,
        icon: <AlertCircle className="size-5 text-red-600 dark:text-red-400" />,
        action: 'Retry',
        actionVariant: 'outline' as const,
      }
    case 'Disconnected':
      return {
        badge: <Badge variant="secondary">Disconnected</Badge>,
        icon: <Unplug className="size-5 text-muted-foreground" />,
        action: 'Reconnect',
        actionVariant: 'default' as const,
      }
    default:
      return {
        badge: <Badge variant="secondary">{status}</Badge>,
        icon: null,
        action: 'Sync Now',
        actionVariant: 'outline' as const,
      }
  }
}

function timeAgo(dateStr: string): string {
  const now = new Date()
  const date = new Date(dateStr)
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'Just now'
  if (diffMin < 60) return `${diffMin} minute${diffMin > 1 ? 's' : ''} ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr} hour${diffHr > 1 ? 's' : ''} ago`
  const diffDay = Math.floor(diffHr / 24)
  return `${diffDay} day${diffDay > 1 ? 's' : ''} ago`
}

export function AdminSocialRouterPage() {
  const [platforms, setPlatforms] = useState<SocialPlatformApi[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const fetchPlatforms = async () => {
      try {
        const data = await getSocialPlatforms()
        if (!cancelled) setPlatforms(data.items)
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : 'Failed to fetch platforms')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchPlatforms()
    return () => { cancelled = true }
  }, [])

  if (loading) {
    return (
      <>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      </>
    )
  }

  return (
    <>
      <motion.div
        className="space-y-6 max-w-4xl"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
      >
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Social Platforms</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage connections to social media platforms where contestants post their performance videos.
          </p>
        </div>

        {/* Info callout */}
        <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3">
          <Info className="size-4 text-muted-foreground mt-0.5 shrink-0" />
          <p className="text-sm text-muted-foreground">
            Connected platforms automatically pull video metadata and thumbnails for contestant profiles. Votes are cast on this platform — we only read public video data from social media.
          </p>
        </div>

        {/* Platform cards */}
        <div className="grid gap-4 sm:grid-cols-2">
          {platforms.map((sp) => {
            const cfg = statusConfig(sp.status)
            const color = platformColors[sp.platform] ?? '#78716C'

            return (
              <motion.div
                key={sp.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.05 }}
                className="rounded-lg border border-border p-5 transition-colors hover:bg-muted/30"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    {/* Platform icon */}
                    <div
                      className="flex size-10 items-center justify-center rounded-lg"
                      style={{ backgroundColor: color + '15', color }}
                    >
                      {platformIcons[sp.platform] ?? null}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{sp.platform}</h3>
                        {cfg.badge}
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Last sync: {sp.lastSync ? timeAgo(sp.lastSync) : 'Never'}
                      </p>
                    </div>
                  </div>
                  {cfg.icon}
                </div>

                <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                  {sp.detail}
                </p>

                <div className="mt-4 flex items-center justify-between">
                  <Button
                    size="sm"
                    variant={cfg.actionVariant}
                    disabled={'actionDisabled' in cfg}
                    className="rounded-full gap-1.5"
                  >
                    <RefreshCw className="size-3.5" />
                    {cfg.action}
                  </Button>
                </div>
              </motion.div>
            )
          })}
        </div>
      </motion.div>
    </>
  )
}