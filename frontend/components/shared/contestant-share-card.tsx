'use client'

import { useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Share2,
  Crown,
  Vote,
  Trophy,
  TrendingUp,
} from 'lucide-react'
import { ShareModal } from '@/components/shared/share-modal'
import { ParticipantAvatar } from '@/components/shared/participant-avatar'

// ─── Types ────────────────────────────────────────────────────────

interface ContestantShareCardProps {
  id: string
  name: string
  category: string
  votes: number
  rank?: number
  bio?: string | null
  imageUrl?: string | null
  thumbnailUrl?: string | null
  compact?: boolean
  className?: string
}

// ─── Rank badge helper ───────────────────────────────────────────

function getRankDisplay(rank: number): {
  icon: React.ReactNode
  color: string
  bg: string
  label: string
} {
  if (rank === 1) {
    return {
      icon: <Crown className="size-4" />,
      color: '#FBBF24',
      bg: 'rgba(251, 191, 36, 0.15)',
      label: '1st Place',
    }
  }
  if (rank === 2) {
    return {
      icon: <Trophy className="size-4" />,
      color: '#94A3B8',
      bg: 'rgba(148, 163, 184, 0.15)',
      label: '2nd Place',
    }
  }
  if (rank === 3) {
    return {
      icon: <Trophy className="size-4" />,
      color: '#D97706',
      bg: 'rgba(217, 119, 6, 0.15)',
      label: '3rd Place',
    }
  }
  return {
    icon: <TrendingUp className="size-4" />,
    color: '#64748B',
    bg: 'rgba(100, 116, 139, 0.1)',
    label: `#${rank}`,
  }
}

// ─── Component ────────────────────────────────────────────────────

