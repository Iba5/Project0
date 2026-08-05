'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Achievement, AchievementsResponse } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import {
  Vote,
  DollarSign,
  Calendar,
  Clock,
  Flame,
  Lock,
  Trophy,
  Sparkles,
  Target,
  Zap,
  Crown,
  Share2,
  Moon,
} from 'lucide-react'

// Map icon name strings to actual Lucide components
const ICON_MAP: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  Vote,
  DollarSign,
  Calendar,
  Clock,
  Flame,
  Trophy,
  Sparkles,
  Target,
  Zap,
  Crown,
  Share2,
  Moon,
}

// Tier colors matching the spec
const TIER_COLORS: Record<string, { color: string; bg: string; glow: string }> = {
  bronze: { color: '#CD7F32', bg: 'rgba(205,127,50,0.12)', glow: 'rgba(205,127,50,0.25)' },
  silver: { color: '#C0C0C0', bg: 'rgba(192,192,192,0.12)', glow: 'rgba(192,192,192,0.25)' },
  gold: { color: '#FFD700', bg: 'rgba(255,215,0,0.12)', glow: 'rgba(255,215,0,0.25)' },
  platinum: { color: '#E5E4E2', bg: 'rgba(229,228,226,0.12)', glow: 'rgba(229,228,226,0.25)' },
  diamond: { color: '#B9F2FF', bg: 'rgba(185,242,255,0.12)', glow: 'rgba(185,242,255,0.25)' },
}

type CategoryFilter = 'all' | 'voting' | 'milestone' | 'social' | 'special'

const CATEGORY_TABS: Array<{ value: CategoryFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'voting', label: 'Voting' },
  { value: 'milestone', label: 'Milestone' },
  { value: 'social', label: 'Social' },
  { value: 'special', label: 'Special' },
]

// Confetti particle component
function ConfettiParticle({ color, delay }: { color: string; delay: number }) {
  const angle = Math.random() * 360
  const distance = 40 + Math.random() * 60
  const x = Math.cos((angle * Math.PI) / 180) * distance
  const y = Math.sin((angle * Math.PI) / 180) * distance

  return (
    <motion.div
      className="absolute w-1.5 h-1.5 rounded-full"
      style={{ background: color, left: '50%', top: '50%' }}
      initial={{ opacity: 1, x: 0, y: 0, scale: 1 }}
      animate={{
        opacity: 0,
        x,
        y,
        scale: 0.3,
        rotate: Math.random() * 360,
      }}
      transition={{ duration: 0.8 + Math.random() * 0.4, delay, ease: 'easeOut' as const }}
    />
  )
}

// Achievement unlock celebration
function AchievementCelebration({ tier, onDone }: { tier: string; onDone: () => void }) {
  const tierConfig = TIER_COLORS[tier] || TIER_COLORS.bronze
  const particles = useMemo(() =>
    Array.from({ length: 12 }, (_, i) => ({
      id: i,
      color: [tierConfig.color, '#FFD700', '#F59E0B', '#ffffff'][i % 4],
      delay: i * 0.03,
    })),
    [tierConfig.color]
  )

  useEffect(() => {
    const timer = setTimeout(onDone, 1500)
    return () => clearTimeout(timer)
  }, [onDone])

  return (
    <div className="absolute inset-0 pointer-events-none z-20 overflow-hidden rounded-xl">
      {particles.map((p) => (
        <ConfettiParticle key={p.id} color={p.color} delay={p.delay} />
      ))}
    </div>
  )
}

interface AchievementGridProps {
  data: AchievementsResponse
  loading?: boolean
  isAuthenticated?: boolean
  onAchievementClick?: (achievement: Achievement) => void
}

