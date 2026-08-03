'use client'

import { useEffect, useState, useRef, useMemo, useCallback } from 'react'
import { motion, AnimatePresence, type Variants } from 'framer-motion'
import {
  ArrowLeft,
  Crown,
  Eye,
  GitCompare,
  Vote,
  TrendingUp,
  Swords,
  Trophy,
  BarChart3,
  Percent,
  Minus,
  ArrowUpRight,
  ArrowDownRight,
  Equal,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ContestantCardSkeleton } from '@/components/shared/skeletons'
import { useAppStore } from '@/lib/store'
import { useRouter } from 'next/navigation'
import {
  getParticipant,
  type ParticipantItem,
} from '@/lib/api'
import { ParticipantAvatar } from '@/components/shared/participant-avatar'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/api-client'

// ─── Comparison Colors ─────────────────────────────────────────
const COMPARISON_COLORS = [
  { main: '#F59E0B', light: 'rgba(245,158,11,0.2)', gradient: 'from-amber-400 to-amber-600', label: 'Gold' },
  { main: '#10B981', light: 'rgba(16,185,129,0.2)', gradient: 'from-emerald-400 to-emerald-600', label: 'Emerald' },
  { main: '#06B6D4', light: 'rgba(6,182,212,0.2)', gradient: 'from-cyan-400 to-cyan-600', label: 'Cyan' },
  { main: '#F43F5E', light: 'rgba(244,63,94,0.2)', gradient: 'from-rose-400 to-rose-600', label: 'Rose' },
]

// ─── Types ─────────────────────────────────────────────────────
interface VoteTrendPoint {
  date: string
  votes: number
  cumulative: number
}

interface CompareParticipant {
  id: string
  name: string
  category: string
  platform: string
  imageUrl: string | null
  thumbnailUrl: string | null
  bio: string | null
  votes: number
  rank: number
  voteShare: number
  isLeading: boolean
  createdAt: string
  voteTrend: VoteTrendPoint[]
}

interface HeadToHead {
  voteDifference: number
  rankDifference: number
  leaderWinProbability: number
  sameCategory: boolean
}

interface CompareData {
  comparison: CompareParticipant[]
  headToHead: HeadToHead | null
  totalVotes: number
  totalRanked: number
}

