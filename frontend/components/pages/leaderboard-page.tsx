'use client'

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Crown, ThumbsUp, Trophy, Medal, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { getPublicLeaderboard, type ParticipantApi } from '@/lib/api'
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

function rankStyle(rank: number) {
  if (rank === 1)
    return {
      border: 'border-[#C8A24D]',
      bg: 'bg-[#C8A24D]/5',
      rankColor: 'text-[#C8A24D]',
      icon: <Crown className="size-4 text-[#C8A24D]" />,
      badge: (
        <Badge className="bg-[#C8A24D] text-[#1a1a1a] text-[10px] border-0 gap-1">
          <Crown className="size-3" />
          Leading
        </Badge>
      ),
    }
  if (rank === 2)
    return {
      border: 'border-warm-300 dark:border-warm-500',
      bg: '',
      rankColor: 'text-warm-400',
      icon: <Medal className="size-4 text-warm-400" />,
      badge: null,
    }
  if (rank === 3)
    return {
      border: 'border-warm-400/60 dark:border-warm-600',
      bg: '',
      rankColor: 'text-warm-500',
      icon: <Medal className="size-4 text-warm-500" />,
      badge: null,
    }
  return {
    border: 'border-border',
    bg: '',
    rankColor: 'text-muted-foreground',
    icon: null,
    badge: null,
  }
}

export function LeaderboardPage() {
  const [participants, setParticipants] = useState<ParticipantApi[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const fetchData = async () => {
      try {
        const result = await getPublicLeaderboard()
        if (!cancelled) setParticipants(result)
      } catch {
        // error handled silently
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchData()
    return () => { cancelled = true }
  }, [])

  const sorted = useMemo(() => {
    if (!Array.isArray(participants)) return [];
    return [...participants].sort((a, b) => b.votes - a.votes);
  }, [participants]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="animate-fade-in">
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 md:py-14">
        {/* Page header */}
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">
            Leaderboard
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Live standings
          </p>
        </div>

        {/* Ranked list */}
        <motion.div
          initial="hidden"
          animate="visible"
          variants={{
            visible: { transition: { staggerChildren: 0.05 } },
          }}
        >
          {sorted.map((p, i) => {
            const rank = i + 1
            const style = rankStyle(rank)

            return (
              <motion.div
                key={p.id}
                variants={{
                  hidden: { opacity: 0, y: 8 },
                  visible: {
                    opacity: 1,
                    y: 0,
                    transition: { duration: 0.35, ease: 'easeOut' as const },
                  },
                }}
              >
                <Link
                  href={`/contestants/${p.id}`}
                  className={`block w-full rounded-lg border ${style.border} ${style.bg} p-4 text-left transition-all hover:bg-muted hover:text-foreground md:p-5 ${rank === 1 ? 'md:py-6 md:px-6' : ''}`}
                >
                  <div className="flex items-center gap-4">
                    {/* Rank */}
                    <div className="flex w-10 shrink-0 items-center justify-center">
                      {rank <= 3 ? (
                        <div className="flex flex-col items-center gap-0.5">
                          {style.icon}
                          <span
                            className={`text-lg font-extrabold ${style.rankColor}`}
                          >
                            {rank}
                          </span>
                        </div>
                      ) : (
                        <span className="text-lg font-bold text-muted-foreground">
                          {rank}
                        </span>
                      )}
                    </div>

                    {/* Name + meta */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold truncate md:text-base">
                          {p.name}
                        </h3>
                        {style.badge}
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{p.category}</span>
                        <span className="text-border">·</span>
                        <span className="flex items-center gap-1">
                          {platformIcons[p.platform as SocialPlatformType]}
                          {p.platform}
                        </span>
                      </div>
                    </div>

                    {/* Vote count */}
                    <div className="text-right shrink-0">
                      <p className="text-lg font-bold text-[#C8A24D] md:text-xl">
                        {p.votes.toLocaleString()}
                      </p>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        votes
                      </p>
                    </div>
                  </div>
                </Link>

                {i < sorted.length - 1 && <Separator className="my-1.5" />}
              </motion.div>
            )
          })}
        </motion.div>

        {/* CTA */}
        <div className="mt-10 text-center">
          <Link href="/contestants">
            <Button
              size="lg"
              className="rounded-full"
            >
              <ThumbsUp className="size-4" />
              Cast Your Vote
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}