export function ContestantShareCard({
  id,
  name,
  category,
  votes,
  rank,
  bio,
  imageUrl,
  thumbnailUrl,
  compact = false,
  className = '',
}: ContestantShareCardProps) {
  const [shareModalOpen, setShareModalOpen] = useState(false)

  const rankDisplay = rank ? getRankDisplay(rank) : null

  const shareTitle = `${name} — Vibe Hub`
  const shareDescription = `Check out ${name} on Vibe Hub — ${category} performer with ${votes.toLocaleString()} votes! Cast your vote now!`

  const handleShareClick = useCallback(() => {
    setShareModalOpen(true)
  }, [])

  // ─── Compact variant ──────────────────────────────────────────
  if (compact) {
    return (
      <>
        <motion.div
          whileHover={{ scale: 1.01, y: -2 }}
          whileTap={{ scale: 0.99 }}
          className={`rounded-xl overflow-hidden relative ${className}`}
          style={{
            background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.08), rgba(15, 22, 35, 0.9))',
            border: '1px solid rgba(245, 158, 11, 0.12)',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
          }}
        >
          {/* Decorative glow */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'radial-gradient(ellipse at 80% 20%, rgba(245, 158, 11, 0.08) 0%, transparent 60%)',
            }}
          />

          <div className="relative p-3 flex items-center gap-3">
            {/* Avatar */}
            <ParticipantAvatar name={name} imageUrl={imageUrl} thumbnailUrl={thumbnailUrl} size="sm" />

            {/* Info */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-semibold truncate text-white">{name}</p>
                {rankDisplay && (
                  <span
                    className="shrink-0 inline-flex items-center"
                    style={{ color: rankDisplay.color }}
                  >
                    {rankDisplay.icon}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span
                  className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                  style={{
                    backgroundColor: 'rgba(245, 158, 11, 0.12)',
                    color: '#FBBF24',
                  }}
                >
                  {category}
                </span>
                <span className="flex items-center gap-0.5 text-[10px] font-medium" style={{ color: '#D97706' }}>
                  <Vote className="size-2.5" />
                  {votes.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Share button */}
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={handleShareClick}
              className="shrink-0 rounded-lg p-2 transition-colors duration-200"
              style={{
                background: 'linear-gradient(135deg, #F59E0B, #D97706)',
                color: '#0B0F17',
                boxShadow: '0 2px 8px rgba(245, 158, 11, 0.3)',
              }}
            >
              <Share2 className="size-3.5" />
            </motion.button>
          </div>
        </motion.div>

        <ShareModal
          open={shareModalOpen}
          onOpenChange={setShareModalOpen}
          title={shareTitle}
          description={shareDescription}
          contestant={{ name, category, votes, rank }}
          participantId={id}
        />
      </>
    )
  }

  // ─── Full variant ─────────────────────────────────────────────
  return (
    <>
      <motion.div
        whileHover={{ y: -4, scale: 1.01 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className={`rounded-2xl overflow-hidden relative ${className}`}
        style={{
          background: 'linear-gradient(145deg, rgba(245, 158, 11, 0.1), rgba(15, 22, 35, 0.95), rgba(217, 119, 6, 0.05))',
          border: rank && rank <= 3
            ? `1px solid ${rankDisplay?.color}30`
            : '1px solid rgba(245, 158, 11, 0.12)',
          boxShadow: rank && rank <= 3
            ? `0 8px 30px rgba(0, 0, 0, 0.4), 0 0 20px ${rankDisplay?.color}10`
            : '0 8px 30px rgba(0, 0, 0, 0.3)',
        }}
      >
        {/* Decorative elements */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse at 30% 0%, rgba(245, 158, 11, 0.1) 0%, transparent 50%)',
          }}
        />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse at 80% 100%, rgba(217, 119, 6, 0.06) 0%, transparent 50%)',
          }}
        />

        {/* Top rank banner */}
        {rank && rank <= 3 && rankDisplay && (
          <div
            className="relative px-4 py-1.5 flex items-center justify-center gap-2"
            style={{
              background: `linear-gradient(90deg, ${rankDisplay.color}10, ${rankDisplay.color}20, ${rankDisplay.color}10)`,
              borderBottom: `1px solid ${rankDisplay.color}20`,
            }}
          >
            <span style={{ color: rankDisplay.color }}>{rankDisplay.icon}</span>
            <span
              className="text-[10px] font-bold uppercase tracking-wider"
              style={{ color: rankDisplay.color }}
            >
              {rankDisplay.label}
            </span>
          </div>
        )}

        <div className="relative p-5">
          {/* Avatar + Name row */}
          <div className="flex items-center gap-4">
            {/* Avatar */}
            <div className="relative shrink-0">
              <ParticipantAvatar name={name} imageUrl={imageUrl} thumbnailUrl={thumbnailUrl} size="lg" />
              {rank && rank <= 3 && (
                <div
                  className="absolute -top-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center"
                  style={{
                    background: `linear-gradient(135deg, ${rankDisplay?.color}, ${rankDisplay?.color}CC)`,
                    boxShadow: `0 2px 8px ${rankDisplay?.color}40`,
                  }}
                >
                  {rankDisplay?.icon}
                </div>
              )}
            </div>

            {/* Name & badges */}
            <div className="min-w-0 flex-1">
              <h3 className="text-lg font-bold text-white truncate">{name}</h3>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span
                  className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                  style={{
                    backgroundColor: 'rgba(245, 158, 11, 0.12)',
                    color: '#FBBF24',
                  }}
                >
                  {category}
                </span>
              </div>
            </div>
          </div>

          {/* Vote count */}
          <div
            className="mt-4 flex items-center justify-between rounded-xl p-3"
            style={{
              background: 'rgba(245, 158, 11, 0.06)',
              border: '1px solid rgba(245, 158, 11, 0.1)',
            }}
          >
            <div className="flex items-center gap-2">
              <Vote className="size-4" style={{ color: '#F59E0B' }} />
              <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                Total Votes
              </span>
            </div>
            <span
              className="text-lg font-bold"
              style={{ color: '#FBBF24' }}
            >
              {votes.toLocaleString()}
            </span>
          </div>

          {/* Bio (truncated) */}
          {bio && (
            <p
              className="mt-3 text-xs leading-relaxed line-clamp-2"
              style={{ color: 'var(--text-muted)' }}
            >
              {bio}
            </p>
          )}

          {/* Share button */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleShareClick}
            className="mt-4 w-full flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-200"
            style={{
              background: 'linear-gradient(135deg, #F59E0B, #D97706)',
              color: '#0B0F17',
              boxShadow: '0 4px 15px rgba(245, 158, 11, 0.25)',
            }}
          >
            <Share2 className="size-4" />
            Share {name}
          </motion.button>
        </div>
      </motion.div>

      <ShareModal
        open={shareModalOpen}
        onOpenChange={setShareModalOpen}
        title={shareTitle}
        description={shareDescription}
        contestant={{ name, category, votes, rank }}
        participantId={id}
      />
    </>
  )
}