// ─── Animated number display ───────────────────────────────────
function AnimatedNumber({ value }: { value: number }) {
  const [displayValue, setDisplayValue] = useState(value)
  const prevRef = useRef(value)

  useEffect(() => {
    const start = prevRef.current
    const end = value
    if (start === end) return

    const duration = 600
    const startTime = performance.now()
    let raf: number

    const tick = (now: number) => {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      const current = Math.round(start + (end - start) * eased)
      setDisplayValue(current)
      if (progress < 1) {
        raf = requestAnimationFrame(tick)
      } else {
        prevRef.current = end
      }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value])

  return (
    <AnimatePresence mode="popLayout">
      <motion.span
        key={value}
        initial={{
          scale: 1.2,
          color: '#fcd34d',
          textShadow: '0 0 12px rgba(252, 211, 77, 0.9)',
        }}
        animate={{
          scale: 1,
          color: '#fbbf24',
          textShadow: '0 0 0px rgba(252, 211, 77, 0)',
        }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="inline-block font-bold text-gold-400 text-2xl"
      >
        {displayValue.toLocaleString()}
      </motion.span>
    </AnimatePresence>
  )
}

// ─── Vote percentage bar ───────────────────────────────────────
function VoteBar({ percentage, isWinner, color }: { percentage: number; isWinner: boolean; color?: string }) {
  return (
    <div className="w-full h-2.5 rounded-full bg-surface-light overflow-hidden">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${percentage}%` }}
        transition={{ duration: 0.8, ease: 'easeOut', delay: 0.3 }}
        className="h-full rounded-full"
        style={{
          background: color
            ? `linear-gradient(to right, ${color}, ${color}aa)`
            : isWinner
              ? undefined
              : undefined,
          ...(color
            ? {}
            : isWinner
              ? { background: 'linear-gradient(to right, #FBBF24, #D97706)' }
              : { background: 'linear-gradient(to right, rgba(245,158,11,0.4), rgba(217,119,6,0.4))' }),
        }}
      />
    </div>
  )
}

// ─── Side-by-Side Bar Chart ────────────────────────────────────
function CompareBarChart({ data }: { data: CompareParticipant[] }) {
  const maxVotes = Math.max(...data.map((p) => p.votes), 1)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="dark-card rounded-2xl p-6 border border-border"
    >
      <div className="flex items-center gap-2 mb-6">
        <BarChart3 className="size-5 text-gold-400" />
        <h3 className="font-bold text-white">Vote Comparison</h3>
      </div>

      {/* Horizontal bar chart */}
      <div className="space-y-4">
        {data.map((participant, index) => {
          const color = COMPARISON_COLORS[index % COMPARISON_COLORS.length]
          const barWidth = maxVotes > 0 ? (participant.votes / maxVotes) * 100 : 0

          return (
            <motion.div
              key={participant.id}
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.3 + index * 0.12 }}
              className="space-y-1.5"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: color.main }}
                  />
                  <span className="text-sm font-medium text-white truncate max-w-[140px]">
                    {participant.name}
                  </span>
                  {participant.isLeading && (
                    <Crown className="size-3.5 text-gold-400 flex-shrink-0" />
                  )}
                </div>
                <span className="text-sm font-bold" style={{ color: color.main }}>
                  {participant.votes.toLocaleString()}
                </span>
              </div>
              <div className="relative h-8 rounded-lg bg-surface-light overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${barWidth}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut', delay: 0.5 + index * 0.12 }}
                  className="absolute inset-y-0 left-0 rounded-lg"
                  style={{
                    background: `linear-gradient(135deg, ${color.main}, ${color.main}88)`,
                    boxShadow: `0 0 20px ${color.light}`,
                  }}
                >
                  {/* Shimmer effect */}
                  <div className="absolute inset-0 opacity-20">
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse" />
                  </div>
                </motion.div>
                {/* Vote count label inside bar */}
                {barWidth > 20 && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1 + index * 0.12 }}
                    className="absolute inset-y-0 left-3 flex items-center"
                  >
                    <span className="text-xs font-bold text-white/90">
                      {participant.voteShare.toFixed(1)}%
                    </span>
                  </motion.div>
                )}
              </div>
            </motion.div>
          )
        })}
      </div>
    </motion.div>
  )
}

// ─── Vote Distribution Section ─────────────────────────────────
function VoteDistribution({ data, totalVotes }: { data: CompareParticipant[]; totalVotes: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.4 }}
      className="dark-card rounded-2xl p-6 border border-border"
    >
      <div className="flex items-center gap-2 mb-6">
        <Percent className="size-5 text-gold-400" />
        <h3 className="font-bold text-white">Vote Distribution</h3>
      </div>

      {/* Stacked bar */}
      <div className="w-full h-6 rounded-full overflow-hidden flex bg-surface-light mb-4">
        {data.map((participant, index) => {
          const color = COMPARISON_COLORS[index % COMPARISON_COLORS.length]
          const width = totalVotes > 0 ? (participant.votes / totalVotes) * 100 : 0
          return (
            <motion.div
              key={participant.id}
              initial={{ width: 0 }}
              animate={{ width: `${width}%` }}
              transition={{ duration: 0.8, ease: 'easeOut', delay: 0.6 + index * 0.1 }}
              className="h-full relative"
              style={{ backgroundColor: color.main, minWidth: width > 0 ? '2px' : '0' }}
            >
              {width > 12 && (
                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white/90">
                  {width.toFixed(0)}%
                </span>
              )}
            </motion.div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="space-y-3">
        {data.map((participant, index) => {
          const color = COMPARISON_COLORS[index % COMPARISON_COLORS.length]
          const percentage = totalVotes > 0 ? (participant.votes / totalVotes) * 100 : 0
          return (
            <motion.div
              key={participant.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.7 + index * 0.08 }}
              className="flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: color.main }}
                />
                <span className="text-sm text-white truncate max-w-[160px]">
                  {participant.name}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">
                  {participant.votes.toLocaleString()} votes
                </span>
                <span className="text-sm font-bold" style={{ color: color.main }}>
                  {percentage.toFixed(1)}%
                </span>
              </div>
            </motion.div>
          )
        })}
      </div>

      {/* Vote Gap indicator */}
      {data.length >= 2 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.9 }}
          className="mt-4 pt-4 border-t border-border"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Minus className="size-4 text-gold-400" />
              <span className="text-sm text-muted-foreground">Vote Gap</span>
            </div>
            <span className="text-lg font-bold text-gold-400">
              {data[0].votes - data[data.length > 1 ? 1 : 0].votes > 0
                ? (data[0].votes - data[1].votes).toLocaleString()
                : '0'}
            </span>
          </div>
        </motion.div>
      )}
    </motion.div>
  )
}

// ─── Vote Trend Chart (daily cumulative) ───────────────────────
function VoteTrendChart({ data }: { data: CompareParticipant[] }) {
  // Only show if we have trend data
  const hasTrendData = data.some((p) => p.voteTrend && p.voteTrend.length > 0)
  if (!hasTrendData) return null

  // Find max cumulative across all participants for Y axis
  const maxCumulative = Math.max(
    ...data.flatMap((p) => p.voteTrend?.map((t) => t.cumulative) ?? [0]),
    1
  )

  // Chart height in pixels
  const chartHeight = 180
  const chartPadding = { top: 20, right: 10, bottom: 30, left: 40 }
  const plotWidth = 300
  const plotHeight = chartHeight - chartPadding.top - chartPadding.bottom

  // Get the date labels (use first participant's dates)
  const dates = data[0]?.voteTrend?.map((t) => t.date) ?? []
  const xStep = dates.length > 1 ? plotWidth / (dates.length - 1) : plotWidth

  // Build SVG path for each participant
  const paths = data.map((participant, index) => {
    const color = COMPARISON_COLORS[index % COMPARISON_COLORS.length]
    const trend = participant.voteTrend
    if (!trend || trend.length === 0) return null

    const points = trend.map((t, i) => {
      const x = chartPadding.left + i * xStep
      const y =
        chartPadding.top +
        plotHeight -
        (maxCumulative > 0 ? (t.cumulative / maxCumulative) * plotHeight : 0)
      return { x, y, cumulative: t.cumulative, date: t.date }
    })

    // Build path string
    const pathStr = points
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
      .join(' ')

    // Build area path (fill below line)
    const areaStr = `${pathStr} L ${points[points.length - 1].x} ${chartPadding.top + plotHeight} L ${points[0].x} ${chartPadding.top + plotHeight} Z`

    return { pathStr, areaStr, color, points, name: participant.name }
  })

  // Y-axis labels
  const yTicks = 4
  const yLabels = Array.from({ length: yTicks + 1 }, (_, i) => {
    const value = Math.round((maxCumulative / yTicks) * i)
    return value
  })

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.6 }}
      className="dark-card rounded-2xl p-6 border border-border"
    >
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="size-5 text-gold-400" />
        <h3 className="font-bold text-white">7-Day Vote Trend</h3>
      </div>

      {/* SVG Chart */}
      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${plotWidth + chartPadding.left + chartPadding.right} ${chartHeight}`}
          className="w-full max-w-[500px] mx-auto"
          style={{ minWidth: '280px' }}
        >
          {/* Grid lines */}
          {yLabels.map((_, i) => {
            const y = chartPadding.top + plotHeight - (i / yTicks) * plotHeight
            return (
              <line
                key={`grid-${i}`}
                x1={chartPadding.left}
                y1={y}
                x2={chartPadding.left + plotWidth}
                y2={y}
                stroke="rgba(255,255,255,0.06)"
                strokeWidth={1}
              />
            )
          })}

          {/* Y-axis labels */}
          {yLabels.map((val, i) => {
            const y = chartPadding.top + plotHeight - (i / yTicks) * plotHeight
            return (
              <text
                key={`ylabel-${i}`}
                x={chartPadding.left - 6}
                y={y + 3}
                textAnchor="end"
                fill="rgba(148,163,184,0.6)"
                fontSize={9}
              >
                {val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val}
              </text>
            )
          })}

          {/* X-axis labels (every other date) */}
          {dates.map((date, i) => {
            if (i % 2 !== 0 && dates.length > 4) return null
            const x = chartPadding.left + i * xStep
            const shortDate = date.slice(5) // MM-DD
            return (
              <text
                key={`xlabel-${i}`}
                x={x}
                y={chartHeight - 6}
                textAnchor="middle"
                fill="rgba(148,163,184,0.6)"
                fontSize={9}
              >
                {shortDate}
              </text>
            )
          })}

          {/* Area fills and lines */}
          {paths.map((pathData, index) => {
            if (!pathData) return null
            return (
              <g key={`trend-${index}`}>
                {/* Area fill */}
                <motion.path
                  d={pathData.areaStr}
                  fill={pathData.color.main}
                  fillOpacity={0.08}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.6, delay: 0.8 + index * 0.1 }}
                />
                {/* Line */}
                <motion.path
                  d={pathData.pathStr}
                  fill="none"
                  stroke={pathData.color.main}
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ duration: 1.2, delay: 0.8 + index * 0.1, ease: 'easeOut' }}
                />
                {/* Data points */}
                {pathData.points.map((point, pi) => (
                  <motion.circle
                    key={`dot-${index}-${pi}`}
                    cx={point.x}
                    cy={point.y}
                    r={3}
                    fill={pathData.color.main}
                    stroke="#0B0F17"
                    strokeWidth={1.5}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.3, delay: 1.2 + index * 0.1 + pi * 0.05 }}
                  />
                ))}
              </g>
            )
          })}
        </svg>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mt-3 justify-center">
        {data.map((participant, index) => {
          const color = COMPARISON_COLORS[index % COMPARISON_COLORS.length]
          return (
            <div key={participant.id} className="flex items-center gap-1.5">
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: color.main }}
              />
              <span className="text-xs text-muted-foreground truncate max-w-[100px]">
                {participant.name}
              </span>
            </div>
          )
        })}
      </div>
    </motion.div>
  )
}

