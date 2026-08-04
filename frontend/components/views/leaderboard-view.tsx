'use client'

import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { motion, AnimatePresence, type Variants } from 'framer-motion'
import {
  ArrowLeft,
  Crown,
  Medal,
  Trophy,
  Vote,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Minus,
  Share2,
  Search,
  Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { useAppStore } from '@/lib/store'
import { useRouter } from 'next/navigation'
import {
  getPublicLeaderboard,
  getPublicStats,
  type PublicLeaderboardEntry,
  type PublicStats,
} from '@/lib/api'
import { useRealtime, type VoteUpdateData, type VoteMilestoneData } from '@/hooks/use-realtime'
import { ParticipantAvatar } from '@/components/shared/participant-avatar'
import { EmptyState as SharedEmptyState } from '@/components/shared/empty-state'
import { ShareModal } from '@/components/shared/share-modal'
import { ContestantShareCard } from '@/components/shared/contestant-share-card'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
}

const rowVariants: Variants = {
  hidden: { opacity: 0, x: -20 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.4, ease: 'easeOut' as const },
  },
}

const DEFAULT_CATEGORIES = ['All'] as const

// Simulated rank change (random but deterministic per name) - fallback for initial render
function getRankChange(name: string): 'up' | 'down' | 'same' {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  const mod = Math.abs(hash) % 3
  return mod === 0 ? 'up' : mod === 1 ? 'down' : 'same'
}

// Confetti particles for #1 spot
const CONFETTI_PARTICLES = Array.from({ length: 10 }, (_, i) => ({
  id: i,
  left: Math.random() * 100,
  delay: Math.random() * 2,
  duration: 2.5 + Math.random() * 2,
  size: 4 + Math.random() * 4,
  rotate: Math.random() * 360,
}))

function LeaderboardSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="dark-card rounded-xl p-4 flex items-center gap-4">
          <Skeleton className="size-10 rounded-full bg-surface-light shrink-0" />
          <Skeleton className="h-5 w-32 bg-surface-light" />
          <Skeleton className="h-5 w-16 bg-surface-light ml-auto" />
        </div>
      ))}
    </div>
  )
}

function ImpactStatBox({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="rounded-xl bg-secondary border border-border p-3 text-center">
      <div className={cn('text-lg font-bold', accent ? 'text-gold-400' : 'text-foreground')}>{value}</div>
      <div className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wide">{label}</div>
    </div>
  )
}

