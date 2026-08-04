'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import {
  Search,
  Users,
  CalendarDays,
  Loader2,
  TrendingUp,
  Clock,
  X,
  CornerDownLeft,
  ArrowUp,
  ArrowDown,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { useAppStore } from '@/lib/store'
import { apiFetch } from '@/lib/api-client'
import { cn } from '@/lib/utils'
import { ParticipantAvatar } from '@/components/shared/participant-avatar'

// ─── Types ────────────────────────────────────────────────────────

interface SearchContestant {
  id: string
  name: string
  category: string
  imageUrl: string | null
  thumbnailUrl: string | null
  votes: number
  status: string
}

interface SearchEvent {
  id: string
  name: string
  description: string | null
  banner: string | null
  status: string
  startDate: string
  endDate: string
  votePrice: number
  currency: string
}

interface SearchResponse {
  contestants: SearchContestant[]
  events: SearchEvent[]
}

// ─── Recent searches (localStorage) ──────────────────────────────

const RECENT_KEY = 'vibehub:recent-searches'
const MAX_RECENT = 6

interface RecentEntry {
  q: string
  ts: number
}

function loadRecent(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(RECENT_KEY)
    if (!raw) return []
    const parsed: RecentEntry[] = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .sort((a, b) => b.ts - a.ts)
      .slice(0, MAX_RECENT)
      .map((e) => e.q)
  } catch {
    return []
  }
}

function saveRecent(q: string) {
  if (typeof window === 'undefined') return
  const trimmed = q.trim()
  if (!trimmed) return
  try {
    const existing = loadRecent()
    const filtered = existing.filter((x) => x.toLowerCase() !== trimmed.toLowerCase())
    const next = [trimmed, ...filtered].slice(0, MAX_RECENT)
    const entries: RecentEntry[] = next.map((q, i) => ({ q, ts: Date.now() - i }))
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(entries))
  } catch {
    // localStorage may be unavailable (private mode, etc.)
  }
}

function clearRecent() {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(RECENT_KEY)
  } catch {
    // ignore
  }
}

// ─── Avatar helpers ──────────────────────────────────────────────

function classifyEventStatus(status: string): { label: string; color: string } {
  const s = (status || '').toLowerCase().replace(/\s+/g, '')
  if (s === 'votingopen') return { label: 'Voting Open', color: '#34D399' }
  if (s === 'upcoming') return { label: 'Upcoming', color: '#60A5FA' }
  if (['completed', 'votingclosed', 'archived', 'ended'].includes(s))
    return { label: 'Ended', color: 'var(--text-muted)' }
  return { label: 'Active', color: '#F59E0B' }
}

// ─── Component ───────────────────────────────────────────────────

