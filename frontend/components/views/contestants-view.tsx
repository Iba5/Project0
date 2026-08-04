'use client'

import { useEffect, useState, useRef, useMemo } from 'react'
import { motion, AnimatePresence, type Variants } from 'framer-motion'
import {
  Play,
  ArrowLeft,
  Search,
  Share2,
  Crown,
  LayoutGrid,
  List,
  Frown,
  SearchX,
  Vote,
  TrendingUp,
  GitCompare,
  Check,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAppStore } from '@/lib/store'
import { useRouter } from 'next/navigation'
import {
  getPublicParticipants,
  getPublicLeaderboard,
  type PublicParticipant,
} from '@/lib/api'
import { useRealtime, type VoteUpdateData } from '@/hooks/use-realtime'
import { ParticipantAvatar } from '@/components/shared/participant-avatar'
import { EventFilterBar } from '@/components/shared/event-filter-bar'
import { EmptyState as SharedEmptyState } from '@/components/shared/empty-state'
import { toast } from 'sonner'

const DEFAULT_CATEGORIES = ['All']

type SortOption = 'recent' | 'votes' | 'trending' | 'az'
type ViewMode = 'grid' | 'list'

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
}

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.4, ease: 'easeOut' as const },
  },
}



function rankGradient(rank: number) {
  if (rank === 1) return 'from-yellow-300 to-amber-600' // gold
  if (rank === 2) return 'from-slate-200 to-slate-400' // silver
  if (rank === 3) return 'from-orange-600 to-amber-900' // bronze
  return ''
}

function rankHoverGlow(rank: number) {
  if (rank === 1) return 'hover:shadow-[0_0_30px_rgba(252,211,77,0.45)]'
  if (rank === 2) return 'hover:shadow-[0_0_30px_rgba(203,213,225,0.35)]'
  if (rank === 3) return 'hover:shadow-[0_0_30px_rgba(180,83,9,0.35)]'
  return ''
}

// Vote count with count-up + gold glow flash on change
function VoteCount({ value, large = false }: { value: number; large?: boolean }) {
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
        className={`inline-block font-bold text-gold-400 ${large ? 'text-base' : 'text-sm'}`}
      >
        {displayValue.toLocaleString()}
      </motion.span>
    </AnimatePresence>
  )
}

// Rank badge overlay (top-left of card image)
function RankBadge({ rank }: { rank: number }) {
  if (rank < 1 || rank > 3) return null
  return (
    <div
      className={`absolute top-2 left-2 z-20 w-7 h-7 rounded-full bg-gradient-to-br ${rankGradient(
        rank
      )} flex items-center justify-center shadow-lg border border-white/30`}
      title={`Rank #${rank}`}
    >
      {rank === 1 ? (
        <Crown className="size-4 text-yellow-50" />
      ) : (
        <span className="text-xs font-bold text-white">{rank}</span>
      )}
    </div>
  )
}

// Compact rank badge for list view avatars
function RankBadgeCompact({ rank }: { rank: number }) {
  if (rank < 1 || rank > 3) return null
  return (
    <div
      className={`absolute -top-1 -left-1 z-20 w-5 h-5 rounded-full bg-gradient-to-br ${rankGradient(
        rank
      )} flex items-center justify-center shadow-lg border border-white/30`}
      title={`Rank #${rank}`}
    >
      {rank === 1 ? (
        <Crown className="size-3 text-yellow-50" />
      ) : (
        <span className="text-[9px] font-bold text-white">{rank}</span>
      )}
    </div>
  )
}

function ContestantCardSkeleton() {
  return (
    <div className="dark-card rounded-2xl overflow-hidden">
      <Skeleton className="w-full aspect-[4/5] bg-surface-light" />
      <div className="p-4 space-y-3">
        <div className="flex gap-2">
          <Skeleton className="h-5 w-16 rounded-full bg-surface-light" />
          <Skeleton className="h-5 w-16 rounded-full bg-surface-light" />
        </div>
        <Skeleton className="h-5 w-24 bg-surface-light" />
        <Skeleton className="h-4 w-16 bg-surface-light" />
      </div>
    </div>
  )
}