export default function LeaderboardView() {
  const router = useRouter()
  const [leaderboard, setLeaderboard] = useState<PublicLeaderboardEntry[]>([])
  const [stats, setStats] = useState<PublicStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState<string>('All')
  const [searchQuery, setSearchQuery] = useState('')
  const [voteChanges, setVoteChanges] = useState<Record<string, { amount: number; key: number }>>({})
  const [flashingIds, setFlashingIds] = useState<Set<string>>(new Set())
  // Phase 9 — rows that just gained a vote get a brief gold pulse
  const [pulseIds, setPulseIds] = useState<Set<string>>(new Set())
  // Phase 9 — rows whose participant just crossed a vote milestone get a
  // brief gold border + trophy emoji overlay
  const [milestoneIds, setMilestoneIds] = useState<Set<string>>(new Set())

  // Derive categories from the loaded leaderboard data
  const categories = useMemo(() => {
    const unique = [...new Set(leaderboard.map((e) => e.category).filter(Boolean))]
    return ['All', ...unique.sort()]
  }, [leaderboard])

  // Refs for polling comparison
  const prevDataRef = useRef<PublicLeaderboardEntry[]>([])
  const voteChangeTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pulseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const milestoneTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleRowClick = (id: string) => {
    router.push(`/contestants/${id}`)
  }

  // Compute vote/rank changes and update state
  const applyPolledData = useCallback((data: PublicLeaderboardEntry[]) => {
    const prev = prevDataRef.current
    if (prev.length === 0) {
      prevDataRef.current = data
      return
    }

    const prevMap = new Map(prev.map((e, i) => [e.id, { votes: e.votes, rank: i }]))

    let changed = false
    const newVoteChanges: Record<string, { amount: number; key: number }> = {}
    const newFlashing = new Set<string>()

    data.forEach((entry, i) => {
      const prevEntry = prevMap.get(entry.id)
      if (!prevEntry) {
        changed = true
        return
      }
      if (prevEntry.votes !== entry.votes) {
        changed = true
        const diff = entry.votes - prevEntry.votes
        if (diff > 0) {
          newVoteChanges[entry.id] = { amount: diff, key: Date.now() }
        }
      }
      if (prevEntry.rank !== i) {
        newFlashing.add(entry.id)
      }
    })

    if (prev.length !== data.length) changed = true

    if (!changed) return

    prevDataRef.current = data
    setLeaderboard(data)

    if (Object.keys(newVoteChanges).length > 0) {
      setVoteChanges(newVoteChanges)
      // Clear timers and set a new one to clear all vote changes
      Object.values(voteChangeTimersRef.current).forEach((t) => clearTimeout(t))
      const t = setTimeout(() => setVoteChanges({}), 2500)
      voteChangeTimersRef.current.__all = t
    }
    if (newFlashing.size > 0) {
      setFlashingIds(newFlashing)
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current)
      flashTimerRef.current = setTimeout(() => setFlashingIds(new Set()), 1200)
    }
  }, [])

  // Initial load + real-time WebSocket updates (with fallback polling at 30s)
  const { onLeaderboardUpdate, onVoteMilestone } = useRealtime()

  useEffect(() => {
    let mounted = true

    async function loadInitial() {
      try {
        const [lbData, statsData] = await Promise.all([
          getPublicLeaderboard(),
          getPublicStats().catch(() => null),
        ])
        if (!mounted) return
        prevDataRef.current = lbData.leaderboard
        setLeaderboard(lbData.leaderboard)
        if (statsData) setStats(statsData)
      } catch {
        // Handle error
      } finally {
        if (mounted) setLoading(false)
      }
    }
    loadInitial()

    // Listen for real-time vote updates via WebSocket
    const unsubscribe = onLeaderboardUpdate((data: VoteUpdateData) => {
      if (!mounted) return
      setLeaderboard((prev) => {
        // Find the participant and update their votes
        const updated = prev.map((entry) =>
          entry.id === data.participantId
            ? { ...entry, votes: data.votes }
            : entry,
        )
        // Re-sort by votes descending
        updated.sort((a, b) => b.votes - a.votes)

        // Compute vote/rank changes for visual feedback
        const prevMap = new Map(prevDataRef.current.map((e, i) => [e.id, { votes: e.votes, rank: i }]))
        const newVoteChanges: Record<string, { amount: number; key: number }> = {}
        const newFlashing = new Set<string>()
        const newPulse = new Set<string>()

        updated.forEach((entry, i) => {
          const prevEntry = prevMap.get(entry.id)
          if (!prevEntry) return
          if (prevEntry.votes !== entry.votes) {
            const diff = entry.votes - prevEntry.votes
            if (diff > 0) {
              newVoteChanges[entry.id] = { amount: diff, key: Date.now() }
              // Phase 9 — add a brief gold pulse to rows whose votes increased
              newPulse.add(entry.id)
            }
          }
          if (prevEntry.rank !== i) {
            newFlashing.add(entry.id)
          }
        })

        if (Object.keys(newVoteChanges).length > 0) {
          setVoteChanges(newVoteChanges)
          Object.values(voteChangeTimersRef.current).forEach((t) => clearTimeout(t))
          const t = setTimeout(() => setVoteChanges({}), 2500)
          voteChangeTimersRef.current.__all = t
        }
        if (newFlashing.size > 0) {
          setFlashingIds(newFlashing)
          if (flashTimerRef.current) clearTimeout(flashTimerRef.current)
          flashTimerRef.current = setTimeout(() => setFlashingIds(new Set()), 1200)
        }
        if (newPulse.size > 0) {
          setPulseIds(newPulse)
          if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current)
          pulseTimerRef.current = setTimeout(() => setPulseIds(new Set()), 1500)
        }

        prevDataRef.current = updated
        return updated
      })
    })

    // Phase 9 — listen for milestone events and briefly highlight the
    // affected row with a gold border + trophy emoji overlay.
    const unsubscribeMilestone = onVoteMilestone((data: VoteMilestoneData) => {
      if (!mounted) return
      setMilestoneIds((prev) => {
        const next = new Set(prev)
        next.add(data.participantId)
        return next
      })
      toast.success(
        `🏆 ${data.participantName} reached ${data.milestone.toLocaleString()} votes!`,
        { duration: 5000 },
      )
      if (milestoneTimerRef.current) clearTimeout(milestoneTimerRef.current)
      milestoneTimerRef.current = setTimeout(() => {
        setMilestoneIds(new Set())
      }, 5000)
    })

    // Fallback polling at 30s in case WebSocket disconnects
    const interval = setInterval(async () => {
      try {
        const data = await getPublicLeaderboard()
        if (!mounted) return
        applyPolledData(data.leaderboard)
      } catch {
        // Ignore polling errors
      }
    }, 30000)

    return () => {
      mounted = false
      unsubscribe()
      unsubscribeMilestone()
      clearInterval(interval)
      Object.values(voteChangeTimersRef.current).forEach((t) => clearTimeout(t))
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current)
      if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current)
      if (milestoneTimerRef.current) clearTimeout(milestoneTimerRef.current)
    }
  }, [applyPolledData, onLeaderboardUpdate, onVoteMilestone])

  const maxVotes = useMemo(() => {
    if (leaderboard.length === 0) return 1
    return leaderboard[0].votes
  }, [leaderboard])

  const totalVotes = useMemo(() => {
    return leaderboard.reduce((sum, e) => sum + e.votes, 0)
  }, [leaderboard])

  // Filtered list (podium always shows overall top 3)
  const filteredLeaderboard = useMemo(() => {
    let result = leaderboard
    if (category !== 'All') {
      result = result.filter((e) => e.category === category)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter((e) => e.name.toLowerCase().includes(q))
    }
    return result
  }, [leaderboard, category, searchQuery])

  const avgVotes = useMemo(() => {
    if (!stats || stats.totalParticipants === 0) return '—'
    return Math.round(stats.totalVotes / stats.totalParticipants).toLocaleString()
  }, [stats])

  // Share modal state
  const [shareModalOpen, setShareModalOpen] = useState(false)
  const [shareParticipant, setShareParticipant] = useState<PublicLeaderboardEntry | null>(null)

  const handleShareEntry = useCallback((entry: PublicLeaderboardEntry, e: React.MouseEvent) => {
    e.stopPropagation()
    setShareParticipant(entry)
    setShareModalOpen(true)
  }, [])

  const countLabel = searchQuery.trim()
    ? `${filteredLeaderboard.length} matching performer${filteredLeaderboard.length === 1 ? '' : 's'}`
    : `${filteredLeaderboard.length} performer${filteredLeaderboard.length === 1 ? '' : 's'} in ${
        category === 'All' ? 'all categories' : category
      }`

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 glass-strong border-b border-border">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3 flex-wrap">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push('/')}
              className="text-muted-foreground hover:text-foreground hover:bg-accent rounded-full shrink-0"
            >
              <ArrowLeft className="size-5" />
            </Button>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold">Leaderboard</h1>
              <p className="text-xs text-muted-foreground">
                {loading ? 'Loading...' : `Top ${leaderboard.length} performers`}
              </p>
            </div>

            {/* Live indicator */}
            {!loading && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/10 border border-green-500/20 shrink-0">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                <span className="text-xs font-medium text-green-400">Live</span>
              </div>
            )}

            {/* Share button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShareModalOpen(true)}
              aria-label="Share leaderboard"
              className="size-8 rounded-full text-muted-foreground hover:text-foreground hover:bg-gold-500/20"
            >
              <Share2 className="size-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Leaderboard Content */}
      <main className="max-w-3xl mx-auto px-4 py-6">
        {loading ? (
          <LeaderboardSkeleton />
        ) : leaderboard.length === 0 ? (
          <SharedEmptyState
            icon={Trophy}
            title="No results yet"
            description="The leaderboard will populate once voting begins. Be the first to cast your vote!"
            actionLabel="Browse Contestants"
            onAction={() => {
              setSelectedParticipantId(null)
              router.push('/contestants')
            }}
          />
        ) : (
          <>
            {/* Top 3 Podium — 2nd (left), 1st (center), 3rd (right) */}
            {leaderboard.length >= 3 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="flex items-end justify-center gap-3 mb-10"
              >
                {/* 2nd Place */}
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2, duration: 0.5 }}
                  whileHover={{ y: -4, transition: { duration: 0.2 } }}
                  onClick={() => handleRowClick(leaderboard[1].id)}
                  className="cursor-pointer group flex-1 max-w-[160px]"
                >
                  <motion.div
                    animate={{ y: [0, -8, 0] }}
                    transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
                  >
                    <div className="relative">
                      <div
                        className="absolute -inset-px rounded-2xl opacity-30 group-hover:opacity-70 transition-opacity"
                        style={{ background: 'linear-gradient(135deg, #9CA3AF, #6B7280, #9CA3AF)' }}
                      />
                      <div
                        className="relative dark-card rounded-2xl p-5 text-center border-glow podium-2nd"
                        style={{ borderColor: 'rgba(156, 163, 175, 0.3)' }}
                      >
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center"
                            style={{ background: 'linear-gradient(135deg, #9CA3AF, #6B7280)' }}
                          >
                            <Medal className="size-4 text-white" />
                          </div>
                        </div>
                        <ParticipantAvatar
                          name={leaderboard[1].name}
                          imageUrl={leaderboard[1].imageUrl}
                          thumbnailUrl={leaderboard[1].thumbnailUrl}
                          size="md"
                          className="rounded-full mx-auto mb-3"
                          eager
                        />
                        <div className="text-xs text-gray-400 mb-0.5">2nd Place</div>
                        <div className="text-sm font-semibold truncate mb-1">{leaderboard[1].name}</div>
                        <div className="text-xs text-gray-300 font-bold">
                          {leaderboard[1].votes.toLocaleString()}
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          {totalVotes > 0 ? ((leaderboard[1].votes / totalVotes) * 100).toFixed(1) : 0}%
                        </div>
                        {/* Mini progress bar */}
                        <div className="mt-2 h-1 rounded-full bg-surface overflow-hidden">
                          <div
                            className="h-full rounded-full progress-gradient"
                            style={{
                              width: `${totalVotes > 0 ? (leaderboard[1].votes / maxVotes) * 100 : 0}%`,
                              background: 'linear-gradient(90deg, #9CA3AF, #6B7280, #9CA3AF)',
                              backgroundSize: '200% 100%',
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </motion.div>

                {/* 1st Place — Prominent with confetti and crown shimmer */}
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1, duration: 0.5 }}
                  whileHover={{ y: -4, transition: { duration: 0.2 } }}
                  onClick={() => handleRowClick(leaderboard[0].id)}
                  className="cursor-pointer group flex-1 max-w-[180px] relative"
                >
                  {/* Confetti particles around #1 */}
                  <div className="absolute inset-0 pointer-events-none overflow-visible z-20">
                    {CONFETTI_PARTICLES.map((p) => (
                      <motion.div
                        key={p.id}
                        className="absolute rounded-sm"
                        style={{
                          left: `${p.left}%`,
                          top: 0,
                          width: p.size,
                          height: p.size,
                          background: 'linear-gradient(135deg, #F59E0B, #FCD34D)',
                          boxShadow: '0 0 6px rgba(245,158,11,0.6)',
                        }}
                        initial={{ y: -10, opacity: 0, rotate: p.rotate }}
                        animate={{ y: [0, 220, 260], opacity: [0, 1, 1, 0], rotate: p.rotate + 180 }}
                        transition={{
                          duration: p.duration,
                          delay: p.delay,
                          repeat: Infinity,
                          ease: 'easeIn',
                        }}
                      />
                    ))}
                  </div>

                  <motion.div
                    animate={{ y: [0, -8, 0] }}
                    transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: 0 }}
                  >
                    <div className="relative">
                      <div
                        className="absolute -inset-1 rounded-2xl opacity-50 group-hover:opacity-100 transition-opacity"
                        style={{
                          background: 'linear-gradient(135deg, #F59E0B, #D97706, #F59E0B)',
                          filter: 'blur(4px)',
                        }}
                      />
                      <div
                        className="relative dark-card rounded-2xl p-5 text-center gold-border pulse-glow podium-1st"
                      >
                        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                          <div
                            className="w-9 h-9 rounded-full flex items-center justify-center gold-glow-sm focus-ring-gold crown-shimmer-enhanced crown-bounce"
                            style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)' }}
                          >
                            <Crown className="size-4.5 text-[#0B0F17]" />
                          </div>
                        </div>
                        <Badge className="bg-gold-500/20 text-gold-400 border-gold-500/30 text-[10px] mb-2 mt-1">
                          Leading
                        </Badge>
                        <ParticipantAvatar
                          name={leaderboard[0].name}
                          imageUrl={leaderboard[0].imageUrl}
                          thumbnailUrl={leaderboard[0].thumbnailUrl}
                          size="lg"
                          className="rounded-full mx-auto mb-3 focus-ring-gold"
                          style={{ boxShadow: '0 0 20px rgba(245,158,11,0.3)' }}
                          eager
                        />
                        <div className="text-sm font-semibold truncate mb-1">{leaderboard[0].name}</div>
                        <div className="text-gold-400 font-bold text-lg">
                          {leaderboard[0].votes.toLocaleString()}
                        </div>
                        <div className="text-xs text-gold-400/70 mt-0.5">
                          {totalVotes > 0 ? ((leaderboard[0].votes / totalVotes) * 100).toFixed(1) : 0}%
                        </div>
                        {/* Mini progress bar */}
                        <div className="mt-2 h-1 rounded-full bg-surface overflow-hidden">
                          <div
                            className="h-full rounded-full progress-gradient"
                            style={{
                              width: '100%',
                              background: 'linear-gradient(90deg, #F59E0B, #D97706, #F59E0B)',
                              backgroundSize: '200% 100%',
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </motion.div>

                {/* 3rd Place */}
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3, duration: 0.5 }}
                  whileHover={{ y: -4, transition: { duration: 0.2 } }}
                  onClick={() => handleRowClick(leaderboard[2].id)}
                  className="cursor-pointer group flex-1 max-w-[160px]"
                >
                  <motion.div
                    animate={{ y: [0, -8, 0] }}
                    transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
                  >
                    <div className="relative">
                      <div
                        className="absolute -inset-px rounded-2xl opacity-30 group-hover:opacity-70 transition-opacity"
                        style={{ background: 'linear-gradient(135deg, #D97706, #92400E, #D97706)' }}
                      />
                      <div
                        className="relative dark-card rounded-2xl p-5 text-center border-glow podium-3rd"
                        style={{ borderColor: 'rgba(217, 119, 6, 0.3)' }}
                      >
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center"
                            style={{ background: 'linear-gradient(135deg, #D97706, #92400E)' }}
                          >
                            <Medal className="size-4 text-white" />
                          </div>
                        </div>
                        <ParticipantAvatar
                          name={leaderboard[2].name}
                          imageUrl={leaderboard[2].imageUrl}
                          thumbnailUrl={leaderboard[2].thumbnailUrl}
                          size="md"
                          className="rounded-full mx-auto mb-3"
                          eager
                        />
                        <div className="text-xs text-amber-500 mb-0.5">3rd Place</div>
                        <div className="text-sm font-semibold truncate mb-1">{leaderboard[2].name}</div>
                        <div className="text-xs text-amber-500 font-bold">
                          {leaderboard[2].votes.toLocaleString()}
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          {totalVotes > 0 ? ((leaderboard[2].votes / totalVotes) * 100).toFixed(1) : 0}%
                        </div>
                        {/* Mini progress bar */}
                        <div className="mt-2 h-1 rounded-full bg-surface overflow-hidden">
                          <div
                            className="h-full rounded-full progress-gradient"
                            style={{
                              width: `${totalVotes > 0 ? (leaderboard[2].votes / maxVotes) * 100 : 0}%`,
                              background: 'linear-gradient(90deg, #D97706, #92400E, #D97706)',
                              backgroundSize: '200% 100%',
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </motion.div>
              </motion.div>
            )}

            {/* Category Filter Tabs — pill-style active states */}
            <div className="flex items-center gap-2 mb-3 overflow-x-auto pb-1">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={cn(
                    'px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-300 whitespace-nowrap border',
                    category === cat
                      ? 'pill-active'
                      : 'bg-secondary text-muted-foreground hover:text-foreground hover:bg-accent border border-border'
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Search Box */}
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search performers..."
                className="pl-9 bg-secondary border-border text-foreground placeholder:text-muted-foreground focus-visible:border-gold-500/50"
              />
            </div>

            {/* Count indicator */}
            <p className="text-xs text-muted-foreground mb-3 px-1">{countLabel}</p>

            {/* Full List with progress bars */}
            <motion.div
              key={`${category}-${searchQuery}`}
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="space-y-2"
            >
              {filteredLeaderboard.length === 0 ? (
                <SharedEmptyState
                  icon={Search}
                  title="No performers match your filters"
                  description="Try a different category or search term to find performers."
                  actionLabel="Clear filters"
                  onAction={() => {
                    setCategory('All')
                    setSearchQuery('')
                  }}
                  className="py-8"
                />
              ) : (
                filteredLeaderboard.map((entry) => {
                  // Find overall rank in the full leaderboard
                  const overallIndex = leaderboard.findIndex((e) => e.id === entry.id)
                  const votePercent = totalVotes > 0 ? (entry.votes / totalVotes) * 100 : 0
                  const voteShare = maxVotes > 0 ? (entry.votes / maxVotes) * 100 : 0
                  const rankChange = getRankChange(entry.name)
                  const isFlashing = flashingIds.has(entry.id)
                  const isPulsing = pulseIds.has(entry.id)
                  const isMilestone = milestoneIds.has(entry.id)
                  const voteChange = voteChanges[entry.id]
                  const isTop3 = overallIndex >= 0 && overallIndex <= 2

                  // Gradient border color for top 3
                  const top3BorderGradient =
                    overallIndex === 0
                      ? 'linear-gradient(135deg, rgba(245,158,11,0.6), rgba(217,119,6,0.15), rgba(245,158,11,0.4))'
                      : overallIndex === 1
                      ? 'linear-gradient(135deg, rgba(156,163,175,0.5), rgba(107,114,128,0.1), rgba(156,163,175,0.3))'
                      : overallIndex === 2
                      ? 'linear-gradient(135deg, rgba(217,119,6,0.5), rgba(146,64,14,0.1), rgba(217,119,6,0.3))'
                      : undefined

                  return (
                    <motion.div
                      key={entry.id}
                      variants={rowVariants}
                      layout
                      layoutId={`lb-row-${entry.id}`}
                      onClick={() => handleRowClick(entry.id)}
                      className={cn(
                        'rounded-xl p-4 cursor-pointer relative overflow-hidden',
                        isTop3 ? 'gradient-border-card card-shine card-hover-lift' : 'dark-card-hover',
                        overallIndex === 0 && 'leader-glow',
                        isPulsing && 'vote-pulse',
                        isMilestone && 'milestone-row',
                      )}
                    >
                      {/* Top 3 gradient border overlay */}
                      {isTop3 && top3BorderGradient && (
                        <div
                          className="absolute inset-0 rounded-xl pointer-events-none opacity-40 group-hover:opacity-80 transition-opacity"
                          style={{ background: top3BorderGradient, filter: 'blur(1px)' }}
                        />
                      )}
                      {/* Phase 9 — milestone trophy overlay (gold border + 🏆) */}
                      <AnimatePresence>
                        {isMilestone && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.6 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.6 }}
                            transition={{ duration: 0.3 }}
                            className="absolute -top-2 -right-2 z-20 pointer-events-none"
                            aria-hidden="true"
                          >
                            <div
                              className="flex items-center justify-center w-8 h-8 rounded-full text-sm"
                              style={{
                                background:
                                  'linear-gradient(135deg, var(--gold-500), var(--gold-600))',
                                color: '#FFFFFF',
                                boxShadow: '0 0 12px rgba(245,158,11,0.6)',
                              }}
                            >
                              🏆
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                      {/* Gold flash overlay on rank change */}
                      <AnimatePresence>
                        {isFlashing && (
                          <motion.div
                            initial={{ opacity: 0.5 }}
                            animate={{ opacity: 0 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 1.2, ease: 'easeOut' }}
                            className="absolute inset-0 pointer-events-none rounded-xl"
                            style={{
                              background:
                                'linear-gradient(90deg, rgba(245,158,11,0.25), rgba(245,158,11,0.05) 50%, transparent)',
                            }}
                          />
                        )}
                      </AnimatePresence>

                      {/* Background progress bar */}
                      <div
                        className="absolute inset-y-0 left-0 opacity-10 transition-all duration-700"
                        style={{
                          width: `${voteShare}%`,
                          background: 'linear-gradient(90deg, #F59E0B, #D97706)',
                        }}
                      />

                      <div className="relative flex items-center gap-4">
                        {/* Rank */}
                        <div className="flex items-center gap-2 shrink-0">
                          {overallIndex === 0 ? (
                            <div className="w-10 h-10 rounded-full bg-gold-500/20 flex items-center justify-center gold-glow-sm crown-bounce">
                              <Crown className="size-5 text-gold-400 crown-shimmer-enhanced" />
                            </div>
                          ) : overallIndex === 1 ? (
                            <div className="w-10 h-10 rounded-full bg-gray-400/10 flex items-center justify-center">
                              <Medal className="size-5 text-gray-300" />
                            </div>
                          ) : overallIndex === 2 ? (
                            <div className="w-10 h-10 rounded-full bg-amber-600/10 flex items-center justify-center">
                              <Medal className="size-5 text-amber-600" />
                            </div>
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-surface flex items-center justify-center">
                              <span className="text-sm font-bold text-muted-foreground">{overallIndex + 1}</span>
                            </div>
                          )}

                          {/* Rank change indicator — with bounce animation */}
                          <div className="flex flex-col items-center -ml-1">
                            {rankChange === 'up' && <TrendingUp className="size-3 text-green-400 rank-up-anim" />}
                            {rankChange === 'down' && <TrendingDown className="size-3 text-red-400 rank-down-anim" />}
                            {rankChange === 'same' && <Minus className="size-3 text-muted-foreground" />}
                          </div>
                        </div>

                        {/* Avatar */}
                        <ParticipantAvatar
                          name={entry.name}
                          imageUrl={entry.imageUrl}
                          thumbnailUrl={entry.thumbnailUrl}
                          size="sm"
                          className="rounded-full shrink-0"
                        />

                        {/* Name & Category */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold truncate">{entry.name}</span>
                            {overallIndex === 0 && (
                              <Badge className="bg-gold-500/20 text-gold-400 border-gold-500/30 text-[10px] shrink-0">
                                Leading
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-muted-foreground">{entry.category}</span>
                            <span className="text-muted-foreground/30">·</span>
                          </div>
                          {/* Progress bar */}
                          <div className="mt-2 h-1.5 rounded-full bg-surface overflow-hidden">
                            <motion.div
                              className="h-full rounded-full"
                              style={{
                                background:
                                  overallIndex === 0
                                    ? 'linear-gradient(90deg, #F59E0B, #D97706)'
                                    : overallIndex === 1
                                    ? 'linear-gradient(90deg, #9CA3AF, #6B7280)'
                                    : overallIndex === 2
                                    ? 'linear-gradient(90deg, #D97706, #92400E)'
                                    : 'linear-gradient(90deg, #475569, #334155)',
                              }}
                              initial={{ width: 0 }}
                              animate={{ width: `${voteShare}%` }}
                              transition={{ duration: 1.2, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
                            />
                          </div>
                        </div>

                        {/* Vote Count & Percentage */}
                        <div className="text-right shrink-0 relative">
                          <div className="text-gold-400 font-bold text-sm flex items-center justify-end gap-1.5">
                            <span className="number-tick">{entry.votes.toLocaleString()}</span>
                            {/* Vote change badge */}
                            <AnimatePresence>
                              {voteChange && (
                                <motion.span
                                  key={voteChange.key}
                                  initial={{ opacity: 0, y: 0, scale: 0.8 }}
                                  animate={{ opacity: 1, y: -8, scale: 1 }}
                                  exit={{ opacity: 0, y: -16, scale: 0.8 }}
                                  transition={{ duration: 0.4 }}
                                  className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-400 text-[10px] font-bold border border-green-500/30"
                                >
                                  +{voteChange.amount}
                                </motion.span>
                              )}
                            </AnimatePresence>
                          </div>
                          <div className="text-[10px] text-muted-foreground">{votePercent.toFixed(1)}% of votes</div>
                        </div>

                        {/* Share button per row */}
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={(e) => handleShareEntry(entry, e)}
                          className="shrink-0 size-7 rounded-full flex items-center justify-center transition-colors duration-200"
                          style={{
                            background: 'rgba(245, 158, 11, 0.08)',
                            color: '#F59E0B',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(245, 158, 11, 0.2)'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'rgba(245, 158, 11, 0.08)'
                          }}
                          aria-label={`Share ${entry.name}`}
                        >
                          <Share2 className="size-3.5" />
                        </motion.button>
                      </div>
                    </motion.div>
                  )
                })
              )}
            </motion.div>

            {/* CTA */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.5 }}
              className="mt-10 text-center"
            >
              <div className="dark-card rounded-2xl p-8">
                <h3 className="text-lg font-semibold mb-2">Want to change the rankings?</h3>
                <p className="text-sm text-muted-foreground mb-6">
                  Your vote can make all the difference. Support your favorite performer now.
                </p>
                <div className="relative group inline-block">
                  <div className="absolute -inset-1 bg-gradient-to-r from-gold-500 via-gold-400 to-gold-600 rounded-full blur-md opacity-50 group-hover:opacity-100 transition-opacity duration-500" />
                  <Button
                    onClick={() => router.push('/contestants')}
                    className="relative bg-gold-500 hover:bg-gold-600 text-[#0B0F17] font-semibold rounded-full px-8 h-12"
                  >
                    <Vote className="size-4 mr-1" />
                    Cast Your Vote
                    <ArrowRight className="size-4 ml-1" />
                  </Button>
                </div>
              </div>
            </motion.div>

            {/* Your Impact Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.5 }}
              className="mt-6 dark-card rounded-2xl p-6"
            >
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="size-4 text-gold-400" />
                <h3 className="text-base font-semibold">Your Impact</h3>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <ImpactStatBox
                  label="Total Votes"
                  value={stats ? stats.totalVotes.toLocaleString() : '—'}
                  accent
                />
                <ImpactStatBox
                  label="Participants"
                  value={stats ? stats.totalParticipants : '—'}
                />
                <ImpactStatBox label="Avg Votes" value={avgVotes} />
                <ImpactStatBox
                  label="Days Left"
                  value={stats ? stats.daysRemaining : '—'}
                  accent
                />
              </div>
            </motion.div>
          </>
        )}
      </main>

      {/* Share Modal */}
      <ShareModal
        open={shareModalOpen}
        onOpenChange={setShareModalOpen}
        title={
          shareParticipant
            ? `${shareParticipant.name} — Vibe Hub Leaderboard`
            : 'Vibe Hub Leaderboard'
        }
        description={
          shareParticipant
            ? `Check out ${shareParticipant.name} on Vibe Hub — ${shareParticipant.category} performer with ${shareParticipant.votes.toLocaleString()} votes! Cast your vote now!`
            : 'Check out the Vibe Hub leaderboard and vote for your favorite performers!'
        }
        contestant={
          shareParticipant
            ? {
                name: shareParticipant.name,
                category: shareParticipant.category,
                votes: shareParticipant.votes,
                rank: leaderboard.findIndex((e) => e.id === shareParticipant.id) + 1,
              }
            : undefined
        }
        participantId={shareParticipant?.id}
      />
    </div>
  )
}