export default function AchievementGrid({ data, loading, isAuthenticated, onAchievementClick }: AchievementGridProps) {
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>('all')
  const [celebratingId, setCelebratingId] = useState<string | null>(null)

  const filteredAchievements = useMemo(() => {
    if (activeCategory === 'all') return data.achievements
    return data.achievements.filter((a) => a.category === activeCategory)
  }, [data.achievements, activeCategory])

  const handleCelebrationDone = useCallback(() => {
    setCelebratingId(null)
  }, [])

  if (loading) {
    return (
      <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--surface-elevated)', borderColor: 'var(--border-subtle)' }}>
        <div className="p-6 text-center" style={{ color: 'var(--text-muted)' }}>
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            className="inline-block mb-3"
          >
            <Sparkles className="w-6 h-6" style={{ color: '#F59E0B' }} />
          </motion.div>
          <p className="text-sm">Loading achievements...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--surface-elevated)', borderColor: 'var(--border-subtle)' }}>
        <div className="p-8 text-center">
          <Lock className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
          <p className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Sign in to view your achievements</p>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Unlock badges and track your voting milestones</p>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--surface-elevated)', borderColor: 'var(--border-subtle)' }}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
        <h3 className="font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
          <Trophy className="w-4 h-4" style={{ color: '#F59E0B' }} />
          Achievements
        </h3>
        <div className="flex items-center gap-2">
          <Badge
            style={{
              background: 'rgba(245,158,11,0.12)',
              color: '#F59E0B',
              border: '1px solid rgba(245,158,11,0.25)',
            }}
          >
            {data.totalPoints} pts
          </Badge>
          <Badge
            style={{
              background: 'rgba(245,158,11,0.12)',
              color: '#F59E0B',
              border: '1px solid rgba(245,158,11,0.25)',
            }}
          >
            {data.totalUnlocked}/{data.totalAchievements} Unlocked
          </Badge>
        </div>
      </div>

      {/* Summary bar */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex-1">
            <div className="w-full h-2.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${data.totalAchievements > 0 ? (data.totalUnlocked / data.totalAchievements) * 100 : 0}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className="h-full rounded-full"
                style={{ background: 'linear-gradient(90deg, #F59E0B, #D97706)' }}
              />
            </div>
          </div>
          <span className="text-xs font-medium whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
            {data.totalUnlocked}/{data.totalAchievements}
          </span>
        </div>
      </div>

      {/* Category filter tabs */}
      <div className="px-4 pb-3">
        <div className="flex items-center gap-1 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {CATEGORY_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveCategory(tab.value)}
              className="px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all"
              style={{
                background: activeCategory === tab.value ? 'rgba(245,158,11,0.15)' : 'var(--surface-2)',
                color: activeCategory === tab.value ? '#F59E0B' : 'var(--text-muted)',
                border: `1px solid ${activeCategory === tab.value ? 'rgba(245,158,11,0.3)' : 'var(--border-subtle)'}`,
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Achievement grid */}
      <div className="p-4 grid grid-cols-2 md:grid-cols-3 gap-3">
        {filteredAchievements.map((achievement, idx) => (
          <div key={achievement.id} className="relative">
            <AchievementCard
              achievement={achievement}
              index={idx}
              onClick={() => onAchievementClick?.(achievement)}
              onNewlyUnlocked={() => setCelebratingId(achievement.id)}
            />
            <AnimatePresence>
              {celebratingId === achievement.id && (
                <AchievementCelebration
                  tier={achievement.tier}
                  onDone={handleCelebrationDone}
                />
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>

      {filteredAchievements.length === 0 && (
        <div className="p-8 text-center" style={{ color: 'var(--text-muted)' }}>
          <p className="text-sm">No achievements in this category yet.</p>
        </div>
      )}
    </div>
  )
}

function AchievementCard({ achievement, index, onClick, onNewlyUnlocked }: {
  achievement: Achievement
  index: number
  onClick?: () => void
  onNewlyUnlocked?: () => void
}) {
  const tierConfig = TIER_COLORS[achievement.tier] || TIER_COLORS.bronze
  const IconComponent = ICON_MAP[achievement.icon] || Vote
  const reqVal = typeof achievement.requirement === 'number'
    ? achievement.requirement
    : (achievement.requirement ? (Number(achievement.requirement) || achievement.maxProgress || 0) : (achievement.maxProgress || 0))
  const progressPercent = reqVal > 0
    ? Math.min(100, (achievement.progress / reqVal) * 100)
    : 0

  // Check if this is a newly unlocked achievement (recently unlocked within last 60 seconds)
  const isNewlyUnlocked = useMemo(() => {
    if (!achievement.unlocked || !achievement.unlockedAt) return false
    const unlockedTime = new Date(achievement.unlockedAt).getTime()
    const now = Date.now()
    return (now - unlockedTime) < 60000 // within 60 seconds
  }, [achievement.unlocked, achievement.unlockedAt])

  useEffect(() => {
    if (isNewlyUnlocked && onNewlyUnlocked) {
      // Small delay to allow the card to render first
      const timer = setTimeout(onNewlyUnlocked, 300)
      return () => clearTimeout(timer)
    }
  }, [isNewlyUnlocked, onNewlyUnlocked])

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.3, delay: index * 0.04 }}
      className="relative rounded-xl p-4 transition-all cursor-pointer"
      style={{
        background: achievement.unlocked ? tierConfig.bg : 'var(--surface-1)',
        border: `1px solid ${achievement.unlocked ? tierConfig.color + '33' : 'var(--border-subtle)'}`,
        opacity: achievement.unlocked ? 1 : 0.6,
        ...(achievement.unlocked ? {
          boxShadow: `0 0 20px ${tierConfig.glow}, inset 0 1px 0 ${tierConfig.color}15`,
        } : {}),
      }}
      onClick={onClick}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      {/* Glow pulse animation for unlocked achievements */}
      {achievement.unlocked && (
        <motion.div
          className="absolute inset-0 rounded-xl pointer-events-none"
          style={{
            border: `1px solid ${tierConfig.color}40`,
          }}
          animate={{
            boxShadow: [
              `0 0 5px ${tierConfig.glow}`,
              `0 0 15px ${tierConfig.glow}`,
              `0 0 5px ${tierConfig.glow}`,
            ],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      )}

      {/* Lock overlay for locked achievements */}
      {!achievement.unlocked && (
        <div className="absolute inset-0 rounded-xl flex items-center justify-center bg-black/20 backdrop-blur-[1px] z-10">
          <Lock className="w-5 h-5" style={{ color: 'var(--text-muted)', opacity: 0.6 }} />
        </div>
      )}

      {/* Icon + Tier badge + Points */}
      <div className="flex items-start justify-between mb-3">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center"
          style={{
            background: achievement.unlocked ? tierConfig.bg : 'var(--surface-2)',
            border: `2px solid ${achievement.unlocked ? tierConfig.color + '55' : 'var(--border-subtle)'}`,
            ...(achievement.unlocked ? { boxShadow: `0 0 12px ${tierConfig.glow}` } : {}),
          }}
        >
          <IconComponent
            className="w-5 h-5"
            style={{ color: achievement.unlocked ? tierConfig.color : 'var(--text-muted)' }}
          />
        </div>
        <div className="flex flex-col items-end gap-1">
          <span
            className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider"
            style={{
              background: tierConfig.bg,
              color: tierConfig.color,
              border: `1px solid ${tierConfig.color}33`,
            }}
          >
            {achievement.tier}
          </span>
          <span
            className="text-[9px] font-semibold"
            style={{ color: achievement.unlocked ? '#F59E0B' : 'var(--text-muted)' }}
          >
            +{achievement.points} pts
          </span>
        </div>
      </div>

      {/* Name + Description */}
      <div
        className="text-sm font-semibold mb-0.5 truncate"
        style={{ color: achievement.unlocked ? 'var(--text-primary)' : 'var(--text-muted)' }}
      >
        {achievement.name}
      </div>
      <div
        className="text-[11px] mb-3 line-clamp-2"
        style={{ color: 'var(--text-muted)' }}
      >
        {achievement.description}
      </div>

      {/* Progress bar */}
      <div className="space-y-1">
        <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 0.6, delay: index * 0.04 + 0.2 }}
            className="h-full rounded-full"
            style={{
              background: achievement.unlocked
                ? `linear-gradient(90deg, ${tierConfig.color}, ${tierConfig.color}88)`
                : 'rgba(245,158,11,0.4)',
            }}
          />
        </div>
        <div className="flex items-center justify-between text-[10px]" style={{ color: 'var(--text-muted)' }}>
          <span>{achievement.progress}/{reqVal}</span>
          {achievement.unlocked && achievement.unlockedAt && (
            <span style={{ color: tierConfig.color }}>
              {new Date(achievement.unlockedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  )
}
