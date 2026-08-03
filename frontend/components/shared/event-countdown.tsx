'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'

// ─── Types ────────────────────────────────────────────────────────

interface EventCountdownProps {
  endDate: string  // ISO date string
  className?: string
}

interface TimeLeft {
  hours: number
  minutes: number
  seconds: number
  totalMs: number
}

// ─── Helpers ──────────────────────────────────────────────────────

function calculateTimeLeft(endDate: string): TimeLeft {
  const difference = +new Date(endDate) - +new Date()

  if (difference <= 0) {
    return { hours: 0, minutes: 0, seconds: 0, totalMs: 0 }
  }

  return {
    hours: Math.floor(difference / (1000 * 60 * 60)),
    minutes: Math.floor((difference / (1000 * 60)) % 60),
    seconds: Math.floor((difference / 1000) % 60),
    totalMs: difference,
  }
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

// ─── Component ────────────────────────────────────────────────────

export function EventCountdown({ endDate, className }: EventCountdownProps) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>(() => calculateTimeLeft(endDate))

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft(endDate))
    }, 1000)
    return () => clearInterval(timer)
  }, [endDate])

  const isEnded = timeLeft.totalMs <= 0

  if (isEnded) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 ${className || ''}`}
        style={{
          background: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
        }}
      >
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#EF4444' }}>
          Voting Closed
        </span>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className={`inline-flex items-center gap-2.5 rounded-full px-3 py-1.5 ${className || ''}`}
      style={{
        background: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(245, 158, 11, 0.25)',
      }}
    >
      {/* LIVE indicator with green pulse dot */}
      <span className="flex items-center gap-1.5">
        <span className="relative flex h-2 w-2">
          <motion.span
            animate={{ scale: [1, 1.8, 1], opacity: [0.7, 0, 0.7] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute inline-flex h-full w-full rounded-full"
            style={{ background: '#22C55E' }}
          />
          <span
            className="relative inline-flex rounded-full h-2 w-2"
            style={{ background: '#22C55E' }}
          />
        </span>
        <span
          className="text-[10px] font-bold uppercase tracking-wider"
          style={{ color: '#22C55E' }}
        >
          LIVE
        </span>
      </span>

      {/* Separator */}
      <span
        className="w-px h-3.5"
        style={{ background: 'rgba(245, 158, 11, 0.3)' }}
      />

      {/* Countdown timer */}
      <motion.span
        animate={{ opacity: [1, 0.7, 1] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        className="text-xs font-mono font-bold tabular-nums"
        style={{ color: '#F59E0B' }}
      >
        {pad(timeLeft.hours)}:{pad(timeLeft.minutes)}:{pad(timeLeft.seconds)}
      </motion.span>
    </motion.div>
  )
}
