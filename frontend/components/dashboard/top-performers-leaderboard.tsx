'use client'

import { motion } from 'framer-motion'
import { Crown, Medal, TrendingUp, TrendingDown, Minus, ArrowRight } from 'lucide-react'
import type { TopPerformerEntry } from '@/lib/api'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ParticipantAvatar } from '@/components/shared/participant-avatar'

// ─── Types ────────────────────────────────────────────────────────

interface TopPerformersLeaderboardProps {
  data: TopPerformerEntry[]
  accent?: string
  onViewAll?: () => void
}

// ─── Component ────────────────────────────────────────────────────

export function TopPerformersLeaderboard({
  data,
  accent = '#F59E0B',
  onViewAll,
}: TopPerformersLeaderboardProps) {
  const maxVotes = data.length > 0 ? data[0].votes : 1

  const trendIcon = (trend: 'up' | 'down' | 'same') => {
    if (trend === 'up') return <TrendingUp className="w-3 h-3" />
    if (trend === 'down') return <TrendingDown className="w-3 h-3" />
    return <Minus className="w-3 h-3" />
  }

  const trendColor = (trend: 'up' | 'down' | 'same') => {
    if (trend === 'up') return '#34D399'
    if (trend === 'down') return '#F87171'
    return 'var(--text-muted)'
  }

  const trendBg = (trend: 'up' | 'down' | 'same') => {
    if (trend === 'up') return 'rgba(52,211,153,0.15)'
    if (trend === 'down') return 'rgba(248,113,113,0.15)'
    return 'var(--surface-3)'
  }

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
            <Crown
              className="w-4 h-4 shrink-0"
              style={{ color: accent }}
            />
            <h3
              className="text-sm font-semibold truncate"
              style={{ color: 'var(--text-primary)' }}
            >
              Top Performers
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
          Top 5 contestants with trend indicators
        </p>
      </CardHeader>
      <CardContent className="p-4 md:p-6 pt-0">
        {data.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8">
            <Crown
              className="w-8 h-8 mb-2"
              style={{ color: 'var(--text-muted)' }}
            />
            <p
              className="text-sm text-center"
              style={{ color: 'var(--text-muted)' }}
            >
              No performers yet
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {data.map((entry, index) => {
              const rank = index + 1
              const voteShare =
                maxVotes > 0 ? Math.round((entry.votes / maxVotes) * 100) : 0

              return (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{
                    duration: 0.3,
                    delay: 0.1 + index * 0.06,
                  }}
                  whileHover={{ scale: 1.015 }}
                  className="flex items-center gap-3 p-2.5 rounded-lg cursor-pointer group"
                  style={{
                    background:
                      rank <= 3
                        ? 'rgba(245,158,11,0.05)'
                        : 'transparent',
                    border: '1px solid transparent',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background =
                      rank <= 3
                        ? 'rgba(245,158,11,0.08)'
                        : 'rgba(245,158,11,0.04)'
                    e.currentTarget.style.borderColor =
                      'rgba(245,158,11,0.35)'
                    e.currentTarget.style.boxShadow =
                      '0 0 0 1px rgba(245,158,11,0.18), 0 6px 20px -8px rgba(245,158,11,0.3)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background =
                      rank <= 3
                        ? 'rgba(245,158,11,0.05)'
                        : 'transparent'
                    e.currentTarget.style.borderColor = 'transparent'
                    e.currentTarget.style.boxShadow = 'none'
                  }}
                >
                  {/* Rank badge */}
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 font-bold text-xs"
                    style={{
                      background:
                        rank === 1
                          ? 'linear-gradient(135deg, #FBBF24, #D97706)'
                          : rank === 2
                            ? 'linear-gradient(135deg, #CBD5E1, #94A3B8)'
                            : rank === 3
                              ? 'linear-gradient(135deg, #FB923C, #C2410C)'
                              : 'var(--surface-3)',
                      color: rank <= 3 ? '#0B0F17' : 'var(--text-muted)',
                      boxShadow:
                        rank <= 3
                          ? '0 4px 12px -4px rgba(245,158,11,0.5)'
                          : 'none',
                    }}
                  >
                    {rank}
                  </div>

                  {/* Avatar */}
                  <div
                    className="shrink-0"
                    style={{
                      boxShadow:
                        rank <= 3
                          ? `0 0 0 2px ${rank === 1 ? 'rgba(245,158,11,0.5)' : rank === 2 ? 'rgba(203,213,225,0.4)' : 'rgba(217,119,6,0.4)'}`
                          : 'none',
                    }}
                  >
                    <ParticipantAvatar name={entry.name} imageUrl={entry.imageUrl} thumbnailUrl={entry.thumbnailUrl} size="xs" />
                  </div>

                  {/* Name + category + progress bar */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p
                        className="text-sm font-medium truncate"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {entry.name}
                      </p>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* Trend indicator */}
                        <div
                          className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full"
                          style={{
                            background: trendBg(entry.trend),
                            color: trendColor(entry.trend),
                          }}
                        >
                          {trendIcon(entry.trend)}
                          {entry.trendVotes > 0 && (
                            <span className="text-[10px] font-semibold tabular-nums">
                              {entry.trendVotes}
                            </span>
                          )}
                        </div>
                        <span
                          className="text-xs font-semibold tabular-nums"
                          style={{ color: accent }}
                        >
                          {entry.votes.toLocaleString()}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <p
                        className="text-[10px] shrink-0 uppercase tracking-wide"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        {entry.category}
                      </p>
                      <div
                        className="flex-1 h-1.5 rounded-full overflow-hidden"
                        style={{ background: 'var(--surface-3)' }}
                      >
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${voteShare}%` }}
                          transition={{
                            duration: 0.6,
                            delay: 0.2 + index * 0.06,
                            ease: 'easeOut',
                          }}
                          className="h-full rounded-full"
                          style={{
                            background:
                              rank === 1
                                ? 'linear-gradient(90deg, #F59E0B, #FBBF24)'
                                : rank === 2
                                  ? 'linear-gradient(90deg, #CBD5E1, #E2E8F0)'
                                  : rank === 3
                                    ? 'linear-gradient(90deg, #D97706, #F59E0B)'
                                    : 'linear-gradient(90deg, rgba(245,158,11,0.5), rgba(245,158,11,0.3))',
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