// ─── Compare Stats Panel ───────────────────────────────────────
function CompareStatsPanel({ data, headToHead, totalRanked }: { data: CompareParticipant[]; headToHead: HeadToHead | null; totalRanked: number }) {
  if (!headToHead || data.length < 2) return null

  const leader = data[0]
  const challenger = data[1]
  const leaderColor = COMPARISON_COLORS[0]
  const challengerColor = COMPARISON_COLORS[1]

  const getTrendIcon = (participant: CompareParticipant) => {
    const trend = participant.voteTrend
    if (!trend || trend.length < 2) return <Equal className="size-3.5 text-muted-foreground" />
    const recentVotes = trend.slice(-3).reduce((s, t) => s + t.votes, 0)
    const olderVotes = trend.slice(-6, -3).reduce((s, t) => s + t.votes, 0)
    if (recentVotes > olderVotes) return <ArrowUpRight className="size-3.5 text-emerald-400" />
    if (recentVotes < olderVotes) return <ArrowDownRight className="size-3.5 text-rose-400" />
    return <Equal className="size-3.5 text-muted-foreground" />
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.8 }}
      className="dark-card rounded-2xl p-6 border border-border"
    >
      <div className="flex items-center gap-2 mb-6">
        <Swords className="size-5 text-gold-400" />
        <h3 className="font-bold text-white">Head-to-Head Stats</h3>
      </div>

      {/* VS Badge */}
      <div className="flex items-center justify-center gap-3 mb-6">
        <div className="flex-1 text-right">
          <div className="flex items-center justify-end gap-2">
            <span className="font-bold text-white">{leader.name}</span>
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: leaderColor.main }}
            />
          </div>
          <span className="text-xs text-muted-foreground">
            Rank #{leader.rank} of {totalRanked}
          </span>
        </div>

        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 1 }}
          className="flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-br from-gold-400 to-gold-600 flex items-center justify-center shadow-lg"
          style={{ boxShadow: '0 0 20px rgba(245,158,11,0.3)' }}
        >
          <span className="text-sm font-black text-[#0B0F17]">VS</span>
        </motion.div>

        <div className="flex-1 text-left">
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: challengerColor.main }}
            />
            <span className="font-bold text-white">{challenger.name}</span>
          </div>
          <span className="text-xs text-muted-foreground">
            Rank #{challenger.rank} of {totalRanked}
          </span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Vote Difference */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.0 }}
          className="rounded-xl bg-surface-light/60 p-4 border border-border/50"
        >
          <div className="flex items-center gap-2 mb-2">
            <Vote className="size-4 text-gold-400" />
            <span className="text-xs text-muted-foreground font-medium">Vote Difference</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-2xl font-bold text-white">
              {headToHead.voteDifference.toLocaleString()}
            </span>
            <div className="flex items-center gap-1">
              {getTrendIcon(leader)}
              <span className="text-xs text-muted-foreground">votes ahead</span>
            </div>
          </div>
          {headToHead.voteDifference === 0 && (
            <span className="text-xs text-gold-400 font-medium">Tied!</span>
          )}
        </motion.div>

        {/* Rank Difference */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.1 }}
          className="rounded-xl bg-surface-light/60 p-4 border border-border/50"
        >
          <div className="flex items-center gap-2 mb-2">
            <Trophy className="size-4 text-gold-400" />
            <span className="text-xs text-muted-foreground font-medium">Rank Difference</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-2xl font-bold text-white">
              {headToHead.rankDifference > 0 ? `+${headToHead.rankDifference}` : headToHead.rankDifference}
            </span>
            <span className="text-xs text-muted-foreground">
              {headToHead.rankDifference > 0 ? 'positions ahead' : 'positions behind'}
            </span>
          </div>
        </motion.div>

        {/* Category Comparison */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2 }}
          className="rounded-xl bg-surface-light/60 p-4 border border-border/50"
        >
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="size-4 text-gold-400" />
            <span className="text-xs text-muted-foreground font-medium">Category</span>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: leaderColor.main }} />
              <span className="text-sm text-white">{leader.category}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: challengerColor.main }} />
              <span className="text-sm text-white">{challenger.category}</span>
            </div>
          </div>
          {headToHead.sameCategory && (
            <Badge
              variant="secondary"
              className="mt-2 bg-gold-500/10 text-gold-400 border border-gold-500/30 text-[10px]"
            >
              Same Category
            </Badge>
          )}
        </motion.div>

        {/* Win Probability */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.3 }}
          className="rounded-xl bg-surface-light/60 p-4 border border-border/50"
        >
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="size-4 text-gold-400" />
            <span className="text-xs text-muted-foreground font-medium">Win Probability</span>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: leaderColor.main }} />
                <span className="text-xs text-white truncate max-w-[80px]">{leader.name}</span>
              </div>
              <span className="text-sm font-bold" style={{ color: leaderColor.main }}>
                {headToHead.leaderWinProbability}%
              </span>
            </div>
            <div className="w-full h-2.5 rounded-full bg-surface-light overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${headToHead.leaderWinProbability}%` }}
                transition={{ duration: 0.8, ease: 'easeOut', delay: 1.4 }}
                className="h-full rounded-full"
                style={{
                  background: `linear-gradient(90deg, ${leaderColor.main}, ${leaderColor.main}88)`,
                }}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: challengerColor.main }} />
                <span className="text-xs text-white truncate max-w-[80px]">{challenger.name}</span>
              </div>
              <span className="text-sm font-bold" style={{ color: challengerColor.main }}>
                {100 - headToHead.leaderWinProbability}%
              </span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Additional contestants (3rd, 4th) */}
      {data.length > 2 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.4 }}
          className="mt-4 pt-4 border-t border-border"
        >
          <span className="text-xs text-muted-foreground font-medium mb-2 block">
            Also in comparison
          </span>
          <div className="flex flex-wrap gap-2">
            {data.slice(2).map((participant, index) => {
              const color = COMPARISON_COLORS[(index + 2) % COMPARISON_COLORS.length]
              return (
                <Badge
                  key={participant.id}
                  variant="secondary"
                  className="gap-1.5 text-xs"
                  style={{ backgroundColor: color.light, color: color.main, borderColor: `${color.main}44` }}
                >
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color.main }} />
                  {participant.name} — {participant.votes.toLocaleString()} votes
                </Badge>
              )
            })}
          </div>
        </motion.div>
      )}
    </motion.div>
  )
}

