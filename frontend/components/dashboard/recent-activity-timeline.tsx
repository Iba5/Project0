'use client'

import { motion } from 'framer-motion'
import {
  Activity,
  Vote,
  DollarSign,
  UserPlus,
  Award,
  Settings,
  ArrowRight,
} from 'lucide-react'
import type { ComponentType, CSSProperties } from 'react'
import type { EnhancedActivityEntry } from '@/lib/api'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

// ─── Types ────────────────────────────────────────────────────────

type IconType = ComponentType<{ className?: string; style?: CSSProperties }>

type ActivityKind =
  | 'participant'
  | 'vote'
  | 'payment'
  | 'config'
  | 'milestone'
  | 'default'

interface ActivityTypeMeta {
  icon: IconType
  color: string
  bg: string
  border: string
  ring: string
}

const ACTIVITY_TYPE_MAP: Record<ActivityKind, ActivityTypeMeta> = {
  participant: {
    icon: UserPlus,
    color: '#34D399',
    bg: 'rgba(52,211,153,0.12)',
    border: 'rgba(52,211,153,0.55)',
    ring: 'rgba(52,211,153,0.18)',
  },
  vote: {
    icon: Vote,
    color: '#A78BFA',
    bg: 'rgba(167,139,250,0.12)',
    border: 'rgba(167,139,250,0.55)',
    ring: 'rgba(167,139,250,0.18)',
  },
  payment: {
    icon: DollarSign,
    color: '#F59E0B',
    bg: 'rgba(245,158,11,0.12)',
    border: 'rgba(245,158,11,0.55)',
    ring: 'rgba(245,158,11,0.18)',
  },
  config: {
    icon: Settings,
    color: '#94A3B8',
    bg: 'rgba(148,163,184,0.12)',
    border: 'rgba(148,163,184,0.55)',
    ring: 'rgba(148,163,184,0.18)',
  },
  milestone: {
    icon: Award,
    color: '#FBBF24',
    bg: 'rgba(251,191,36,0.12)',
    border: 'rgba(251,191,36,0.55)',
    ring: 'rgba(251,191,36,0.18)',
  },
  default: {
    icon: Activity,
    color: '#F59E0B',
    bg: 'rgba(245,158,11,0.12)',
    border: 'rgba(245,158,11,0.55)',
    ring: 'rgba(245,158,11,0.18)',
  },
}

function detectActivityKind(entry: EnhancedActivityEntry): ActivityKind {
  const t = `${entry.title} ${entry.detail || ''}`.toLowerCase()
  // If it has participantName or voteCount, it's a vote
  if (entry.participantName || entry.voteCount !== null) {
    return 'vote'
  }
  if (
    t.includes('contestant') ||
    t.includes('participant') ||
    t.includes('submitted') ||
    t.includes('approved')
  ) {
    return 'participant'
  }
  if (t.includes('milestone') || t.includes('reached')) {
    return 'milestone'
  }
  if (
    t.includes('vote') ||
    t.includes('voting') ||
    t.includes('ballot')
  ) {
    return 'vote'
  }
  if (
    t.includes('payment') ||
    t.includes('paid') ||
    t.includes('revenue') ||
    t.includes('transaction') ||
    t.includes('purchase')
  ) {
    return 'payment'
  }
  if (
    t.includes('config') ||
    t.includes('settings') ||
    t.includes('updated') ||
    t.includes('changed') ||
    t.includes('event created') ||
    t.includes('event updated')
  ) {
    return 'config'
  }
  return 'default'
}

// ─── Relative time formatter ──────────────────────────────────────

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const now = Date.now()
  const diffSec = Math.max(0, Math.floor((now - then) / 1000))
  if (diffSec < 60) return 'just now'
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.floor(diffHr / 24)
  if (diffDay < 7) return `${diffDay}d ago`
  const diffWk = Math.floor(diffDay / 7)
  if (diffWk < 5) return `${diffWk}w ago`
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

// ─── Types ────────────────────────────────────────────────────────

interface RecentActivityTimelineProps {
  data: EnhancedActivityEntry[]
  accent?: string
  onViewAll?: () => void
}

// ─── Component ────────────────────────────────────────────────────

