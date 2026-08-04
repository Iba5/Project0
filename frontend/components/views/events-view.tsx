'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { format, parseISO, differenceInCalendarDays, isValid } from 'date-fns'
import {
  CalendarDays,
  Clock,
  DollarSign,
  Users,
  Search,
  ArrowRight,
  CalendarX,
  SearchX,
  Sparkles,
  ChevronRight,
  Share2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAppStore } from '@/lib/store'
import { useRouter } from 'next/navigation'
import { listPublicEvents, type EventItem } from '@/lib/api'
import { nameToSolidGradient } from '@/lib/utils'
import { toast } from 'sonner'
import { EventCardSkeleton } from '@/components/shared/skeletons'
import { EmptyState as SharedEmptyState } from '@/components/shared/empty-state'
import { EventCountdown } from '@/components/shared/event-countdown'
import { ShareModal } from '@/components/shared/share-modal'

// ─── Status helpers ────────────────────────────────────────────────

type FilterKey = 'all' | 'voting' | 'upcoming' | 'ended'

const FILTER_OPTIONS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'voting', label: 'Voting Open' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'ended', label: 'Ended' },
]

/**
 * Group the underlying event status string (Draft, Registration Open,
 * Voting Open, Voting Closed, Completed, Archived, …) into one of four
 * pill buckets used by the public Events browser. "Active" = anything
 * currently in progress that is not yet Voting Open (e.g. registration
 * or ongoing). We never expose internal Drafts.
 */
function classifyEvent(status: string): 'voting' | 'upcoming' | 'ended' | 'active' {
  const s = (status || '').toLowerCase().replace(/\s+/g, '')
  if (s === 'votingopen') return 'voting'
  if (s === 'upcoming') return 'upcoming'
  if (['completed', 'votingclosed', 'archived', 'ended'].includes(s)) return 'ended'
  return 'active'
}

const STATUS_PILLS: Record<
  ReturnType<typeof classifyEvent>,
  { label: string; classes: string }
> = {
  voting: {
    label: 'Voting Open',
    classes: 'bg-green-500/15 text-green-400 border border-green-500/30',
  },
  upcoming: {
    label: 'Upcoming',
    classes: 'bg-blue-500/15 text-blue-400 border border-blue-500/30',
  },
  ended: {
    label: 'Ended',
    classes: 'bg-slate-500/15 text-slate-400 border border-slate-500/30',
  },
  active: {
    label: 'Active',
    classes: 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
  },
}

function matchesFilter(bucket: ReturnType<typeof classifyEvent>, filter: FilterKey): boolean {
  if (filter === 'all') return true
  if (filter === 'voting') return bucket === 'voting'
  if (filter === 'upcoming') return bucket === 'upcoming' || bucket === 'active'
  if (filter === 'ended') return bucket === 'ended'
  return true
}

// ─── Date formatting helpers ──────────────────────────────────────

function safeParse(value: string | null | undefined): Date | null {
  if (!value) return null
  const d = parseISO(value)
  return isValid(d) ? d : null
}

function formatRange(startISO: string, endISO: string): string {
  const start = safeParse(startISO)
  const end = safeParse(endISO)
  if (!start && !end) return 'Dates TBA'
  if (start && end) {
    if (start.getFullYear() === end.getFullYear()) {
      return `${format(start, 'MMM d')} → ${format(end, 'MMM d, yyyy')}`
    }
    return `${format(start, 'MMM d, yyyy')} → ${format(end, 'MMM d, yyyy')}`
  }
  return start ? format(start, 'MMM d, yyyy') : end ? format(end, 'MMM d, yyyy') : 'Dates TBA'
}

function daysRemaining(endISO: string): number | null {
  const end = safeParse(endISO)
  if (!end) return null
  const now = new Date()
  if (end < now) return null
  return Math.max(0, differenceInCalendarDays(end, now))
}

// ─── Card sub-components ──────────────────────────────────────────

