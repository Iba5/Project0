'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { motion, useSpring, useTransform, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Play,
  ExternalLink,
  Lock,
  Vote,
  Music,
  Star,
  Calendar,
  Eye,
  Share2,
  Heart,
  TrendingUp,
  ArrowUp,
  ChevronRight,
  Crown,
  Users,
  Zap,
} from 'lucide-react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from 'recharts'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useAppStore } from '@/lib/store'
import { useRouter } from 'next/navigation'
import {
  getParticipant,
  getPublicParticipants,
  getPublicLeaderboard,
  type ParticipantItem,
  type PublicParticipant,
  type PublicLeaderboardEntry,
} from '@/lib/api'
import { useRealtime, type VoteUpdateData } from '@/hooks/use-realtime'
import { useIsMobile } from '@/hooks/use-mobile'
import { useChartTheme } from '@/lib/chart-theme'
import {
  getParticipantVoteHistory,
  type VoteHistoryPoint,
} from '@/lib/analytics-api'
import { ParticipantAvatar } from '@/components/shared/participant-avatar'
import { QuickVoteDialog } from '@/components/shared/quick-vote-dialog'
import { ShareModal } from '@/components/shared/share-modal'
import { ContestantShareCard } from '@/components/shared/contestant-share-card'
import { toast } from 'sonner'

function AnimatedVoteCount({ value }: { value: number }) {
  const spring = useSpring(value, { stiffness: 100, damping: 30 })
  const display = useTransform(spring, (v) => Math.round(v).toLocaleString())
  const popRef = useRef<HTMLSpanElement>(null)
  const prevValueRef = useRef(value)

  useEffect(() => {
    spring.set(value)
    // Trigger pop animation when votes increase
    if (value > prevValueRef.current && popRef.current) {
      popRef.current.classList.add('vote-count-pop')
      const timer = setTimeout(() => {
        popRef.current?.classList.remove('vote-count-pop')
      }, 400)
      prevValueRef.current = value
      return () => clearTimeout(timer)
    }
    prevValueRef.current = value
  }, [spring, value])

  // Render the MotionValue directly so it updates reactively
  return <motion.span ref={popRef}>{display}</motion.span>
}

// Mini confetti burst — small particles that appear when a vote is cast
const MINI_CONFETTI = Array.from({ length: 8 }, (_, i) => ({
  id: i,
  angle: (i * 45) + Math.random() * 20,
  distance: 40 + Math.random() * 30,
  size: 4 + Math.random() * 3,
  color: ['#F59E0B', '#FBBF24', '#FCD34D', '#FDE68A', '#FFFFFF'][i % 5],
  delay: i * 0.03,
  duration: 0.6 + Math.random() * 0.3,
}))

function MiniConfettiBurst({ active }: { active: boolean }) {
  if (!active) return null
  return (
    <div className="absolute inset-0 pointer-events-none z-50" aria-hidden="true">
      {MINI_CONFETTI.map((p) => {
        const rad = (p.angle * Math.PI) / 180
        const x = Math.cos(rad) * p.distance
        const y = Math.sin(rad) * p.distance
        return (
          <motion.div
            key={p.id}
            className="absolute top-1/2 left-1/2 rounded-full"
            style={{
              width: p.size,
              height: p.size,
              background: p.color,
              boxShadow: '0 0 4px rgba(245,158,11,0.4)',
            }}
            initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
            animate={{ x, y, opacity: 0, scale: 0.3 }}
            transition={{
              duration: p.duration,
              delay: p.delay,
              ease: 'easeOut',
            }}
          />
        )
      })}
    </div>
  )
}