export function GlobalSearch() {
  const router = useRouter()
  const { isSearchOpen, setSearchOpen, setSelectedEventId } = useAppStore()
  const [query, setQuery] = React.useState('')
  const [results, setResults] = React.useState<SearchResponse>({ contestants: [], events: [] })
  const [loading, setLoading] = React.useState(false)
  const [recent, setRecent] = React.useState<string[]>([])
  const [activeIndex, setActiveIndex] = React.useState(0)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const listRef = React.useRef<HTMLDivElement>(null)

  // Reset state whenever the dialog opens
  React.useEffect(() => {
    if (isSearchOpen) {
      setQuery('')
      setResults({ contestants: [], events: [] })
      setLoading(false)
      setActiveIndex(0)
      setRecent(loadRecent())
      // Focus the input on the next tick (radix uses animations)
      requestAnimationFrame(() => {
        inputRef.current?.focus()
      })
    }
  }, [isSearchOpen])

  // Debounced search
  React.useEffect(() => {
    if (!isSearchOpen) return
    const q = query.trim()

    if (!q) {
      setResults({ contestants: [], events: [] })
      setLoading(false)
      return
    }

    setLoading(true)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      try {
        const data: SearchResponse = await apiFetch(`/search?q=${encodeURIComponent(q)}&limit=8`)
        setResults(data)
      } catch {
        setResults({ contestants: [], events: [] })
      } finally {
        setLoading(false)
      }
    }, 300)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, isSearchOpen])

  // Flatten results into a single navigable list for keyboard nav
  const flatResults = React.useMemo(() => {
    const items: Array<
      | { kind: 'contestant'; data: SearchContestant }
      | { kind: 'event'; data: SearchEvent }
    > = []
    for (const c of results.contestants) items.push({ kind: 'contestant', data: c })
    for (const e of results.events) items.push({ kind: 'event', data: e })
    return items
  }, [results])

  // Reset active index when results change
  React.useEffect(() => {
    setActiveIndex(0)
  }, [results])

  // Scroll active item into view
  React.useEffect(() => {
    if (!listRef.current) return
    const activeEl = listRef.current.querySelector<HTMLElement>(`[data-search-index="${activeIndex}"]`)
    activeEl?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  const navigateToResult = React.useCallback(
    (item: (typeof flatResults)[number] | undefined) => {
      if (!item) return
      if (item.kind === 'contestant') {
        saveRecent(query.trim())
        router.push(`/contestants/${item.data.id}`)
      } else {
        saveRecent(query.trim())
        setSelectedEventId(item.data.id)
        router.push('/contestants')
      }
      setSearchOpen(false)
    },
    [query, setSelectedEventId, setSearchOpen, router],
  )

  const handleRecentClick = (q: string) => {
    setQuery(q)
    requestAnimationFrame(() => {
      inputRef.current?.focus()
    })
  }

  const handleClearRecent = () => {
    clearRecent()
    setRecent([])
  }

  // Keyboard navigation inside the dialog
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, Math.max(flatResults.length - 1, 0)))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      navigateToResult(flatResults[activeIndex])
    } else if (e.key === 'Escape') {
      // Radix dialog handles ESC to close; nothing extra needed
    }
  }

  const hasQuery = query.trim().length > 0
  const hasResults = flatResults.length > 0
  const showRecent = !hasQuery && recent.length > 0
  const showEmptyState = hasQuery && !loading && !hasResults

  return (
    <Dialog open={isSearchOpen} onOpenChange={setSearchOpen}>
      <DialogContent
        showCloseButton={false}
        className="p-0 gap-0 overflow-hidden max-w-2xl max-h-[80vh] flex flex-col"
        onKeyDown={handleKeyDown}
        aria-describedby="global-search-desc"
      >
        <DialogTitle className="sr-only">Global Search</DialogTitle>
        <DialogDescription className="sr-only" id="global-search-desc">
          Search across contestants and events. Use arrow keys to navigate, Enter to select, Escape to close.
        </DialogDescription>

        {/* Search input header */}
        <div
          className="flex items-center gap-3 px-4 py-4 border-b"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <Search className="size-5 shrink-0" style={{ color: '#F59E0B' }} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search contestants, events…"
            className="flex-1 bg-transparent outline-none text-base placeholder:text-muted-foreground"
            style={{ color: 'var(--text-primary)' }}
            aria-label="Search query"
            autoComplete="off"
            spellCheck={false}
          />
          {loading && <Loader2 className="size-4 animate-spin shrink-0 text-muted-foreground" />}
          {hasQuery && !loading && (
            <button
              onClick={() => {
                setQuery('')
                inputRef.current?.focus()
              }}
              aria-label="Clear search"
              className="p-1 rounded-md hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          )}
          <kbd
            className="hidden sm:inline-flex items-center gap-0.5 rounded-md border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
            style={{ borderColor: 'var(--border-subtle)', background: 'var(--surface-2)' }}
          >
            ESC
          </kbd>
        </div>

        {/* Results body */}
        <div
          ref={listRef}
          className="flex-1 overflow-y-auto custom-scrollbar"
          style={{ minHeight: '120px' }}
        >
          {/* Recent searches */}
          {showRecent && (
            <div className="p-2">
              <div className="flex items-center justify-between px-2 py-1.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <Clock className="size-3.5" />
                  Recent searches
                </div>
                <button
                  onClick={handleClearRecent}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Clear
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5 px-2 pb-2">
                {recent.map((q) => (
                  <button
                    key={q}
                    onClick={() => handleRecentClick(q)}
                    className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors hover:bg-accent"
                    style={{
                      background: 'var(--surface-2)',
                      color: 'var(--text-secondary)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <Clock className="size-3 text-muted-foreground" />
                    {q}
                  </button>
                ))}
              </div>
              <div className="px-2 pt-2 pb-1">
                <p className="text-xs text-muted-foreground">
                  Try searching for a contestant name, category (e.g. “Singing”) or event.
                </p>
              </div>
            </div>
          )}

          {/* Results list */}
          {hasResults && (
            <div className="p-2">
              {/* Contestants group */}
              {results.contestants.length > 0 && (
                <SearchGroup
                  icon={<Users className="size-3.5" />}
                  label="Contestants"
                  count={results.contestants.length}
                >
                  {results.contestants.map((c) => {
                    const idx = flatResults.findIndex((r) => r.kind === 'contestant' && r.data.id === c.id)
                    return (
                      <SearchResultRow
                        key={`c-${c.id}`}
                        index={idx}
                        active={activeIndex === idx}
                        onMouseEnter={() => setActiveIndex(idx)}
                        onClick={() => navigateToResult(flatResults[idx])}
                        thumbnail={
                          <ParticipantAvatar name={c.name} imageUrl={c.imageUrl} thumbnailUrl={c.thumbnailUrl} size="xs" />
                        }
                        title={c.name}
                        subtitle={
                          <span className="flex items-center gap-1.5">
                            <span>{c.category}</span>
                            <span className="text-muted-foreground/50">•</span>
                            <span className="inline-flex items-center gap-0.5" style={{ color: '#F59E0B' }}>
                              <TrendingUp className="size-3" />
                              {c.votes.toLocaleString()}
                            </span>
                          </span>
                        }
                      />
                    )
                  })}
                </SearchGroup>
              )}

              {/* Events group */}
              {results.events.length > 0 && (
                <SearchGroup
                  icon={<CalendarDays className="size-3.5" />}
                  label="Events"
                  count={results.events.length}
                >
                  {results.events.map((ev) => {
                    const idx = flatResults.findIndex((r) => r.kind === 'event' && r.data.id === ev.id)
                    const status = classifyEventStatus(ev.status)
                    return (
                      <SearchResultRow
                        key={`e-${ev.id}`}
                        index={idx}
                        active={activeIndex === idx}
                        onMouseEnter={() => setActiveIndex(idx)}
                        onClick={() => navigateToResult(flatResults[idx])}
                        thumbnail={
                          ev.banner ? (
                            <img src={ev.banner} alt="" className="size-10 rounded-lg object-cover" />
                          ) : (
                            <div
                              className="size-10 rounded-lg flex items-center justify-center"
                              style={{ background: 'rgba(245, 158, 11, 0.12)' }}
                            >
                              <CalendarDays className="size-5" style={{ color: '#F59E0B' }} />
                            </div>
                          )
                        }
                        title={ev.name}
                        subtitle={
                          <span className="flex items-center gap-1.5">
                            <span className="inline-flex items-center gap-1">
                              <span
                                className="inline-block size-1.5 rounded-full"
                                style={{ background: status.color }}
                              />
                              {status.label}
                            </span>
                            {ev.description && (
                              <>
                                <span className="text-muted-foreground/50">•</span>
                                <span className="line-clamp-1">{ev.description}</span>
                              </>
                            )}
                          </span>
                        }
                      />
                    )
                  })}
                </SearchGroup>
              )}
            </div>
          )}

          {/* Empty state */}
          {showEmptyState && (
            <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center mb-3"
                style={{ background: 'rgba(245, 158, 11, 0.08)' }}
              >
                <Search className="size-7" style={{ color: 'var(--text-muted)' }} />
              </div>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                No results for &ldquo;{query.trim()}&rdquo;
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                Try a different keyword, or browse all contestants and events directly.
              </p>
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => {
                    saveRecent(query.trim())
                    setSearchOpen(false)
                    router.push('/contestants')
                  }}
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors hover:opacity-90"
                  style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)', color: '#0B0F17' }}
                >
                  <Users className="size-3.5" />
                  Browse Contestants
                </button>
                <button
                  onClick={() => {
                    saveRecent(query.trim())
                    setSearchOpen(false)
                    router.push('/events')
                  }}
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors"
                  style={{
                    background: 'var(--surface-2)',
                    color: 'var(--text-secondary)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <CalendarDays className="size-3.5" />
                  Browse Events
                </button>
              </div>
            </div>
          )}

          {/* Initial state (no query, no recent) */}
          {!hasQuery && recent.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center mb-3"
                style={{ background: 'rgba(245, 158, 11, 0.08)' }}
              >
                <Search className="size-7" style={{ color: '#F59E0B' }} />
              </div>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                Search Vibe Hub
              </p>
              <p className="text-xs mt-1 max-w-sm" style={{ color: 'var(--text-muted)' }}>
                Find contestants by name, category. Find events by name or description.
              </p>
              <div className="flex flex-wrap gap-1.5 justify-center mt-4 max-w-md">
                {['Singing', 'Dancing', 'Voting Open'].map((s) => (
                  <button
                    key={s}
                    onClick={() => setQuery(s)}
                    className="rounded-full px-2.5 py-1 text-xs font-medium transition-colors hover:bg-accent"
                    style={{
                      background: 'var(--surface-2)',
                      color: 'var(--text-secondary)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer / keyboard hints */}
        <div
          className="flex items-center justify-between gap-3 px-4 py-2.5 border-t text-[11px] text-muted-foreground"
          style={{ borderColor: 'var(--border-subtle)', background: 'var(--surface-1)' }}
        >
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="inline-flex items-center justify-center rounded border px-1 py-0.5"
                style={{ borderColor: 'var(--border-subtle)', background: 'var(--surface-2)' }}
              >
                <ArrowUp className="size-2.5" />
              </kbd>
              <kbd className="inline-flex items-center justify-center rounded border px-1 py-0.5"
                style={{ borderColor: 'var(--border-subtle)', background: 'var(--surface-2)' }}
              >
                <ArrowDown className="size-2.5" />
              </kbd>
              navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="inline-flex items-center gap-0.5 rounded border px-1 py-0.5"
                style={{ borderColor: 'var(--border-subtle)', background: 'var(--surface-2)' }}
              >
                <CornerDownLeft className="size-2.5" />
              </kbd>
              select
            </span>
          </div>
          <span className="hidden sm:inline">
            Powered by Vibe Hub Search
          </span>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Sub-components ──────────────────────────────────────────────

function SearchGroup({
  icon,
  label,
  count,
  children,
}: {
  icon: React.ReactNode
  label: string
  count: number
  children: React.ReactNode
}) {
  return (
    <div className="mb-1">
      <div className="flex items-center gap-1.5 px-2 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {icon}
        {label}
        <span className="text-muted-foreground/60 font-normal">({count})</span>
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  )
}

function SearchResultRow({
  active,
  onMouseEnter,
  onClick,
  thumbnail,
  title,
  subtitle,
  index,
}: {
  active: boolean
  onMouseEnter: () => void
  onClick: () => void
  thumbnail: React.ReactNode
  title: string
  subtitle: React.ReactNode
  index: number
}) {
  return (
    <button
      data-search-index={index}
      onMouseEnter={onMouseEnter}
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 px-2 py-2 rounded-lg text-left transition-colors',
        active ? 'bg-accent' : 'hover:bg-accent/50',
      )}
      style={active ? { background: 'rgba(245, 158, 11, 0.12)' } : undefined}
    >
      <div className="shrink-0">{thumbnail}</div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
          {title}
        </div>
        <div className="text-xs truncate text-muted-foreground">{subtitle}</div>
      </div>
      {active && (
        <CornerDownLeft className="size-3.5 shrink-0 text-muted-foreground" />
      )}
    </button>
  )
}