function StatusPill({ bucket }: { bucket: ReturnType<typeof classifyEvent> }) {
  const pill = STATUS_PILLS[bucket]
  const isLive = bucket === 'voting'
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider backdrop-blur-md ${isLive ? 'badge-pulse-glow' : ''} ${pill.classes}`}
    >
      {isLive ? (
        <span className="relative flex h-2 w-2">
          <span className="animate-ping-slow absolute inline-flex h-full w-full rounded-full bg-current opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-current" />
        </span>
      ) : (
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-current" />
      )}
      {pill.label}
    </span>
  )
}

function BannerArea({ event, onShare }: { event: EventItem; onShare: () => void }) {
  const bucket = classifyEvent(event.status)
  return (
    <div className="relative aspect-video overflow-hidden">
      {event.banner ? (
        <img
          src={event.banner}
          alt={event.name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
        />
      ) : (
        <div
          className={`w-full h-full flex items-center justify-center bg-gradient-to-br ${nameToSolidGradient(event.name)}`}
        >
          <span className="text-2xl md:text-3xl font-bold text-white/90 drop-shadow-md text-center px-4 line-clamp-2">
            {event.name}
          </span>
        </div>
      )}

      {/* Gradient overlay for readability of the status pill */}
      <div className="absolute inset-0 bg-gradient-to-b from-background/80 via-background/30 to-transparent pointer-events-none" />

      {/* Status pill (top-left) */}
      <div className="absolute top-3 left-3 z-10">
        <StatusPill bucket={bucket} />
      </div>

      {/* Share button (top-right) */}
      <div className="absolute top-3 right-3 z-10">
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.stopPropagation()
            onShare()
          }}
          aria-label="Share event"
          className="size-8 rounded-full backdrop-blur-md transition-colors duration-200"
          style={{
            background: 'rgba(0, 0, 0, 0.4)',
            color: 'var(--text-muted)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(245, 158, 11, 0.2)'
            e.currentTarget.style.color = '#F59E0B'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(0, 0, 0, 0.4)'
            e.currentTarget.style.color = 'var(--text-muted)'
          }}
        >
          <Share2 className="size-4" />
        </Button>
      </div>

      {/* Live countdown timer (bottom-center) for voting events */}
      {bucket === 'voting' && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10">
          <EventCountdown endDate={event.endDate} />
        </div>
      )}
    </div>
  )
}

function EventCard({ event, onViewContestants, onShare }: { event: EventItem; onViewContestants: (id: string) => void; onShare: () => void }) {
  const bucket = classifyEvent(event.status)
  const remaining = bucket !== 'ended' ? daysRemaining(event.endDate) : null
  const participantCount = event.participantCount ?? 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="hover-lift gradient-border-card rounded-2xl overflow-hidden flex flex-col group card-hover-glow"
    >
      <BannerArea event={event} onShare={onShare} />

      <div className="p-4 md:p-6 flex flex-col flex-1 gap-3">
        <h3
          className="text-lg md:text-xl font-bold leading-tight line-clamp-1"
          style={{ color: 'var(--text-primary)' }}
        >
          {event.name}
        </h3>

        {event.description ? (
          <p
            className="text-sm leading-relaxed line-clamp-2"
            style={{ color: 'var(--text-muted)' }}
          >
            {event.description}
          </p>
        ) : (
          <p className="text-sm italic" style={{ color: 'var(--text-muted)' }}>
            No description provided.
          </p>
        )}

        {/* Date row */}
        <div
          className="flex items-center gap-2 text-xs"
          style={{ color: 'var(--text-muted)' }}
        >
          <CalendarDays className="w-3.5 h-3.5 shrink-0" />
          <span>{formatRange(event.startDate, event.endDate)}</span>
        </div>

        {/* Days remaining row */}
        {bucket !== 'ended' && remaining !== null && (
          <div
            className="flex items-center gap-2 text-xs"
            style={{ color: remaining > 3 ? 'var(--text-secondary)' : '#F59E0B' }}
          >
            <Clock className="w-3.5 h-3.5 shrink-0" />
            <span>
              {remaining === 0
                ? 'Voting closes today!'
                : `${remaining} day${remaining === 1 ? '' : 's'} remaining`}
            </span>
          </div>
        )}

        {/* Badges row */}
        <div className="flex flex-wrap items-center gap-2 mt-1">
          <span
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold"
            style={{
              background: 'rgba(245, 158, 11, 0.12)',
              color: '#F59E0B',
              border: '1px solid rgba(245, 158, 11, 0.25)',
            }}
          >
            <DollarSign className="w-3 h-3" />
            {event.votePrice.toFixed(2)} {event.currency} per vote
          </span>
          <span
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold"
            style={{
              background: 'rgba(148, 163, 184, 0.12)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <Users className="w-3 h-3" />
            {participantCount} participant{participantCount === 1 ? '' : 's'}
          </span>
        </div>

        {/* Hover-reveal details — countdown timer for voting events */}
        <div className="hover-reveal-details">
          {bucket === 'voting' && (
            <div className="flex items-center justify-center py-2">
              <EventCountdown endDate={event.endDate} />
            </div>
          )}
          {event.status && (
            <div className="flex items-center gap-2 text-xs pt-1" style={{ color: 'var(--text-muted)' }}>
              <Sparkles className="w-3 h-3 shrink-0" />
              <span>Status: {event.status}</span>
            </div>
          )}
        </div>

        <div className="mt-auto pt-2">
          <Button
            onClick={() => onViewContestants(event.id)}
            className="w-full rounded-full text-sm font-semibold transition-all duration-300 cta-shimmer"
            style={{
              background: 'linear-gradient(135deg, #F59E0B, #D97706)',
              color: '#0B0F17',
            }}
          >
            View Contestants
            <ArrowRight className="w-4 h-4 ml-1.5" />
          </Button>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Skeleton + empty states ──────────────────────────────────────
// Reusable skeleton + empty state components live in src/components/shared.
// See: EventCardSkeleton (shared/skeletons.tsx) and EmptyState (shared/empty-state.tsx)

// ─── Main view ────────────────────────────────────────────────────

export default function EventsView() {
  const { setSelectedEventId } = useAppStore()
  const router = useRouter()
  const [events, setEvents] = useState<EventItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterKey>('all')
  const [search, setSearch] = useState('')
  const [shareModalOpen, setShareModalOpen] = useState(false)
  const [shareEvent, setShareEvent] = useState<EventItem | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const { items: fetched } = await listPublicEvents()
        if (!cancelled) {
          // Hide internal "Draft" events from the public browser.
          const visible = (fetched || []).filter(
            (e) => (e.status || '').toLowerCase() !== 'draft',
          )
          setEvents(visible)
        }
      } catch (err) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : 'Failed to load events'
          setError(msg)
          toast.error(msg)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  const visibleEvents = useMemo(() => {
    const q = search.trim().toLowerCase()
    return events.filter((event) => {
      const bucket = classifyEvent(event.status)
      if (!matchesFilter(bucket, filter)) return false
      if (q && !event.name.toLowerCase().includes(q)) return false
      return true
    })
  }, [events, filter, search])

  const handleViewContestants = (eventId: string) => {
    setSelectedEventId(eventId)
    router.push('/contestants')
  }

  const handleShareEvent = useCallback((event: EventItem) => {
    setShareEvent(event)
    setShareModalOpen(true)
  }, [])

  return (
    <div className="min-h-screen bg-background">
      {/* Hero header */}
      <section className="relative px-4 pt-10 pb-6 hero-gradient overflow-hidden">
        <div className="absolute inset-0 bg-grid opacity-50 pointer-events-none" />
        <div className="bokeh w-72 h-72 bg-gold-500 top-0 left-1/4" />
        <div className="bokeh w-96 h-96 bg-amber-400 bottom-0 right-1/4" />

        <div className="relative max-w-5xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="inline-flex items-center gap-2 glass rounded-full px-3 py-1.5 mb-4"
          >
            <Sparkles className="w-3.5 h-3.5 text-gold-400" />
            <span className="text-xs uppercase tracking-wider font-semibold text-gold-300">
              Browse Events
            </span>
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.05 }}
            className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-3"
          >
            All <span className="gold-text">Events</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="text-sm sm:text-base max-w-2xl mx-auto"
            style={{ color: 'var(--text-muted)' }}
          >
            Explore every competition we&apos;ve run — from current voting rounds to
            upcoming seasons and past champions. Tap any event to meet its contestants.
          </motion.p>
        </div>
      </section>

      {/* Filter + search */}
      <section className="px-4 py-6 sticky top-16 z-30">
        <div className="max-w-5xl mx-auto">
          <div className="glass-premium rounded-2xl p-3 md:p-4 flex flex-col md:flex-row md:items-center gap-3">
            {/* Status filter — pill-style active states */}
            <div className="flex gap-1 overflow-x-auto scrollbar-thin pb-1 md:pb-0 md:shrink-0">
              {FILTER_OPTIONS.map((option) => {
                const isActive = filter === option.key
                return (
                  <button
                    key={option.key}
                    onClick={() => setFilter(option.key)}
                    className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all duration-300 border ${
                      isActive ? 'pill-active' : ''
                    }`}
                    style={
                      !isActive
                        ? {
                            background: 'transparent',
                            color: 'var(--text-muted)',
                            border: '1px solid var(--border-subtle)',
                          }
                        : undefined
                    }
                  >
                    {option.label}
                  </button>
                )
              })}
            </div>

            {/* Search */}
            <div className="relative flex-1 md:max-w-xs md:ml-auto">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
                style={{ color: 'var(--text-muted)' }}
              />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search events by name…"
                className="pl-9 rounded-full text-sm h-10 bg-surface border-border"
                aria-label="Search events by name"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Grid */}
      <section className="px-4 pb-20">
        <div className="max-w-5xl mx-auto">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <EventCardSkeleton key={i} />
              ))}
            </div>
          ) : error ? (
            <SharedEmptyState
              icon={CalendarX}
              title="Couldn't load events"
              description="Please try again in a moment."
            />
          ) : events.length === 0 ? (
            <SharedEmptyState
              icon={CalendarX}
              title="No events yet"
              description="Check back soon — new competitions are added regularly."
              actionLabel="Back to home"
              onAction={() => router.push('/')}
            />
          ) : visibleEvents.length === 0 ? (
            <SharedEmptyState
              icon={SearchX}
              title="No matching events"
              description="Try a different search term or filter."
              actionLabel="Clear filters"
              onAction={() => {
                setFilter('all')
                setSearch('')
              }}
            />
          ) : (
            <motion.div
              initial="hidden"
              animate="visible"
              variants={{
                hidden: { opacity: 0 },
                visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
              }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6"
            >
              {visibleEvents.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  onViewContestants={handleViewContestants}
                  onShare={() => handleShareEvent(event)}
                />
              ))}
            </motion.div>
          )}

          {/* Share Modal */}
          <ShareModal
            open={shareModalOpen}
            onOpenChange={setShareModalOpen}
            title={shareEvent?.name || 'Vibe Hub Event'}
            description={shareEvent?.description || 'Check out this event on Vibe Hub!'}
          />

          {/* Back-to-home footer link */}
          <div className="mt-12 text-center">
            <button
              onClick={() => router.push('/')}
              className="inline-flex items-center gap-1 text-sm transition-colors duration-300"
              style={{ color: 'var(--text-muted)' }}
            >
              <ChevronRight className="w-4 h-4 rotate-180" />
              Back to home
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
