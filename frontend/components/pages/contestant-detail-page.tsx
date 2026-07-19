'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowLeft, Play, ExternalLink, ThumbsUp, Lock, Unlock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { useAppStore } from '@/lib/store'
import { toast } from 'sonner'
import type { SocialPlatformType } from '@/lib/types'
import type { ParticipantApi } from '@/lib/api'

const platformMeta: Record<SocialPlatformType, { icon: React.ReactNode; color: string; label: string }> = {
  TikTok: {
    color: '#000000',
    label: 'TikTok',
    icon: (
      <svg viewBox="0 0 24 24" className="size-4" fill="currentColor">
        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 0 0-.79-.05A6.34 6.34 0 0 0 3.15 15.2a6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.98a8.22 8.22 0 0 0 4.76 1.52V7.05a4.83 4.83 0 0 1-1-.36z" />
      </svg>
    ),
  },
  YouTube: {
    color: '#FF0000',
    label: 'YouTube',
    icon: (
      <svg viewBox="0 0 24 24" className="size-4" fill="currentColor">
        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
      </svg>
    ),
  },
  Instagram: {
    color: '#E4405F',
    label: 'Instagram',
    icon: (
      <svg viewBox="0 0 24 24" className="size-4" fill="currentColor">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z" />
      </svg>
    ),
  },
  Facebook: {
    color: '#1877F2',
    label: 'Facebook',
    icon: (
      <svg viewBox="0 0 24 24" className="size-4" fill="currentColor">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
      </svg>
    ),
  },
}

export function ContestantDetailContent({ participant }: { participant: ParticipantApi }) {
  const { isVotingUnlocked } = useAppStore()
  const [voteCount, setVoteCount] = useState(participant.votes)
  const [pulseKey, setPulseKey] = useState(0)

  const p = participant
  const meta = platformMeta[p.platform as SocialPlatformType]

  const handleVote = () => {
    setVoteCount((prev) => prev + 1)
    setPulseKey((k) => k + 1)
    toast.success('Vote recorded!')
  }

  return (
    <div className="animate-fade-in">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 md:py-12">
        {/* Back button */}
        <Link
          href="/contestants"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to contestants
        </Link>

        {/* Two-column layout */}
        <div className="grid gap-8 md:grid-cols-2 md:gap-12">
          {/* Left: Video embed area */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <div className="relative aspect-video overflow-hidden rounded-lg bg-muted">
              {/* Platform-branded video preview area */}
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                {/* Platform icon */}
                <div
                  className="flex size-14 items-center justify-center rounded-2xl"
                  style={{ backgroundColor: meta.color + '15' }}
                >
                  <span style={{ color: meta.color }}>{meta.icon}</span>
                </div>
                {/* Play button to open video */}
                <button
                  onClick={() => {
                    if (p.videoUrl) window.open(p.videoUrl, '_blank', 'noopener,noreferrer')
                  }}
                  className="flex size-14 items-center justify-center rounded-full bg-foreground text-background shadow-lg transition-transform hover:scale-105"
                  aria-label="Watch video on platform"
                >
                  <Play className="size-5 ml-0.5" />
                </button>
                <p className="text-xs text-muted-foreground">
                  Video hosted on {meta.label}
                </p>
              </div>
            </div>

            {/* Social platform link bar */}
            <a
              href={p.videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground transition-all hover:border-foreground/20 hover:text-foreground hover:bg-muted"
            >
              {meta.icon}
              Watch full video on {meta.label}
              <ExternalLink className="size-3.5" />
            </a>
          </motion.div>

          {/* Right: Info panel */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="flex flex-col"
          >
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="text-xs uppercase tracking-wide">
                {p.category}
              </Badge>
              {/* Platform badge with brand color */}
              <Badge
                variant="outline"
                className="gap-1 text-xs"
                style={{ borderColor: meta.color + '40', color: meta.color }}
              >
                {meta.icon}
                {meta.label}
              </Badge>
            </div>

            <h1 className="mt-3 text-2xl font-bold md:text-3xl">{p.name}</h1>

            {p.bio && (
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {p.bio}
              </p>
            )}

            <Separator className="my-5" />

            {/* Vote count */}
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Total Votes
              </p>
              <p
                key={pulseKey}
                className="mt-1 text-4xl font-extrabold text-[#C8A24D] animate-count-pulse"
              >
                {voteCount.toLocaleString()}
              </p>
            </div>

            {/* Social platform info card */}
            <div className="mt-4 rounded-lg border border-border p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
                Performance Details
              </p>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Platform</span>
                  <span className="flex items-center gap-1.5 font-medium">
                    {meta.icon}
                    {meta.label}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Category</span>
                  <span className="font-medium">{p.category}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <span className="flex items-center gap-1.5">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#22C55E] opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-[#22C55E]" />
                    </span>
                    Accepting votes
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-auto pt-6">
              {!isVotingUnlocked ? (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Lock className="size-4 text-muted-foreground" />
                    <h2 className="text-lg font-bold">Unlock Voting</h2>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-1">
                    A one-time fee is required to unlock unlimited voting for the
                    current round.
                  </p>
                  <p className="text-xl font-bold mb-4">$1.00 USD</p>
                  <Link href={`/payment/${p.id}`}>
                    <Button
                      size="lg"
                      className="w-full rounded-full"
                    >
                      <Unlock className="size-4" />
                      Unlock to Vote
                    </Button>
                  </Link>
                </div>
              ) : (
                <div>
                  <Button
                    size="lg"
                    onClick={handleVote}
                    className="w-full rounded-full"
                  >
                    <ThumbsUp className="size-4" />
                    Vote for {p.name}
                  </Button>
                  <p className="mt-2 text-center text-xs text-muted-foreground">
                    You can vote as many times as you like
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}