export function RecentActivityTimeline({
  data,
  accent = '#F59E0B',
  onViewAll,
}: RecentActivityTimelineProps) {
  return (
    <Card
      className="rounded-xl border hover-glow h-full"
      style={{
        background: 'var(--surface-1)',
        borderColor: 'var(--border-subtle)',
      }}
    >
      <CardHeader className="pb-3 p-4 md:p-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="w-1 h-5 rounded-full shrink-0"
              style={{ background: accent }}
            />
            <Activity
              className="w-4 h-4 shrink-0"
              style={{ color: accent }}
            />
            <h3
              className="text-sm font-semibold truncate"
              style={{ color: 'var(--text-primary)' }}
            >
              Recent Activity
            </h3>
          </div>
          {onViewAll && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1 px-2 hover:bg-amber-500/10"
              style={{ color: accent }}
              onClick={onViewAll}
            >
              View All
              <ArrowRight className="w-3 h-3" />
            </Button>
          )}
        </div>
        <p
          className="text-xs -mt-1"
          style={{ color: 'var(--text-muted)' }}
        >
          Latest votes and activities
        </p>
      </CardHeader>
      <CardContent className="p-4 md:p-6 pt-0">
        <div className="space-y-1 max-h-[30rem] overflow-y-auto scrollbar-thin pr-1">
          {data.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8">
              <Activity
                className="w-8 h-8 mb-2"
                style={{ color: 'var(--text-muted)' }}
              />
              <p
                className="text-sm text-center"
                style={{ color: 'var(--text-muted)' }}
              >
                No recent activity
              </p>
            </div>
          ) : (
            data.map((entry, index) => {
              const kind = detectActivityKind(entry)
              const meta = ACTIVITY_TYPE_MAP[kind]
              const isLast = index === data.length - 1

              return (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{
                    duration: 0.3,
                    delay: 0.1 + index * 0.06,
                  }}
                  whileHover={{ scale: 1.015 }}
                  className="flex gap-3 relative group"
                  style={{
                    borderLeft: `2px solid ${meta.border}`,
                    paddingLeft: '10px',
                    borderRadius: '4px',
                    transition: 'box-shadow 0.2s ease, background 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = meta.bg
                    e.currentTarget.style.boxShadow = `0 0 0 1px ${meta.border}, 0 4px 16px -6px ${meta.ring}`
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent'
                    e.currentTarget.style.boxShadow = 'none'
                  }}
                >
                  {/* Timeline dot + connecting line */}
                  <div className="flex flex-col items-center self-stretch">
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                      style={{
                        background: meta.bg,
                        border: `1px solid ${meta.border}`,
                        boxShadow: `0 0 0 3px ${meta.ring}`,
                      }}
                    >
                      <meta.icon
                        className="w-3.5 h-3.5"
                        style={{ color: meta.color }}
                      />
                    </div>
                    {!isLast && (
                      <div
                        className="w-px flex-1 mt-1 mb-1"
                        style={{
                          background:
                            'linear-gradient(to bottom, var(--border-subtle), transparent)',
                        }}
                      />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 pb-3 pt-0.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p
                          className="text-sm font-medium leading-snug"
                          style={{ color: 'var(--text-primary)' }}
                        >
                          {entry.title}
                        </p>
                        {entry.detail && (
                          <p
                            className="text-xs mt-0.5 leading-snug"
                            style={{ color: 'var(--text-muted)' }}
                          >
                            {entry.detail}
                          </p>
                        )}
                        {/* Enhanced info row */}
                        {(entry.category || entry.voteCount !== null) && (
                          <div className="flex items-center gap-2 mt-1">
                            {entry.category && (
                              <span
                                className="text-[10px] px-1.5 py-0.5 rounded-full"
                                style={{
                                  background: 'rgba(245,158,11,0.1)',
                                  color: accent,
                                }}
                              >
                                {entry.category}
                              </span>
                            )}
                            {entry.voteCount !== null && entry.voteCount > 0 && (
                              <span
                                className="text-[10px] flex items-center gap-0.5"
                                style={{ color: '#A78BFA' }}
                              >
                                <Vote className="w-2.5 h-2.5" />
                                {entry.voteCount} vote{entry.voteCount !== 1 ? 's' : ''}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <span
                        className="text-[10px] shrink-0 mt-0.5 px-1.5 py-0.5 rounded-full whitespace-nowrap"
                        style={{
                          background: 'var(--surface-3)',
                          color: 'var(--text-muted)',
                        }}
                        title={new Date(entry.time).toLocaleString()}
                      >
                        {relativeTime(entry.time)}
                      </span>
                    </div>
                  </div>
                </motion.div>
              )
            })
          )}
        </div>
      </CardContent>
    </Card>
  )
}