export default function ContestantsView() {
  const { categoryFilter, setCategoryFilter, compareIds, setCompareIds } = useAppStore()
  const router = useRouter()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [participants, setParticipants] = useState<PublicParticipant[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<SortOption>('recent')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [rankMap, setRankMap] = useState<Record<string, number>>({})
  const [isLive, setIsLive] = useState(false)
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  const safeParticipants = Array.isArray(participants) ? participants : []

  // Derive categories from the loaded participants data
  const categories = useMemo(() => {
    const unique = [...new Set(safeParticipants.map((p) => p.category).filter(Boolean))]
    return ['All', ...unique.sort()]
  }, [safeParticipants])

  // Initial load + leaderboard fetch
  useEffect(() => {
    let mounted = true
    async function loadParticipants() {
      try {
        const data = await getPublicParticipants(1, 100)
        if (mounted) setParticipants(Array.isArray(data?.items) ? data.items : [])
      } catch {
        // silent
      } finally {
        if (mounted) setLoading(false)
      }
    }
    async function loadLeaderboard() {
      try {
        const data = await getPublicLeaderboard()
        if (!mounted) return
        const ranks: Record<string, number> = {}
        data.leaderboard.slice(0, 3).forEach((entry, idx) => {
          ranks[entry.id] = idx + 1
        })
        setRankMap(ranks)
      } catch {
        // silent
      }
    }
    loadParticipants()
    loadLeaderboard()
    return () => {
      mounted = false
    }
  }, [])

  // Real-time vote updates via WebSocket (with fallback polling at 30s)
  const { onLeaderboardUpdate } = useRealtime()

  useEffect(() => {
    // Listen for real-time leaderboard updates (any participant's vote changes)
    const unsubscribe = onLeaderboardUpdate((data: VoteUpdateData) => {
      setParticipants((prev) => {
        const updated = prev.map((p) =>
          p.id === data.participantId ? { ...p, votes: data.votes } : p,
        )
        // Only update if something actually changed
        const prevVotes = JSON.stringify(prev.map((p) => p.votes))
        const newVotes = JSON.stringify(updated.map((p) => p.votes))
        if (prevVotes === newVotes) return prev
        return updated
      })
      setIsLive(true)
    })

    // Fallback polling at 30s in case WebSocket disconnects
    const interval = setInterval(async () => {
      try {
        const data = await getPublicParticipants(1, 100)
        const nextParticipants = Array.isArray(data?.items) ? data.items : []
        setParticipants((prev) => {
          const prevVotes = JSON.stringify(prev.map((p) => p.votes))
          const newVotes = JSON.stringify(nextParticipants.map((p) => p.votes))
          if (prevVotes === newVotes) return prev
          return nextParticipants
        })
        setIsLive(true)
        // Refresh leaderboard ranks in case ordering changed
        const lb = await getPublicLeaderboard()
        const ranks: Record<string, number> = {}
        lb.leaderboard.slice(0, 3).forEach((entry, idx) => {
          ranks[entry.id] = idx + 1
        })
        setRankMap(ranks)
      } catch {
        // silent
      }
    }, 30000)
    return () => {
      unsubscribe()
      clearInterval(interval)
    }
  }, [onLeaderboardUpdate])

  // Filtered + sorted list (client-side sort)
  const filtered = useMemo(() => {
    const filteredList = safeParticipants.filter((p) => {
      const matchesCategory = categoryFilter === 'All' || p.category === categoryFilter
      const matchesSearch =
        !search ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.category.toLowerCase().includes(search.toLowerCase())
      return matchesCategory && matchesSearch
    })

    const sorted = [...filteredList]
    switch (sortBy) {
      case 'votes':
        sorted.sort((a, b) => b.votes - a.votes)
        break
      case 'trending':
        // Same order as Most Voted; "🔥" indicator on top 3 is rendered separately
        sorted.sort((a, b) => b.votes - a.votes)
        break
      case 'az':
        sorted.sort((a, b) => a.name.localeCompare(b.name))
        break
      case 'recent':
      default:
        sorted.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
        break
    }
    return sorted
  }, [safeParticipants, categoryFilter, search, sortBy])

  const handleCardClick = (id: string) => {
    router.push(`/contestants/${id}`)
  }

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        if (next.size >= 4) {
          toast.error('You can compare up to 4 contestants')
          return prev
        }
        next.add(id)
      }
      return next
    })
  }

  const handleCompare = () => {
    if (selectedIds.size < 2) {
      toast.error('Select at least 2 contestants to compare')
      return
    }
    setCompareIds(Array.from(selectedIds))
    router.push('/compare')
  }

  const clearSelection = () => {
    setSelectedIds(new Set())
  }

  const handleShareEvent = () => {
    navigator.clipboard
      .writeText(window.location.href)
      .then(() => {
        toast.success('Link copied to clipboard!')
      })
      .catch(() => {
        toast.error('Failed to copy link')
      })
  }

  const handleClearFilters = () => {
    setSearch('')
    setCategoryFilter('All')
    setSortBy('recent')
  }

  const hasActiveFilters = search !== '' || categoryFilter !== 'All' || sortBy !== 'recent'

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 glass-strong border-b border-border">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => router.push('/')}
                className="text-muted-foreground hover:text-foreground hover:bg-accent rounded-full"
              >
                <ArrowLeft className="size-5" />
              </Button>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold">Contestants</h1>
                  {isLive && (
                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30">
                      <span className="relative flex size-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex rounded-full size-2 bg-emerald-500" />
                      </span>
                      <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider">
                        Live
                      </span>
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {loading ? 'Loading...' : `${filtered.length} performers`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={handleCompare}
                variant="outline"
                className="rounded-full gap-2 border-gold-500/30 text-gold-400 hover:bg-gold-500/10 hover:text-gold-300"
              >
                <GitCompare className="size-4" />
                <span className="hidden sm:inline">Compare</span>
                {selectedIds.size > 0 && (
                  <span className="ml-1 w-5 h-5 rounded-full bg-gold-500 text-[#0B0F17] text-xs font-bold flex items-center justify-center">
                    {selectedIds.size}
                  </span>
                )}
              </Button>
              <Button
                onClick={handleShareEvent}
                variant="outline"
                className="rounded-full gap-2 border-gold-500/30 text-gold-400 hover:bg-gold-500/10 hover:text-gold-300"
              >
                <Share2 className="size-4" />
                <span className="hidden sm:inline">Share Event</span>
              </Button>
            </div>
          </div>

          {/* Search + Sort + View Toggle */}
          <div className="flex flex-col sm:flex-row gap-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Search contestants..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-surface border-border rounded-full text-sm placeholder:text-muted-foreground"
              />
            </div>

            {/* Sort Dropdown */}
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
              <SelectTrigger className="w-full sm:w-[180px] bg-surface border-border rounded-full text-sm">
                <div className="flex items-center gap-2">
                  <TrendingUp className="size-4 text-gold-400" />
                  <SelectValue placeholder="Sort by" />
                </div>
              </SelectTrigger>
              <SelectContent className="bg-surface border-border">
                <SelectItem value="recent">Most Recent</SelectItem>
                <SelectItem value="votes">Most Voted</SelectItem>
                <SelectItem value="trending">🔥 Trending</SelectItem>
                <SelectItem value="az">A-Z</SelectItem>
              </SelectContent>
            </Select>

            {/* View Toggle */}
            <div
              className="flex items-center gap-1 bg-surface border border-border rounded-full p-1"
              role="group"
              aria-label="View mode"
            >
              <button
                onClick={() => setViewMode('grid')}
                aria-label="Grid view"
                aria-pressed={viewMode === 'grid'}
                className={`p-1.5 rounded-full transition-colors ${
                  viewMode === 'grid'
                    ? 'bg-gold-500 text-[#0B0F17]'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <LayoutGrid className="size-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                aria-label="List view"
                aria-pressed={viewMode === 'list'}
                className={`p-1.5 rounded-full transition-colors ${
                  viewMode === 'list'
                    ? 'bg-gold-500 text-[#0B0F17]'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <List className="size-4" />
              </button>
            </div>
          </div>

          {/* View Mode indicator + Category Filter row */}
          <div className="flex items-center justify-between gap-3 mb-3">
            <p className="text-xs text-muted-foreground">
              Showing{' '}
              <span className="font-semibold text-gold-300">{filtered.length}</span>
              {' '}of{' '}
              <span className="font-semibold text-white">{safeParticipants.length}</span>{' '}
              contestants
            </p>
            {(search !== '' || categoryFilter !== 'All') && (
              <button
                onClick={handleClearFilters}
                className="text-xs text-gold-400 hover:text-gold-300 transition-colors"
              >
                Clear filters
              </button>
            )}
          </div>

          {/* Event Filter Bar */}
          <div className="mb-4">
            <EventFilterBar />
          </div>

          {/* Category Filter — pill-style active states */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-all duration-300 border ${
                  categoryFilter === cat
                    ? 'pill-active'
                    : 'bg-surface text-muted-foreground hover:bg-surface-light hover:text-foreground border-border'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Grid / List */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <ContestantCardSkeleton key={i} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          hasActiveFilters ? (
            <SharedEmptyState
              icon={SearchX}
              title="No matches found"
              description="We couldn't find any contestants matching your filters. Try adjusting your search or clearing all filters."
              actionLabel="Clear filters"
              onAction={handleClearFilters}
              secondaryLabel="Back to home"
              onSecondary={() => router.push('/')}
            />
          ) : (
            <SharedEmptyState
              icon={Frown}
              title="No contestants yet"
              description="There are no contestants available yet. Check back soon — the stage is being set!"
              actionLabel="Back to home"
              onAction={() => router.push('/')}
            />
          )
        ) : viewMode === 'grid' ? (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
          >
            {filtered.map((participant) => {
              const rank = rankMap[participant.id] ?? 0
              const isHot = rank >= 1 && rank <= 3
              return (
                <motion.div
                  key={participant.id}
                  variants={cardVariants}
                  whileHover={{ y: -6, scale: 1.01, transition: { duration: 0.25 } }}
                  onClick={() => handleCardClick(participant.id)}
                  onMouseEnter={() => setHoveredId(participant.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  className={`gradient-border-card card-shine card-hover-glow card-entrance-glow rounded-2xl overflow-hidden cursor-pointer group relative ${rankHoverGlow(
                    rank
                  )}`}
                >
                  {/* Compare checkbox */}
                  <button
                    onClick={(e) => toggleSelect(participant.id, e)}
                    className={`absolute top-2 left-2 z-30 w-7 h-7 rounded-full flex items-center justify-center transition-all duration-200 ${
                      selectedIds.has(participant.id)
                        ? 'bg-gold-500 text-[#0B0F17] shadow-lg scale-110'
                        : 'bg-black/50 text-white/70 hover:bg-black/70 hover:text-white backdrop-blur-sm border border-white/20'
                    }`}
                    aria-label={selectedIds.has(participant.id) ? `Deselect ${participant.name}` : `Select ${participant.name} for comparison`}
                  >
                    <Check className="size-4" />
                  </button>

                  {/* Portrait Photo */}
                  <div
                    className={`relative aspect-[4/5] overflow-hidden ${selectedIds.has(participant.id) ? 'ring-2 ring-gold-500/60 ring-inset' : ''}`}
                  >
                    <ParticipantAvatar
                      name={participant.name}
                      imageUrl={participant.imageUrl}
                      thumbnailUrl={participant.thumbnailUrl}
                      size="full"
                      className="w-full h-full !rounded-none"
                    />

                    {/* Rank badge — top-left */}
                    {rank > 0 && <RankBadge rank={rank} />}

                    {/* HOT badge for top 3 — top-right */}
                    {isHot && (
                      <div className="absolute top-2 right-2 z-20">
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                          style={{
                            background: 'linear-gradient(135deg, #EF4444, #F59E0B)',
                            color: '#0B0F17',
                            boxShadow: '0 0 12px rgba(239, 68, 68, 0.4)',
                          }}
                        >
                          🔥 HOT
                        </span>
                      </div>
                    )}

                    {/* Play icon overlay */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                      <div className="w-12 h-12 rounded-full bg-gold-500/90 flex items-center justify-center shadow-lg">
                        <Play className="size-5 text-[#0B0F17] ml-0.5" />
                      </div>
                    </div>

                    {/* Floating Vote FAB on hover */}
                    <AnimatePresence>
                      {hoveredId === participant.id && (
                        <motion.button
                          key={`fab-${participant.id}`}
                          initial={{ opacity: 0, scale: 0.5, y: 8 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.5, y: 8 }}
                          transition={{ duration: 0.2, ease: 'easeOut' }}
                          whileHover={{ scale: 1.12 }}
                          whileTap={{ scale: 0.92 }}
                          onClick={(e) => {
                            e.stopPropagation()
                            handleCardClick(participant.id)
                          }}
                          aria-label={`Vote for ${participant.name}`}
                          className="absolute bottom-3 right-3 z-30 w-11 h-11 rounded-full bg-gradient-to-br from-gold-300 to-gold-600 flex items-center justify-center shadow-xl ring-2 ring-gold-200/40 ripple-effect"
                        >
                          <Vote className="size-5 text-[#0B0F17]" />
                        </motion.button>
                      )}
                    </AnimatePresence>

                    {/* Category badge - bottom left with colored background */}
                    <div className="absolute bottom-2.5 left-2.5 z-10">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold backdrop-blur-sm category-${participant.category.toLowerCase()}`}
                      >
                        {participant.category}
                      </span>
                    </div>
                  </div>

                  {/* Card Info — with vote count micro-interaction on hover */}
                  <div className="p-4 sm:p-5">
                    <h3 className="font-bold text-sm sm:text-base text-white truncate mb-1.5">
                      {participant.name}
                    </h3>
                    <div className="flex items-center gap-1.5 group-hover:scale-105 transition-transform duration-200 origin-left">
                      <VoteCount value={participant.votes} />
                      <span className="text-muted-foreground text-xs font-medium">votes</span>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </motion.div>
        ) : (
          // List view
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="flex flex-col gap-2"
          >
            {filtered.map((participant) => {
              const rank = rankMap[participant.id] ?? 0
              const isHot = rank >= 1 && rank <= 3
              return (
                <motion.div
                  key={participant.id}
                  variants={cardVariants}
                  whileHover={{ x: 4, scale: 1.005, transition: { duration: 0.25 } }}
                  onClick={() => handleCardClick(participant.id)}
                  onMouseEnter={() => setHoveredId(participant.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  className="dark-card-hover card-shine card-hover-glow card-entrance-glow rounded-2xl p-3 sm:p-4 cursor-pointer group flex items-center gap-3 sm:gap-4 relative border border-border hover:border-gold-500/40 transition-colors"
                >
                  {/* Compare checkbox (list view) */}
                  <button
                    onClick={(e) => toggleSelect(participant.id, e)}
                    className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-all duration-200 ${
                      selectedIds.has(participant.id)
                        ? 'bg-gold-500 text-[#0B0F17] shadow-lg scale-110'
                        : 'bg-surface-light text-muted-foreground hover:bg-surface hover:text-foreground border border-border'
                    }`}
                    aria-label={selectedIds.has(participant.id) ? `Deselect ${participant.name}` : `Select ${participant.name} for comparison`}
                  >
                    <Check className="size-4" />
                  </button>

                  {/* Avatar */}
                  <div className="relative shrink-0 w-14 h-14 rounded-xl overflow-hidden">
                    <ParticipantAvatar
                      name={participant.name}
                      imageUrl={participant.imageUrl}
                      thumbnailUrl={participant.thumbnailUrl}
                      size="md"
                      className="!rounded-xl"
                    />
                    {rank > 0 && <RankBadgeCompact rank={rank} />}
                  </div>

                  {/* Name + Category */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-sm text-white truncate">{participant.name}</h3>
                      {isHot && (
                        <span
                          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wider"
                          style={{
                            background: 'linear-gradient(135deg, #EF4444, #F59E0B)',
                            color: '#0B0F17',
                          }}
                        >
                          🔥 HOT
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold category-${participant.category.toLowerCase()}`}
                      >
                        {participant.category}
                      </span>
                    </div>
                  </div>

                  {/* Votes — with micro-interaction on hover */}
                  <div className="flex items-center gap-1.5 shrink-0 group-hover:scale-110 transition-transform duration-200 origin-right">
                    <VoteCount value={participant.votes} large />
                    <span className="text-muted-foreground text-xs hidden sm:inline font-medium">votes</span>
                  </div>

                  {/* Floating Vote FAB on hover (list view) */}
                  <AnimatePresence>
                    {hoveredId === participant.id && (
                      <motion.button
                        key={`fab-list-${participant.id}`}
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.5 }}
                        transition={{ duration: 0.2, ease: 'easeOut' }}
                        whileHover={{ scale: 1.12 }}
                        whileTap={{ scale: 0.92 }}
                        onClick={(e) => {
                          e.stopPropagation()
                          handleCardClick(participant.id)
                        }}
                        aria-label={`Vote for ${participant.name}`}
                        className="shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-gold-300 to-gold-600 flex items-center justify-center shadow-xl ring-2 ring-gold-200/40 ripple-effect"
                      >
                        <Vote className="size-4 text-[#0B0F17]" />
                      </motion.button>
                    )}
                  </AnimatePresence>
                </motion.div>
              )
            })}
          </motion.div>
        )}
      </main>

      {/* Floating Compare Action Bar */}
      <AnimatePresence>
        {selectedIds.size >= 2 && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-full shadow-2xl border border-gold-500/30"
            style={{
              background: 'rgba(18, 24, 36, 0.95)',
              backdropFilter: 'blur(20px)',
            }}
          >
            <GitCompare className="size-5 text-gold-400" />
            <span className="text-sm font-semibold text-white">
              {selectedIds.size} selected
            </span>
            <Button
              onClick={handleCompare}
              className="rounded-full gap-2 bg-gold-500 hover:bg-gold-600 text-[#0B0F17] font-semibold gold-glow-sm"
            >
              <GitCompare className="size-4" />
              Compare Now
            </Button>
            <button
              onClick={clearSelection}
              className="w-7 h-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-surface-light transition-colors"
              aria-label="Clear selection"
            >
              <X className="size-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
