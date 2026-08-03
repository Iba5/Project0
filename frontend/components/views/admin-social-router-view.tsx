'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { getSocialPlatforms, type SocialPlatformItem } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { RefreshCw, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'

function platformIcon(platform: string) {
  const icons: Record<string, string> = {
    TikTok: '🎵',
    Facebook: '📘',
    Instagram: '📷',
    YouTube: '▶️',
  }
  return icons[platform] || '🔗'
}

function syncStatusBadge(status: string) {
  switch (status) {
    case 'Connected':
      return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30">Connected</Badge>
    case 'Syncing':
      return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 hover:bg-amber-500/30">Syncing</Badge>
    case 'Failed':
      return <Badge className="bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/30">Failed</Badge>
    case 'Disconnected':
    default:
      return <Badge className="bg-slate-500/20 text-slate-400 border-slate-500/30 hover:bg-slate-500/30">Disconnected</Badge>
  }
}

export function AdminSocialRouterView() {
  const [platforms, setPlatforms] = useState<SocialPlatformItem[]>([])
  const [loading, setLoading] = useState(true)
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null)

  useEffect(() => {
    getSocialPlatforms()
      .then(({ syncStatus }) => {
        setPlatforms(syncStatus.platforms)
        setLastSyncedAt(syncStatus.lastSyncedAt)
      })
      .catch(() => {
        toast.error('Failed to fetch social platforms')
      })
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Social Router</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          Monitor social platform sync status
          {lastSyncedAt && (
            <span className="ml-2" style={{ color: 'var(--text-muted)' }}>
              · Last synced {new Date(lastSyncedAt).toLocaleString()}
            </span>
          )}
        </p>
      </motion.div>

      {/* Platform Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {loading ? (
          [...Array(4)].map((_, i) => (
            <Card
              key={i}
              className="rounded-xl border"
              style={{
                background: 'var(--surface-1)',
                borderColor: 'var(--border-subtle)',
              }}
            >
              <CardContent className="p-6">
                <div className="h-28 rounded" style={{ background: 'var(--surface-3)' }} />
              </CardContent>
            </Card>
          ))
        ) : (
          platforms.map((p, i) => (
            <motion.div
              key={p.platform}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
            >
              <Card
                className="rounded-xl border hover-lift"
                style={{
                  background: 'var(--surface-1)',
                  borderColor: 'var(--border-subtle)',
                }}
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                        style={{ background: 'var(--surface-3)' }}
                      >
                        {platformIcon(p.platform)}
                      </div>
                      <div>
                        <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                          {p.platform}
                        </h3>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          {p.participants} contestant{p.participants !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                    {syncStatusBadge(p.status)}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span style={{ color: 'var(--text-muted)' }}>Last Sync</span>
                      <span style={{ color: 'var(--text-primary)' }}>
                        {p.lastSync ? new Date(p.lastSync).toLocaleString() : 'Never'}
                      </span>
                    </div>
                    {p.detail && (
                      <div className="flex items-center justify-between text-xs">
                        <span style={{ color: 'var(--text-muted)' }}>Detail</span>
                        <span style={{ color: 'var(--text-primary)' }} className="text-right max-w-[200px] truncate">
                          {p.detail}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 mt-4">
                    <button
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full transition-colors"
                      style={{
                        background: 'var(--surface-3)',
                        color: 'var(--text-muted)',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'var(--border-subtle)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'var(--surface-3)'
                      }}
                    >
                      <RefreshCw className="w-3 h-3" /> Sync
                    </button>
                    <button
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full transition-colors"
                      style={{
                        background: 'var(--surface-3)',
                        color: 'var(--text-muted)',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'var(--border-subtle)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'var(--surface-3)'
                      }}
                    >
                      <ExternalLink className="w-3 h-3" /> Open
                    </button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))
        )}
      </div>
    </div>
  )
}