// ─── Animation Variants ────────────────────────────────────────
const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
}

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 30, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.5, ease: 'easeOut' as const },
  },
}

// ─── Main Compare View ────────────────────────────────────────
export default function CompareView() {
  const { compareIds, setCompareIds } = useAppStore()
  const router = useRouter()
  const [participants, setParticipants] = useState<ParticipantItem[]>([])
  const [compareData, setCompareData] = useState<CompareData | null>(null)
  const [loading, setLoading] = useState(() => true)

  // Fetch participant data for each selected ID
  useEffect(() => {
    if (compareIds.length === 0) {
      return
    }

    let mounted = true
    async function fetchParticipants() {
      try {
        const results = await Promise.all(
          compareIds.map((id) => getParticipant(id).then((res) => res.participant))
        )
        if (mounted) {
          setParticipants(results)
          setLoading(false)
        }
      } catch {
        if (mounted) {
          toast.error('Failed to load some contestant data')
          setLoading(false)
        }
      }
    }
    fetchParticipants()
    return () => {
      mounted = false
    }
  }, [compareIds])

  // Fetch comparison data from the compare API
  useEffect(() => {
    if (compareIds.length < 2) return
    let cancelled = false
    apiFetch(`/participants/compare?ids=${compareIds.join(',')}`)
      .then((data) => {
        if (!cancelled) setCompareData(data as CompareData)
      })
      .catch(() => {
        // Non-critical — the comparison charts will simply not show
      })
    return () => { cancelled = true }
  }, [compareIds])

  // Calculate total votes and winner from basic participant data
  const totalVotes = useMemo(() => participants.reduce((sum, p) => sum + p.votes, 0), [participants])
  const maxVotes = useMemo(() => Math.max(...participants.map((p) => p.votes), 0), [participants])

  const handleViewProfile = (id: string) => {
    router.push(`/contestants/${id}`)
  }

  const handleBack = () => {
    setCompareIds([])
    router.push('/contestants')
  }

  // No contestants selected
  if (compareIds.length === 0) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <div className="relative mb-6 inline-block">
            <div className="absolute inset-0 rounded-full bg-gold-500/10 blur-2xl" />
            <div className="relative w-24 h-24 rounded-full glass-strong flex items-center justify-center border border-gold-500/20">
              <GitCompare className="size-10 text-gold-400/70" />
            </div>
          </div>
          <h3 className="text-xl font-bold mb-2 text-white">No contestants selected</h3>
          <p className="text-sm text-muted-foreground mb-6 max-w-sm leading-relaxed">
            Go back to the contestants view and select 2-4 contestants to compare side by side.
          </p>
          <Button
            onClick={handleBack}
            className="bg-gold-500 hover:bg-gold-600 text-[#0B0F17] font-semibold rounded-full gap-2 gold-glow-sm"
          >
            <ArrowLeft className="size-4" />
            Back to Contestants
          </Button>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 glass-strong border-b border-border">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleBack}
                className="text-muted-foreground hover:text-foreground hover:bg-accent rounded-full"
              >
                <ArrowLeft className="size-5" />
              </Button>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold">Compare Contestants</h1>
                  <GitCompare className="size-5 text-gold-400" />
                </div>
                <p className="text-xs text-muted-foreground">
                  {loading ? 'Loading...' : `${participants.length} contestants side by side`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant="secondary"
                className="bg-gold-500/10 text-gold-400 border border-gold-500/30 text-xs"
              >
                {participants.length} selected
              </Badge>
            </div>
          </div>
        </div>
      </header>

      {/* Comparison Grid */}
      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Participant Cards */}
        {loading ? (
          <div
            className={`grid gap-4 ${
              compareIds.length === 2
                ? 'grid-cols-1 sm:grid-cols-2'
                : compareIds.length === 3
                  ? 'grid-cols-1 sm:grid-cols-3'
                  : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
            }`}
          >
            {compareIds.map((id) => (
              <ContestantCardSkeleton key={id} />
            ))}
          </div>
        ) : (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className={`grid gap-4 sm:gap-6 ${
              participants.length === 2
                ? 'grid-cols-1 sm:grid-cols-2'
                : participants.length === 3
                  ? 'grid-cols-1 sm:grid-cols-3'
                  : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
            }`}
          >
            {participants.map((participant, index) => {
              const isWinner = participant.votes === maxVotes && maxVotes > 0
              const votePercentage = totalVotes > 0 ? (participant.votes / totalVotes) * 100 : 0
              const color = COMPARISON_COLORS[index % COMPARISON_COLORS.length]

              return (
                <motion.div
                  key={participant.id}
                  variants={cardVariants}
                  className={`dark-card rounded-2xl overflow-hidden relative ${
                    isWinner
                      ? 'border-2 border-gold-500/60 shadow-[0_0_30px_rgba(245,158,11,0.15)]'
                      : 'border border-border'
                  }`}
                >
                  {/* Winner banner */}
                  {isWinner && (
                    <div className="bg-gradient-to-r from-gold-500/20 via-gold-400/30 to-gold-500/20 px-4 py-2 flex items-center justify-center gap-2 border-b border-gold-500/30">
                      <Crown className="size-4 text-gold-400" />
                      <span className="text-xs font-bold text-gold-400 uppercase tracking-wider">
                        Leading
                      </span>
                      <Crown className="size-4 text-gold-400" />
                    </div>
                  )}

                  <div className="p-6 space-y-5">
                    {/* Color indicator */}
                    <div className="flex items-center justify-center gap-2">
                      <div
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: color.main }}
                      />
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                        {color.label}
                      </span>
                    </div>

                    {/* Avatar + Name */}
                    <div className="flex flex-col items-center gap-3 text-center">
                      {/* Participant avatar */}
                      <div className={`relative ${isWinner ? 'ring-2 ring-gold-500/60 ring-offset-2 ring-offset-[#0B0F17] rounded-full' : ''}`}>
                        <ParticipantAvatar
                          name={participant.name}
                          imageUrl={participant.imageUrl}
                          thumbnailUrl={participant.thumbnailUrl}
                          size="lg"
                          eager
                          className="rounded-full"
                        />
                        {isWinner && (
                          <div className="absolute -top-1 -right-1 w-7 h-7 rounded-full bg-gradient-to-br from-gold-300 to-gold-600 flex items-center justify-center shadow-lg border border-white/30">
                            <Crown className="size-4 text-yellow-50" />
                          </div>
                        )}
                      </div>

                      {/* Name */}
                      <h3 className="font-bold text-lg text-white">{participant.name}</h3>

                      {/* Badges */}
                      <div className="flex items-center gap-2 flex-wrap justify-center">
                        <Badge
                          variant="secondary"
                          className="bg-surface-light text-white text-[10px] border-0 font-semibold"
                        >
                          {participant.category}
                        </Badge>
                      </div>
                    </div>

                    {/* Vote count */}
                    <div className="flex flex-col items-center gap-1">
                      <div className="flex items-center gap-1.5">
                        <Vote className="size-4 text-gold-400" />
                        <AnimatedNumber value={participant.votes} />
                      </div>
                      <span className="text-xs text-muted-foreground font-medium">votes</span>
                    </div>

                    {/* Vote percentage bar */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Share of votes</span>
                        <span className={`text-xs font-bold ${isWinner ? 'text-gold-400' : 'text-muted-foreground'}`}>
                          {votePercentage.toFixed(1)}%
                        </span>
                      </div>
                      <VoteBar percentage={votePercentage} isWinner={isWinner} />
                    </div>

                    {/* Bio */}
                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground font-medium">Bio</span>
                      <p className="text-sm text-muted-foreground leading-relaxed line-clamp-4">
                        {participant.bio || 'No bio available'}
                      </p>
                    </div>

                    {/* View Profile button */}
                    <Button
                      onClick={() => handleViewProfile(participant.id)}
                      className="w-full rounded-full gap-2 bg-gold-500 hover:bg-gold-600 text-[#0B0F17] font-semibold gold-glow-sm"
                    >
                      <Eye className="size-4" />
                      View Profile
                    </Button>
                  </div>
                </motion.div>
              )
            })}
          </motion.div>
        )}

        {/* ─── Charts & Stats Section ─────────────────────────── */}
        {!loading && compareData && compareData.comparison.length >= 2 && (
          <div className="space-y-6">
            {/* Vote Comparison Bar Chart + Vote Distribution */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <CompareBarChart data={compareData.comparison} />
              <VoteDistribution data={compareData.comparison} totalVotes={compareData.totalVotes} />
            </div>

            {/* Vote Trend Chart */}
            <VoteTrendChart data={compareData.comparison} />

            {/* Head-to-Head Stats Panel */}
            <CompareStatsPanel
              data={compareData.comparison}
              headToHead={compareData.headToHead}
              totalRanked={compareData.totalRanked}
            />
          </div>
        )}

        {/* Summary stats (original, kept for all cases) */}
        {!loading && participants.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.4 }}
            className="dark-card rounded-2xl p-6 border border-border"
          >
            <div className="flex items-center gap-2 mb-4">
              <GitCompare className="size-5 text-gold-400" />
              <h3 className="font-bold text-white">Comparison Summary</h3>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-gold-400">{totalVotes.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Total Votes</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-gold-400">{participants.length}</p>
                <p className="text-xs text-muted-foreground">Contestants</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-gold-400">
                  {totalVotes > 0 ? Math.round(totalVotes / participants.length).toLocaleString() : 0}
                </p>
                <p className="text-xs text-muted-foreground">Avg Votes</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-gold-400">
                  {maxVotes > 0 && participants.length > 1
                    ? `${((maxVotes / totalVotes) * 100).toFixed(0)}%`
                    : '0%'}
                </p>
                <p className="text-xs text-muted-foreground">Leader Share</p>
              </div>
            </div>
          </motion.div>
        )}
      </main>
    </div>
  )
}