// Custom tooltip for the vote-history chart (dark-card styled)
type RechartsTooltipProps = {
  active?: boolean
  payload?: Array<{ payload: VoteHistoryPoint }>
}
function VoteHistoryTooltip({ active, payload }: RechartsTooltipProps) {
  if (!active || !payload || payload.length === 0) return null
  const point = payload[0].payload
  return (
    <div className="dark-card border border-gold-500/30 rounded-lg px-3 py-2 shadow-xl">
      <div className="text-[10px] text-muted-foreground mb-1.5 font-medium">
        {new Date(point.date).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })}
      </div>
      <div className="flex items-center gap-1.5 text-xs">
        <Vote className="size-3 text-gold-400" />
        <span className="font-bold text-gold-300">{point.votes}</span>
        <span className="text-muted-foreground">new votes</span>
      </div>
      <div className="flex items-center gap-1.5 text-xs mt-0.5">
        <TrendingUp className="size-3 text-gold-400" />
        <span className="font-bold text-white">{point.cumulative.toLocaleString()}</span>
        <span className="text-muted-foreground">cumulative</span>
      </div>
    </div>
  )
}

// Vote Growth chart card — fetches via prop, handles empty state gracefully
function VoteHistoryChart({
  history,
  loading,
  days,
  onDaysChange,
  chartTheme,
  isMobile,
}: {
  history: VoteHistoryPoint[]
  loading: boolean
  days: 7 | 30
  onDaysChange: (d: 7 | 30) => void
  chartTheme: ReturnType<typeof useChartTheme>
  isMobile: boolean
}) {
  const hasData = history.length > 0
  // Show ~6 evenly-spaced date ticks for 30d, ~3 for 7d
  const tickInterval = hasData
    ? Math.max(0, Math.floor(history.length / (days === 7 ? 3 : 6)) - 1)
    : 0

  // On mobile with no data, show a compact message instead of the chart
  if (isMobile && !loading && !hasData) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="dark-card rounded-xl p-4 space-y-3"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <TrendingUp className="size-4 text-gold-500" />
            Vote History
          </h3>
        </div>
        <div className="h-[80px] flex flex-col items-center justify-center text-center">
          <TrendingUp className="size-6 text-muted-foreground/40 mb-1" />
          <p className="text-xs text-muted-foreground font-medium">No vote history yet</p>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="dark-card rounded-xl p-4 space-y-3"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <TrendingUp className="size-4 text-gold-500" />
          Vote History
        </h3>
        <div className="flex items-center gap-2">
          {hasData && (
            <Badge className="bg-gold-500/10 text-gold-300 border-gold-500/20 text-[10px]">
              {history.length} days
            </Badge>
          )}
          {/* 7d / 30d Toggle */}
          <div className="flex items-center rounded-full bg-surface p-0.5 border border-border">
            <button
              onClick={() => onDaysChange(7)}
              className={`px-2.5 py-1 rounded-full text-[10px] font-semibold transition-all duration-200 ${
                days === 7
                  ? 'bg-gold-500 text-[#0B0F17] shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              7d
            </button>
            <button
              onClick={() => onDaysChange(30)}
              className={`px-2.5 py-1 rounded-full text-[10px] font-semibold transition-all duration-200 ${
                days === 30
                  ? 'bg-gold-500 text-[#0B0F17] shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              30d
            </button>
          </div>
        </div>
      </div>
      {loading ? (
        <Skeleton className="h-[200px] w-full bg-surface rounded-lg" />
      ) : !hasData ? (
        <div className="h-[200px] flex flex-col items-center justify-center text-center">
          <TrendingUp className="size-8 text-muted-foreground/40 mb-2" />
          <p className="text-sm text-muted-foreground font-medium">No vote history yet</p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Be the first to vote for this performer!
          </p>
        </div>
      ) : (
        <motion.div
          key={days}
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className={`w-full ${isMobile ? 'h-[160px]' : 'h-[200px]'}`}
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={history} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
              <defs>
                <linearGradient id="voteGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={chartTheme.accent} stopOpacity={0.5} />
                  <stop offset="95%" stopColor={chartTheme.accent} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
              <XAxis
                dataKey="date"
                stroke={chartTheme.tick}
                tick={{ fontSize: 10, fill: chartTheme.tick }}
                tickFormatter={(v: string) => {
                  const d = new Date(v)
                  return `${d.getMonth() + 1}/${d.getDate()}`
                }}
                interval={tickInterval}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke={chartTheme.tick}
                tick={{ fontSize: 10, fill: chartTheme.tick }}
                tickLine={false}
                axisLine={false}
                width={40}
              />
              <RechartsTooltip content={<VoteHistoryTooltip />} />
              <Area
                type="monotone"
                dataKey="cumulative"
                stroke={chartTheme.accent}
                strokeWidth={2}
                fill="url(#voteGradient)"
                activeDot={{
                  r: 4,
                  fill: '#FCD34D',
                  stroke: chartTheme.tooltipBg,
                  strokeWidth: 2,
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>
      )}
    </motion.div>
  )
}

export default function ContestantDetailView({ participantId }: { participantId: string }) {
  const router = useRouter()
  const selectedParticipantId = participantId
  const [participant, setParticipant] = useState<ParticipantItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [quickVoteOpen, setQuickVoteOpen] = useState(false)
  const isMobile = useIsMobile()
  const [bioExpanded, setBioExpanded] = useState(false)
  const [shareModalOpen, setShareModalOpen] = useState(false)
  const [confettiActive, setConfettiActive] = useState(false)

  // Real-time polling + leaderboard state
  const [polling, setPolling] = useState(true)
  const [voteFlash, setVoteFlash] = useState(false)
  const [leaderboard, setLeaderboard] = useState<PublicLeaderboardEntry[]>([])
  const [related, setRelated] = useState<PublicParticipant[]>([])
  const [showBackToTop, setShowBackToTop] = useState(false)

  // Vote-history analytics (Last 30 Days chart)
  const [voteHistory, setVoteHistory] = useState<VoteHistoryPoint[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [historyDays, setHistoryDays] = useState<7 | 30>(30)

  // Track previous vote count to detect increases for the gold-glow flash
  const prevVotesRef = useRef<number | null>(null)
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const loadParticipant = async () => {
    if (!selectedParticipantId) {
      router.push('/contestants')
      return
    }
    try {
      const data = await getParticipant(selectedParticipantId)
      setParticipant(data.participant)
      prevVotesRef.current = data.participant.votes
    } catch {
      // Handle error
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setLoading(true)
    setParticipant(null)
    setLeaderboard([])
    setRelated([])
    prevVotesRef.current = null
    loadParticipant()
  }, [selectedParticipantId])

  // 1. Real-time vote updates via WebSocket (with fallback polling at 30s)
  const { joinParticipant, leaveParticipant, onVoteUpdate } = useRealtime()
  const chartTheme = useChartTheme()

  useEffect(() => {
    if (!selectedParticipantId) return
    setPolling(true)

    // Join the participant room to receive targeted vote updates
    joinParticipant(selectedParticipantId)

    // Listen for real-time vote updates
    const unsubscribe = onVoteUpdate((data: VoteUpdateData) => {
      if (data.participantId !== selectedParticipantId) return
      setParticipant((prev) => {
        if (!prev) return prev
        if (data.votes !== prev.votes) {
          // Trigger gold glow flash on increase
          if (
            prevVotesRef.current !== null &&
            data.votes > prevVotesRef.current
          ) {
            setVoteFlash(true)
            if (flashTimerRef.current) clearTimeout(flashTimerRef.current)
            flashTimerRef.current = setTimeout(
              () => setVoteFlash(false),
              1200,
            )
          }
          prevVotesRef.current = data.votes
          return { ...prev, votes: data.votes }
        }
        return prev
      })
    })

    // Fallback polling at 30s in case WebSocket disconnects
    const interval = setInterval(async () => {
      try {
        const data = await getParticipant(selectedParticipantId)
        const next = data.participant
        setParticipant((prev) => {
          if (!prev) return next
          if (next.votes !== prev.votes) {
            if (
              prevVotesRef.current !== null &&
              next.votes > prevVotesRef.current
            ) {
              setVoteFlash(true)
              if (flashTimerRef.current) clearTimeout(flashTimerRef.current)
              flashTimerRef.current = setTimeout(
                () => setVoteFlash(false),
                1200,
              )
            }
            prevVotesRef.current = next.votes
            return next
          }
          return prev
        })
      } catch {
        // Swallow polling errors silently
      }
    }, 30000)

    return () => {
      leaveParticipant(selectedParticipantId)
      unsubscribe()
      clearInterval(interval)
      setPolling(false)
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current)
    }
  }, [selectedParticipantId, joinParticipant, leaveParticipant, onVoteUpdate])

  // 2. Fetch leaderboard for vote share + rank
  useEffect(() => {
    let cancelled = false
    getPublicLeaderboard()
      .then((res) => {
        if (!cancelled) setLeaderboard(res.leaderboard)
      })
      .catch(() => {
        // ignore
      })
    return () => {
      cancelled = true
    }
  }, [selectedParticipantId])

  // 3. Fetch related participants (same category, exclude current, max 4)
  useEffect(() => {
    let cancelled = false
    getPublicParticipants(1, 100)
      .then((res) => {
        if (cancelled || !participant) return
        const items = res.items || (res as any).participants || []
        const filtered = items
          .filter(
            (p) =>
              p.id !== participant.id &&
              p.category.toLowerCase() === participant.category.toLowerCase(),
          )
          .slice(0, 4)
        if (!cancelled) setRelated(filtered)
      })
      .catch(() => {
        // ignore
      })
    return () => {
      cancelled = true
    }
  }, [participant])

  // 7. Fetch vote-history analytics when participant or days range changes
  useEffect(() => {
    if (!participant) return
    let cancelled = false
    setHistoryLoading(true)
    getParticipantVoteHistory(participant.id, historyDays)
      .then((res) => {
        if (!cancelled) setVoteHistory(res.history)
      })
      .catch(() => {
        if (!cancelled) setVoteHistory([])
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [participant?.id, historyDays])

  // 6. Scroll listener for "Back to top" button
  useEffect(() => {
    const onScroll = () => {
      setShowBackToTop(window.scrollY > 500)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const handleVoteClick = () => {
    // Open Quick Vote dialog directly — no auth required
    setQuickVoteOpen(true)
  }

  const handleQuickVoteSuccess = useCallback(() => {
    // Trigger gold glow flash after successful quick vote
    setVoteFlash(true)
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current)
    flashTimerRef.current = setTimeout(() => setVoteFlash(false), 1200)
    // Trigger confetti burst
    setConfettiActive(true)
    setTimeout(() => setConfettiActive(false), 1000)
    // Refresh participant data
    if (participant) {
      getParticipant(participant.id).then(({ participant: p }) => {
        prevVotesRef.current = p.votes
        setParticipant(p)
      }).catch(() => {})
    }
  }, [participant])

  const handleRelatedClick = (id: string) => {
    router.push(`/contestants/${id}`)
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const handleBackToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Derived vote share + rank
  const totalVotes = leaderboard.reduce((sum, e) => sum + (e.votes || 0), 0)
  const currentVotes = participant?.votes ?? 0
  const voteSharePct =
    totalVotes > 0 ? (currentVotes / totalVotes) * 100 : 0
  const rankIndex = participant
    ? leaderboard.findIndex((e) => e.id === participant.id)
    : -1
  const rank = rankIndex >= 0 ? rankIndex + 1 : null

  // 5. Voting stats
  const trending = rank !== null && rank <= 3

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <Skeleton className="h-8 w-32 bg-surface mb-8" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Skeleton className="aspect-video bg-surface rounded-2xl" />
            <div className="space-y-4">
              <Skeleton className="h-8 w-48 bg-surface" />
              <Skeleton className="h-6 w-32 bg-surface" />
              <Skeleton className="h-24 bg-surface rounded-xl" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!participant) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Participant not found</h2>
          <Button onClick={() => router.push('/contestants')} variant="outline" className="rounded-full">
            Back to Contestants
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header — sticky on mobile with name + favorite */}
      <header className="sticky top-0 z-30 glass-strong border-b border-border">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/contestants')}
            className="text-muted-foreground hover:text-foreground hover:bg-accent rounded-full gap-2"
          >
            <ArrowLeft className="size-4" />
            <span className="hidden sm:inline">Back to Contestants</span>
            <span className="sm:hidden">Back</span>
          </Button>
          {/* Mobile: show participant name in header */}
          {isMobile && participant && (
            <span className="text-sm font-semibold truncate max-w-[140px]" style={{ color: 'var(--text-primary)' }}>
              {participant.name}
            </span>
          )}
          <div className="flex items-center gap-2">
            <Button
              onClick={() => setShareModalOpen(true)}
              variant="outline"
              className="rounded-full gap-2 border-gold-500/30 text-gold-400 hover:bg-gold-500/10 hover:text-gold-300"
            >
              <Share2 className="size-4" />
              <span className="hidden sm:inline">Share</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Banner — full-width gradient header with avatar + stats */}
      <motion.section
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="relative h-[200px] md:h-[280px] overflow-hidden"
        style={{ background: 'linear-gradient(135deg, hsl(220, 70%, 40%), hsl(260, 70%, 30%))' }}
      >
        {/* Dark overlay for text contrast */}
        <div className="absolute inset-0 bg-gradient-to-b from-background/50 via-background/30 to-background/85" />
        {/* Bokeh accents */}
        <div className="absolute -top-12 -right-12 w-64 h-64 rounded-full bg-gold-500/25 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-48 h-48 rounded-full bg-amber-400/15 blur-3xl pointer-events-none" />

        <div className="relative z-10 h-full max-w-6xl mx-auto px-4 py-5 md:py-7 flex flex-col justify-between">
          {/* Top row: avatar + name + watch button */}
          <div className="flex flex-col sm:flex-row items-center sm:items-end gap-4 sm:gap-6">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.15, type: 'spring', stiffness: 200, damping: 18 }}
              className="w-[110px] h-[110px] md:w-[160px] md:h-[160px] rounded-2xl shadow-2xl border-4 border-white/15 backdrop-blur-sm shrink-0 overflow-hidden"
            >
              <ParticipantAvatar
                name={participant.name}
                imageUrl={participant.imageUrl}
                thumbnailUrl={participant.thumbnailUrl}
                size="full"
                eager={true}
                className="rounded-2xl"
              />
            </motion.div>

            <div className="flex-1 text-center sm:text-left min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-2 justify-center sm:justify-start">
                <Badge className="bg-gold-500/15 text-gold-200 border-gold-500/30 backdrop-blur-sm">
                  <Music className="size-3 mr-1" />
                  {participant.category}
                </Badge>
              </div>
              <h1 className="text-2xl sm:text-3xl md:text-5xl font-bold text-white mb-3 drop-shadow-lg truncate">
                {participant.name}
              </h1>
              <a
                href={participant.videoUrl ?? undefined}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block"
              >
                <Button className="bg-gold-500 hover:bg-gold-600 text-[#0B0F17] font-semibold rounded-full px-6 h-11 gold-glow-sm gap-2">
                  <Play className="size-4" />
                  Watch Performance
                </Button>
              </a>
            </div>
          </div>

          {/* Bottom row: 3 mini stat pills */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.4 }}
            className="flex flex-wrap items-center gap-2 justify-center sm:justify-start"
          >
            <div className="glass rounded-full px-3 py-1.5 flex items-center gap-1.5 text-xs">
              <Vote className="size-3.5 text-gold-300" />
              <span className="font-bold text-white">
                {participant.votes.toLocaleString()}
              </span>
              <span className="text-muted-foreground">votes</span>
            </div>
            {rank !== null && (
              <div className="glass rounded-full px-3 py-1.5 flex items-center gap-1.5 text-xs">
                <Crown className="size-3.5 text-gold-300" />
                <span className="font-bold text-white">Rank #{rank}</span>
              </div>
            )}
            {totalVotes > 0 && (
              <div className="glass rounded-full px-3 py-1.5 flex items-center gap-1.5 text-xs">
                <TrendingUp className="size-3.5 text-gold-300" />
                <span className="font-bold text-white">{voteSharePct.toFixed(1)}%</span>
                <span className="text-muted-foreground">share</span>
              </div>
            )}
            {polling && (
              <div className="glass rounded-full px-3 py-1.5 flex items-center gap-1.5 text-xs">
                <span className="relative flex size-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full size-2 bg-emerald-500" />
                </span>
                <span className="font-semibold text-emerald-300 uppercase tracking-wider text-[10px]">
                  Live
                </span>
              </div>
            )}
          </motion.div>
        </div>
      </motion.section>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Video Area */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="dark-card rounded-2xl overflow-hidden">
              {/* Video Player Placeholder */}
              <div className="relative aspect-video bg-gradient-to-br from-surface-light to-surface flex items-center justify-center">
                <div className="absolute inset-0 bg-gradient-to-br from-gold-500/5 via-transparent to-gold-600/5" />

                {/* Play button */}
                <a
                  href={participant.videoUrl ?? undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="relative z-10"
                >
                  <div className="w-20 h-20 rounded-full bg-gold-500/90 flex items-center justify-center shadow-lg hover:bg-gold-500 transition-colors gold-glow-sm cursor-pointer group">
                    <Play className="size-8 text-[#0B0F17] ml-1 group-hover:scale-110 transition-transform" />
                  </div>
                </a>

              </div>
            </div>
          </motion.div>

          {/* Info Panel */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="space-y-6"
          >
            {/* Badges */}
            <div className="flex flex-wrap gap-2">
              <Badge
                variant="secondary"
                className="bg-gold-500/10 text-gold-400 border-gold-500/20"
              >
                <Music className="size-3 mr-1" />
                {participant.category}
              </Badge>
            </div>

            {/* Name */}
            <h1 className="text-3xl sm:text-4xl font-bold">{participant.name}</h1>

            {/* Vote Count with Live indicator + gold-glow flash */}
            <motion.div
              animate={
                voteFlash
                  ? {
                      boxShadow: [
                        '0 0 0px 0px rgba(245,158,11,0)',
                        '0 0 24px 4px rgba(245,158,11,0.55)',
                        '0 0 0px 0px rgba(245,158,11,0)',
                      ],
                      scale: [1, 1.04, 1],
                    }
                  : { boxShadow: '0 0 0px 0px rgba(245,158,11,0)' }
              }
              transition={{ duration: 1.1, ease: 'easeOut' }}
              className="flex items-center gap-3 rounded-xl p-2 -m-2"
            >
              <div className="w-12 h-12 rounded-full bg-gold-500/10 flex items-center justify-center">
                <Vote className="size-5 text-gold-500" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-2xl font-bold text-gold-400">
                    <AnimatedVoteCount value={participant.votes} />
                  </span>
                  {/* Live pulsing indicator */}
                  {polling && (
                    <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2 py-0.5">
                      <motion.span
                        animate={{ opacity: [1, 0.3, 1], scale: [1, 0.85, 1] }}
                        transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
                        className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400"
                      />
                      Live
                    </span>
                  )}
                </div>
                <div className="text-sm text-muted-foreground">total votes</div>
              </div>
            </motion.div>

            {/* 2. Vote Share Progress Bar */}
            {totalVotes > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="dark-card rounded-xl p-4 space-y-2"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    {voteSharePct.toFixed(1)}% of total votes
                  </span>
                  {rank !== null && (
                    <span className="inline-flex items-center gap-1 text-gold-400 font-semibold">
                      <Badge className="bg-gold-500/15 text-gold-300 border-gold-500/30 text-[10px] px-1.5 py-0">
                        Rank: #{rank}
                      </Badge>
                    </span>
                  )}
                </div>
                <div className="relative h-2.5 rounded-full bg-surface overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, voteSharePct)}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                    className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-gold-500 to-amber-400"
                  />
                </div>
              </motion.div>
            )}

            {/* Bio */}
            {participant.bio && (
              <div className="dark-card rounded-xl p-4">
                <p
                  className={`text-muted-foreground leading-relaxed text-sm cursor-pointer ${isMobile && !bioExpanded ? 'line-clamp-3' : ''}`}
                  onClick={() => isMobile && setBioExpanded(!bioExpanded)}
                  role={isMobile ? 'button' : undefined}
                  tabIndex={isMobile ? 0 : undefined}
                >
                  {participant.bio}
                </p>
                {isMobile && participant.bio.length > 120 && (
                  <button
                    onClick={() => setBioExpanded(!bioExpanded)}
                    className="text-xs font-medium mt-1 hover:underline"
                    style={{ color: '#F59E0B' }}
                  >
                    {bioExpanded ? 'Show less' : 'Read more'}
                  </button>
                )}
              </div>
            )}

            {/* Vote Growth Chart — Last 30 Days */}
            <VoteHistoryChart
              history={voteHistory}
              loading={historyLoading}
              days={historyDays}
              onDaysChange={setHistoryDays}
              chartTheme={chartTheme}
              isMobile={isMobile}
            />

            {/* Performance Details */}
            <div className="dark-card rounded-xl p-4 space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Performance Details
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2">
                  <Star className="size-4 text-gold-500" />
                  <span className="text-sm text-muted-foreground">Category:</span>
                  <span className="text-sm font-medium">{participant.category}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="size-4 text-gold-500" />
                  <span className="text-sm text-muted-foreground">Joined:</span>
                  <span className="text-sm font-medium">
                    {new Date(participant.createdAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                </div>
              </div>
            </div>

            {/* Voting Section */}
            <div className={`dark-card rounded-xl ${isMobile ? 'p-4' : 'p-6'}`}>
              <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Vote className="size-5 text-gold-500" />
                    <h3 className="font-semibold">Vote for {participant.name}</h3>
                  </div>
                  {!isMobile && (
                    <p className="text-sm text-muted-foreground">
                      Pay to cast your votes and support this performer. Each $1 = 1 vote.
                    </p>
                  )}

                  {/* 5. Voting Stats Card */}
                  <div className={`grid ${isMobile ? 'grid-cols-3 gap-1.5' : 'grid-cols-3 gap-2'}`}>
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                      className="bg-surface rounded-lg p-3 text-center"
                    >
                      <Heart className="size-4 text-rose-400 mx-auto mb-1" />
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Your Impact
                      </div>
                      <div className="text-sm font-bold text-rose-300">+1 vote</div>
                    </motion.div>
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: 0.05 }}
                      className="bg-surface rounded-lg p-3 text-center"
                    >
                      <Users className="size-4 text-sky-300 mx-auto mb-1" />
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Supporters
                      </div>
                      <div className="text-sm font-bold text-sky-200">
                        N/A
                      </div>
                    </motion.div>
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: 0.1 }}
                      className="bg-surface rounded-lg p-3 text-center"
                    >
                      <TrendingUp
                        className={`size-4 mx-auto mb-1 ${
                          trending ? 'text-emerald-400' : 'text-muted-foreground'
                        }`}
                      />
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Trending
                      </div>
                      <div
                        className={`text-sm font-bold ${
                          trending ? 'text-emerald-300' : 'text-muted-foreground'
                        }`}
                      >
                        {trending ? 'Yes' : 'No'}
                      </div>
                    </motion.div>
                  </div>

                  {/* Hide vote button on mobile — floating button replaces it */}
                  {!isMobile && (
                    <div className="relative">
                      <MiniConfettiBurst active={confettiActive} />
                      <Button
                        onClick={handleVoteClick}
                        className="w-full bg-gold-500 hover:bg-gold-600 text-[#0B0F17] font-semibold rounded-full h-12 gold-glow-sm vote-btn-shimmer ripple-effect subscribe-press"
                      >
                        <Vote className="size-4 mr-1" />
                        Vote for {participant.name}
                      </Button>
                    </div>
                  )}
                </div>
            </div>

            {/* 4. Social Share Card */}
            <div className="space-y-2">
              <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                Share on social
              </div>
              <ContestantShareCard
                id={participant.id}
                name={participant.name}
                category={participant.category}
                votes={participant.votes}
                rank={rank ?? undefined}
                bio={participant.bio}
                imageUrl={participant.imageUrl}
                thumbnailUrl={participant.thumbnailUrl}
                compact
              />
            </div>
          </motion.div>
        </div>

        {/* 3. Related Contestants Section — enhanced as a prominent footer section */}
        {related.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.5 }}
            className="mt-14 pt-8 border-t border-border"
          >
            <div className="flex items-center justify-between mb-5">
              <div>
                <div className="text-[10px] uppercase tracking-[0.2em] text-gold-400 font-semibold mb-1">
                  Keep Exploring
                </div>
                <h2 className="text-xl sm:text-2xl font-bold">
                  More{' '}
                  <span className="text-gold-400">{participant.category}</span>{' '}
                  Performers
                </h2>
              </div>
              <button
                onClick={() => router.push('/contestants')}
                className="inline-flex items-center gap-1 text-sm text-gold-400 hover:text-gold-300 transition-colors rounded-full px-3 py-1.5 border border-gold-500/20 hover:border-gold-500/40 hover:bg-gold-500/10"
              >
                See All
                <ChevronRight className="size-4" />
              </button>
            </div>
            <div className="flex gap-3 overflow-x-auto scrollbar-thin pb-3 -mx-1 px-1">
              {related.map((rel, idx) => (
                <motion.button
                  key={rel.id}
                  initial={{ opacity: 0, x: 16 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.35, delay: idx * 0.06 }}
                  whileHover={{ y: -3 }}
                  onClick={() => handleRelatedClick(rel.id)}
                  className="min-w-[220px] max-w-[240px] shrink-0 dark-card rounded-xl p-4 text-left hover:border-gold-500/40 border border-border transition-colors"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="shrink-0 rounded-full overflow-hidden">
                      <ParticipantAvatar
                        name={rel.name}
                        imageUrl={rel.imageUrl}
                        thumbnailUrl={rel.thumbnailUrl}
                        size="sm"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold truncate text-sm">{rel.name}</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Vote className="size-3.5 text-gold-500" />
                      <span className="text-sm font-bold text-gold-400">
                        {rel.votes.toLocaleString()}
                      </span>
                      <span className="text-[10px] text-muted-foreground">votes</span>
                    </div>
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gold-500/10 text-gold-400">
                      <ChevronRight className="size-4" />
                    </span>
                  </div>
                </motion.button>
              ))}
            </div>
          </motion.section>
        )}
      </main>

      {/* 6. Back to Top Floating Button (desktop only) */}
      <AnimatePresence>
        {showBackToTop && !isMobile && (
          <motion.button
            key="back-to-top"
            initial={{ opacity: 0, scale: 0.6, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.6, y: 10 }}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            onClick={handleBackToTop}
            aria-label="Back to top"
            className="fixed bottom-6 right-6 z-40 w-12 h-12 rounded-full bg-gradient-to-br from-gold-400 to-amber-500 text-[#0B0F17] flex items-center justify-center shadow-lg gold-glow-sm"
          >
            <ArrowUp className="size-5" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Mobile Quick Vote / Unlock Floating Button */}
      {isMobile && (
        <div className="fixed bottom-20 left-4 right-4 z-40 md:hidden">
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-gold-500 via-gold-400 to-gold-600 rounded-full blur-md opacity-50 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="relative">
              <MiniConfettiBurst active={confettiActive} />
              <Button
                onClick={handleVoteClick}
                className="relative w-full bg-gold-500 hover:bg-gold-600 text-[#0B0F17] font-semibold rounded-full h-14 text-base shadow-xl vote-btn-shimmer ripple-effect subscribe-press"
              >
                <Vote className="size-5 mr-2" />
                Vote for {participant.name}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Voting Modal — replaced by QuickVoteDialog (payment-based voting) */}
      <QuickVoteDialog
        open={quickVoteOpen}
        onOpenChange={setQuickVoteOpen}
        participant={participant ? { id: participant.id, name: participant.name, category: participant.category } : null}
        onVoted={handleQuickVoteSuccess}
      />

      {/* Share Modal */}
      <ShareModal
        open={shareModalOpen}
        onOpenChange={setShareModalOpen}
        title={participant ? `${participant.name} — Vibe Hub` : 'Vibe Hub Contestant'}
        description={
          participant
            ? `Check out ${participant.name} on Vibe Hub — ${participant.category} performer! Cast your vote now!`
            : 'Check out Vibe Hub — vote for your favorite performers!'
        }
        contestant={
          participant
            ? {
                name: participant.name,
                category: participant.category,
                votes: participant.votes,
                rank: rank ?? undefined,
              }
            : undefined
        }
        participantId={participant?.id}
      />
    </div>
  )
}
