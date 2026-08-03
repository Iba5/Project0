'use client'

import { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Vote, Users } from 'lucide-react'
import { apiFetch } from '@/lib/api-client'

interface ActivityItem {
  id: string
  voterName: string
  contestantName: string
  voteCount: number
  timeAgo: string
  createdAt: string
}

interface ActivityData {
  activities: ActivityItem[]
  votesInLastHour: number
}

const itemVariants = {
  hidden: { opacity: 0, x: -16 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.35, ease: 'easeOut' as const },
  },
  exit: {
    opacity: 0,
    x: 16,
    transition: { duration: 0.2 },
  },
}

// Deterministic avatar color from name
function nameToColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  const hue = Math.abs(hash % 360)
  return `hsl(${hue}, 60%, 45%)`
}

export function ActivityFeed() {
  const [data, setData] = useState<ActivityData | null>(null)
  const [loading, setLoading] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)

  async function fetchActivity() {
    try {
      const json: ActivityData = await apiFetch('/activity')
      setData((prev) => {
        // Only update if there are new items
        if (!prev || json.activities[0]?.id !== prev.activities[0]?.id) {
          return json
        }
        return prev
      })
    } catch {
      // Silent — non-critical
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchActivity()
    // Poll every 30 seconds for new data
    const interval = setInterval(fetchActivity, 30000)
    return () => clearInterval(interval)
  }, [])

  // Auto-scroll to top when new items arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0
    }
  }, [data?.activities[0]?.id])

  if (loading) {
    return (
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: 'rgba(18, 24, 36, 0.6)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid rgba(245, 158, 11, 0.12)',
        }}
      >
        <div className="p-4 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 animate-pulse">
              <div className="w-8 h-8 rounded-full bg-surface-light" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-3/4 rounded bg-surface-light" />
                <div className="h-2.5 w-1/2 rounded bg-surface-light" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (!data || data.activities.length === 0) {
    return (
      <div
        className="rounded-2xl p-8 text-center"
        style={{
          background: 'rgba(18, 24, 36, 0.6)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid rgba(245, 158, 11, 0.12)',
        }}
      >
        <Vote className="size-8 mx-auto text-muted-foreground mb-3" />
        <p className="text-sm text-muted-foreground">No recent activity yet. Be the first to vote!</p>
      </div>
    )
  }

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: 'rgba(18, 24, 36, 0.6)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid rgba(245, 158, 11, 0.12)',
      }}
    >
      {/* Header with vote count summary */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b"
        style={{ borderColor: 'rgba(255, 255, 255, 0.06)' }}
      >
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
          </span>
          <span className="text-xs font-semibold text-green-400 uppercase tracking-wider">Live</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Users className="size-3.5" />
          <span>
            <span className="text-gold-400 font-bold">{data.votesInLastHour}</span> votes in the last hour
          </span>
        </div>
      </div>

      {/* Scrollable activity list */}
      <div ref={scrollRef} className="max-h-80 overflow-y-auto scrollbar-thin p-2">
        <AnimatePresence mode="popLayout">
          {data.activities.map((item, index) => (
            <motion.div
              key={item.id}
              variants={itemVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              transition={{ delay: index * 0.03 }}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/[0.03] transition-colors duration-200"
            >
              {/* Avatar */}
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                style={{
                  background: nameToColor(item.voterName),
                  color: 'rgba(255,255,255,0.85)',
                }}
              >
                {item.voterName.charAt(0).toUpperCase()}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className="text-xs sm:text-sm leading-tight">
                  <span className="font-semibold text-white">{item.voterName}</span>
                  <span className="text-muted-foreground"> voted for </span>
                  <span className="font-semibold text-gold-400">{item.contestantName}</span>
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-muted-foreground">{item.timeAgo}</span>
                  {item.voteCount > 1 && (
                    <span className="text-[10px] text-gold-500 font-semibold">
                      +{item.voteCount} votes
                    </span>
                  )}
                </div>
              </div>

              {/* Vote icon */}
              <div className="shrink-0 w-7 h-7 rounded-full bg-gold-500/10 flex items-center justify-center">
                <Vote className="size-3.5 text-gold-500" />
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}
