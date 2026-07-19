'use client'

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Play, Lock, Unlock, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { useAppStore } from '@/lib/store'
import { getPublicParticipants, type ParticipantApi } from '@/lib/api'
import type { SocialPlatformType } from '@/lib/types'

const platformIcons: Record<SocialPlatformType, React.ReactNode> = {
  TikTok: (
    <svg viewBox="0 0 24 24" className="size-3.5" fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 0 0-.79-.05A6.34 6.34 0 0 0 3.15 15.2a6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.98a8.22 8.22 0 0 0 4.76 1.52V7.05a4.83 4.83 0 0 1-1-.36z" />
    </svg>
  ),
  YouTube: (
    <svg viewBox="0 0 24 24" className="size-3.5" fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  ),
  Instagram: (
    <svg viewBox="0 0 24 24" className="size-3.5" fill="currentColor">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z" />
    </svg>
  ),
  Facebook: (
    <svg viewBox="0 0 24 24" className="size-3.5" fill="currentColor">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  ),
}

const categories = ['All', 'Singing', 'Dancing', 'Comedy', 'Acting', 'Fashion']

export function ContestantsPage() {
  const { categoryFilter, setCategoryFilter, isVotingUnlocked } =
    useAppStore()
  const [participants, setParticipants] = useState<ParticipantApi[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const fetchParticipants = async () => {
      try {
        const result = await getPublicParticipants()
        if (!cancelled) setParticipants(result.items)
      } catch {
        // error handled silently
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchParticipants()
    return () => { cancelled = true }
  }, [])

  const filtered = useMemo(() => {
    const approved = participants.filter((p) => p.status === 'Approved')
    if (categoryFilter === 'All') return approved
    return approved.filter((p) => p.category === categoryFilter)
  }, [participants, categoryFilter])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="animate-fade-in">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 md:py-14">
        {/* Page header */}
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">
            Contestants
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Browse and vote for your favourites
          </p>
        </div>

        {/* Category filter bar */}
        <div className="mb-8 flex flex-wrap gap-2">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
                categoryFilter === cat
                  ? 'bg-foreground text-background'
                  : 'border border-border text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Contestant grid */}
        <motion.div
          initial="hidden"
          animate="visible"
          variants={{
            visible: { transition: { staggerChildren: 0.04 } },
          }}
          className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 md:gap-5"
        >
          {filtered.map((p, i) => (
            <ContestantCard
              key={p.id}
              participant={p}
              index={i}
              isVotingUnlocked={isVotingUnlocked}
            />
          ))}
        </motion.div>

        {filtered.length === 0 && (
          <div className="py-20 text-center">
            <p className="text-sm text-muted-foreground">
              No contestants found in this category.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function ContestantCard({
  participant,
  index,
  isVotingUnlocked,
}: {
  participant: ParticipantApi
  index: number
  isVotingUnlocked: boolean
}) {
  return (
    <Link href={`/contestants/${participant.id}`}>
      <motion.div
        variants={{
          hidden: { opacity: 0, y: 12 },
          visible: {
            opacity: 1,
            y: 0,
            transition: { duration: 0.4, delay: index * 0.04, ease: 'easeOut' as const },
          },
        }}
        className="group w-full rounded-lg border border-border bg-card text-left transition-all duration-200 hover:border-foreground/20 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        {/* Portrait placeholder */}
        <div className="relative aspect-[4/5] overflow-hidden rounded-t-lg bg-muted">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-background/80">
              <Play className="size-5 text-muted-foreground" />
            </div>
          </div>
          {/* Platform badge overlay */}
          <div className="absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-background/90 px-2 py-1 text-[10px] font-medium text-foreground backdrop-blur-sm">
            {platformIcons[participant.platform as SocialPlatformType]}
            {participant.platform}
          </div>
          {/* Voting lock/unlock indicator */}
          <div className="absolute top-2 right-2">
            {isVotingUnlocked ? (
              <Unlock className="size-4 text-[#C8A24D]" />
            ) : (
              <Lock className="size-4 text-muted-foreground" />
            )}
          </div>
        </div>

        {/* Info */}
        <div className="p-3 md:p-4">
          <Badge
            variant="secondary"
            className="mb-2 text-[10px] font-normal tracking-wide uppercase"
          >
            {participant.category}
          </Badge>
          <h3 className="text-sm font-semibold leading-tight line-clamp-1 text-foreground">
            {participant.name}
          </h3>
          <p className="mt-2 text-lg font-bold text-[#C8A24D]">
            {participant.votes.toLocaleString()}
          </p>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
            votes
          </p>
        </div>
      </motion.div>
    </Link>
  )
}