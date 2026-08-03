'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { ChevronRight } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { useRouter } from 'next/navigation'
import { listPublicEvents, type EventItem } from '@/lib/api'

const filterOptions = [
  { label: 'All Events', value: 'All', color: '#94A3B8' },
  { label: 'Ongoing', value: 'Ongoing', color: '#22C55E' },
  { label: 'Upcoming', value: 'Upcoming', color: '#3B82F6' },
  { label: 'Completed', value: 'Completed', color: '#6B7280' },
]

// Small color swatch used as a placeholder for the status pills (which
// do not have banner images). Color matches the pill's status theme.
function StatusSwatch({ color, active }: { color: string; active: boolean }) {
  return (
    <span
      className="inline-block w-3 h-3 rounded-full shrink-0 transition-transform duration-200"
      style={{
        background: active ? '#0B0F17' : color,
        boxShadow: active ? 'none' : `0 0 6px ${color}66`,
      }}
    />
  )
}

// Small 24x24 thumbnail. Renders the event's banner image when present,
// otherwise a gradient circle placeholder derived from the event name.
function EventThumb({ event }: { event: EventItem }) {
  const fallbackGradient = (() => {
    let hash = 0
    for (let i = 0; i < event.name.length; i++) {
      hash = event.name.charCodeAt(i) + ((hash << 5) - hash)
    }
    const palette = [
      'linear-gradient(135deg, #F59E0B, #D97706)',
      'linear-gradient(135deg, #EC4899, #A855F7)',
      'linear-gradient(135deg, #3B82F6, #0EA5E9)',
      'linear-gradient(135deg, #10B981, #14B8A6)',
      'linear-gradient(135deg, #F43F5E, #FB923C)',
    ]
    return palette[Math.abs(hash) % palette.length]
  })()

  if (event.banner) {
    return (
      <img
        src={event.banner}
        alt=""
        className="w-6 h-6 rounded-full object-cover shrink-0 border border-border-subtle"
        loading="lazy"
      />
    )
  }
  return (
    <span
      className="w-6 h-6 rounded-full shrink-0 border border-border-subtle"
      style={{ background: fallbackGradient }}
    />
  )
}

export function EventFilterBar() {
  const { eventFilter, setEventFilter, setSelectedEventId } = useAppStore()
  const router = useRouter()
  const [events, setEvents] = useState<EventItem[]>([])

  // Fetch a short list of active/upcoming events to surface as quick-pick
  // pills alongside the status filters. Failures are non-fatal.
  useEffect(() => {
    let cancelled = false
    listPublicEvents()
      .then(({ events: fetched }) => {
        if (cancelled) return
        const visible = (fetched || [])
          .filter((e) => {
            const s = (e.status || '').toLowerCase().replace(/\s+/g, '')
            return (
              s !== 'draft' &&
              s !== 'completed' &&
              s !== 'archived' &&
              s !== 'votingclosed'
            )
          })
          .slice(0, 5)
        setEvents(visible)
      })
      .catch(() => {
        // Silent — filter still works without event quick-picks.
      })
    return () => {
      cancelled = true
    }
  }, [])

  const handleEventClick = (eventId: string) => {
    setSelectedEventId(eventId)
    router.push('/contestants')
  }

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
      {filterOptions.map((option) => {
        const isActive = eventFilter === option.value
        return (
          <button
            key={option.value}
            onClick={() => setEventFilter(option.value)}
            className="relative shrink-0 rounded-full pl-2.5 pr-3.5 py-1.5 text-sm font-medium transition-all duration-200 flex items-center gap-2"
            style={{
              background: isActive
                ? 'linear-gradient(135deg, #F59E0B, #D97706)'
                : 'var(--surface-3)',
              color: isActive ? '#0B0F17' : 'var(--text-muted)',
              border: isActive
                ? '1px solid transparent'
                : '1px solid var(--border-subtle)',
            }}
          >
            {isActive && (
              <motion.div
                layoutId="eventFilterActive"
                className="absolute inset-0 rounded-full"
                style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)' }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-2">
              <StatusSwatch color={option.color} active={isActive} />
              {option.label}
            </span>
          </button>
        )
      })}

      {/* Divider — visible only when we have event quick-picks */}
      {events.length > 0 && (
        <span
          className="shrink-0 h-5 w-px"
          style={{ background: 'var(--border-subtle)' }}
        />
      )}

      {/* Event quick-pick pills with banner thumbnails */}
      {events.map((event) => (
        <button
          key={event.id}
          onClick={() => handleEventClick(event.id)}
          title={event.name}
          className="shrink-0 rounded-full pl-1 pr-3 py-1 text-sm font-medium transition-all duration-200 flex items-center gap-2"
          style={{
            background: 'var(--surface-3)',
            color: 'var(--text-muted)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <EventThumb event={event} />
          <span className="max-w-[120px] truncate">{event.name}</span>
        </button>
      ))}

      {/* View All Events button */}
      <button
        onClick={() => router.push('/events')}
        className="relative shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold transition-all duration-200 flex items-center gap-1"
        style={{
          background: 'rgba(245, 158, 11, 0.12)',
          color: '#F59E0B',
          border: '1px solid rgba(245, 158, 11, 0.3)',
        }}
      >
        View All Events
        <ChevronRight className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
