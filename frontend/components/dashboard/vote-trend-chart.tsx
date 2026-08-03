'use client'

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Vote, BarChart3 } from 'lucide-react'
import type { VoteTrendPoint } from '@/lib/api'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

// ─── Types ────────────────────────────────────────────────────────

type TrendRange = '7d' | '30d'

interface VoteTrendChartProps {
  data: VoteTrendPoint[]
  accent?: string
}

// ─── Component ────────────────────────────────────────────────────

export function VoteTrendChart({ data, accent = '#F59E0B' }: VoteTrendChartProps) {
  const [trendRange, setTrendRange] = useState<TrendRange>('7d')
  const [hoveredBar, setHoveredBar] = useState<number | null>(null)

  const filteredData = useMemo(() => {
    if (!data || data.length === 0) return []
    const days = trendRange === '7d' ? 7 : 30
    return data.slice(-days)
  }, [data, trendRange])

  const maxVotes = useMemo(() => {
    if (filteredData.length === 0) return 1
    return Math.max(...filteredData.map((d) => d.votes), 1)
  }, [filteredData])

  const totalVotes = useMemo(() => {
    return filteredData.reduce((sum, d) => sum + d.votes, 0)
  }, [filteredData])

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00Z')
    if (Number.isNaN(d.getTime())) return dateStr
    return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`
  }

  const formatFullDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00Z')
    if (Number.isNaN(d.getTime())) return dateStr
    return d.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    })
  }

  return (
    <Card
      className="rounded-xl border hover-lift h-full"
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
            <BarChart3
              className="w-4 h-4 shrink-0"
              style={{ color: accent }}
            />
            <h3
              className="text-sm font-semibold truncate"
              style={{ color: 'var(--text-primary)' }}
            >
              Vote Trend
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="text-xs font-medium px-2 py-0.5 rounded-full hidden sm:inline"
              style={{
                background: 'rgba(245,158,11,0.12)',
                color: accent,
              }}
            >
              {totalVotes.toLocaleString()} votes
            </span>
            {/* Toggle */}
            <div
              className="flex rounded-lg overflow-hidden"
              style={{
                background: 'var(--surface-3)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              {(['7d', '30d'] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setTrendRange(r)}
                  className="px-3 py-1 text-xs font-medium transition-all"
                  style={{
                    background:
                      trendRange === r
                        ? 'rgba(245,158,11,0.2)'
                        : 'transparent',
                    color: trendRange === r ? accent : 'var(--text-muted)',
                  }}
                >
                  {r === '7d' ? 'Last 7 Days' : 'Last 30 Days'}
                </button>
              ))}
            </div>
          </div>
        </div>
        <p
          className="text-xs -mt-1"
          style={{ color: 'var(--text-muted)' }}
        >
          Daily vote counts over time
        </p>
      </CardHeader>
      <CardContent className="p-4 md:p-6 pt-0">
        {filteredData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Vote
              className="w-8 h-8 mb-2"
              style={{ color: 'var(--text-muted)' }}
            />
            <p
              className="text-sm text-center"
              style={{ color: 'var(--text-muted)' }}
            >
              No vote data available
            </p>
          </div>
        ) : (
          <div className="relative">
            {/* Y-axis labels */}
            <div className="flex items-end gap-1 h-52">
              {/* Y-axis */}
              <div
                className="flex flex-col justify-between h-full pr-2 shrink-0"
                style={{ width: '36px' }}
              >
                <span
                  className="text-[10px] tabular-nums text-right"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {maxVotes}
                </span>
                <span
                  className="text-[10px] tabular-nums text-right"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {Math.round(maxVotes / 2)}
                </span>
                <span
                  className="text-[10px] tabular-nums text-right"
                  style={{ color: 'var(--text-muted)' }}
                >
                  0
                </span>
              </div>

              {/* Bars container */}
              <div className="flex-1 flex items-end gap-[3px] h-full relative">
                {/* Grid lines */}
                <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                  <div
                    className="w-full border-t border-dashed"
                    style={{ borderColor: 'var(--border-subtle)' }}
                  />
                  <div
                    className="w-full border-t border-dashed"
                    style={{ borderColor: 'var(--border-subtle)' }}
                  />
                  <div
                    className="w-full border-t border-dashed"
                    style={{ borderColor: 'var(--border-subtle)' }}
                  />
                </div>

                {/* Bars */}
                {filteredData.map((point, index) => {
                  const heightPct =
                    maxVotes > 0 ? (point.votes / maxVotes) * 100 : 0
                  const isHovered = hoveredBar === index
                  const barWidth =
                    trendRange === '7d'
                      ? 'calc((100% - 18px) / 7)'
                      : 'calc((100% - 87px) / 30)'

                  return (
                    <motion.div
                      key={point.date}
                      className="relative flex flex-col items-center justify-end"
                      style={{ width: barWidth, height: '100%' }}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        duration: 0.3,
                        delay: index * 0.02,
                      }}
                      onMouseEnter={() => setHoveredBar(index)}
                      onMouseLeave={() => setHoveredBar(null)}
                    >
                      {/* Tooltip */}
                      <AnimatePresence>
                        {isHovered && (
                          <motion.div
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 4 }}
                            transition={{ duration: 0.15 }}
                            className="absolute -top-14 left-1/2 -translate-x-1/2 z-20 rounded-lg px-3 py-2 text-xs shadow-lg whitespace-nowrap"
                            style={{
                              background: 'var(--surface-elevated)',
                              border: '1px solid var(--border-subtle)',
                              color: 'var(--text-primary)',
                            }}
                          >
                            <p className="font-medium">
                              {formatFullDate(point.date)}
                            </p>
                            <p style={{ color: accent }}>
                              {point.votes.toLocaleString()} votes
                            </p>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* The bar */}
                      <motion.div
                        className="w-full rounded-t-md relative overflow-hidden cursor-pointer transition-all"
                        style={{
                          height: `${Math.max(heightPct, 2)}%`,
                          minWidth: trendRange === '7d' ? '24px' : '6px',
                        }}
                        initial={{ height: 0 }}
                        animate={{
                          height: `${Math.max(heightPct, 2)}%`,
                        }}
                        transition={{
                          duration: 0.6,
                          delay: 0.1 + index * 0.03,
                          ease: 'easeOut',
                        }}
                        whileHover={{ scaleY: 1.03 }}
                      >
                        {/* Gradient fill */}
                        <div
                          className="absolute inset-0"
                          style={{
                            background: `linear-gradient(180deg, ${accent} 0%, ${accent}99 40%, ${accent}66 100%)`,
                          }}
                        />
                        {/* Shine effect */}
                        <div
                          className="absolute inset-0"
                          style={{
                            background:
                              'linear-gradient(180deg, rgba(255,255,255,0.15) 0%, transparent 60%)',
                          }}
                        />
                        {/* Hover glow */}
                        {isHovered && (
                          <div
                            className="absolute inset-0"
                            style={{
                              background:
                                'linear-gradient(180deg, rgba(255,255,255,0.2) 0%, transparent 50%)',
                            }}
                          />
                        )}
                      </motion.div>

                      {/* X-axis label */}
                      {(trendRange === '7d' ||
                        (trendRange === '30d' && index % 5 === 0) ||
                        (trendRange === '30d' &&
                          index === filteredData.length - 1)) && (
                        <span
                          className="text-[9px] tabular-nums mt-1.5 shrink-0"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          {formatDate(point.date)}
                        </span>
                      )}
                    </motion.div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
