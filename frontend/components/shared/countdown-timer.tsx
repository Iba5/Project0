'use client'

import { useEffect, useState, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'

// ─── Types ────────────────────────────────────────────────────────

interface CountdownTimerProps {
  endDate: string
  startDate?: string
  status?: string
  compact?: boolean
}

interface TimeLeft {
  days: number
  hours: number
  minutes: number
  seconds: number
  totalMs: number
}

type StatusLabel = 'Voting Open' | 'Registration Open' | 'Starting Soon' | 'Closing Soon' | 'Ending Today' | 'Ended'

// ─── Helpers ──────────────────────────────────────────────────────

function calculateTimeLeft(endDate: string): TimeLeft {
  const difference = +new Date(endDate) - +new Date()

  if (difference <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, totalMs: 0 }
  }

  return {
    days: Math.floor(difference / (1000 * 60 * 60 * 24)),
    hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((difference / 1000 / 60) % 60),
    seconds: Math.floor((difference / 1000) % 60),
    totalMs: difference,
  }
}

function getStatusLabel(timeLeft: TimeLeft, eventStatus?: string): StatusLabel {
  if (timeLeft.totalMs <= 0) return 'Ended'
  if (timeLeft.days === 0 && timeLeft.hours < 24) return 'Ending Today'
  if (timeLeft.days === 0) return 'Closing Soon'
  if (eventStatus === 'Registration Open') return 'Registration Open'
  if (eventStatus === 'Voting Open' || eventStatus === 'Upcoming') return 'Voting Open'
  return 'Starting Soon'
}

function getStatusColor(status: StatusLabel): string {
  switch (status) {
    case 'Voting Open':
    case 'Registration Open':
      return '#22C55E' // emerald
    case 'Closing Soon':
      return '#F59E0B' // amber
    case 'Ending Today':
    case 'Ended':
      return '#EF4444' // red
    case 'Starting Soon':
      return '#3B82F6' // blue
  }
}

function formatEndDate(endDate: string): string {
  try {
    const d = new Date(endDate)
    return d.toLocaleString(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return endDate
  }
}

// ─── Flip Digit Component ─────────────────────────────────────────

function FlipDigit({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <div
        className="relative overflow-hidden rounded-xl sm:rounded-2xl"
        style={{
          background: 'rgba(18, 24, 36, 0.8)',
          border: '1px solid rgba(245, 158, 11, 0.15)',
          minWidth: '56px',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
        }}
      >
        <AnimatePresence mode="popLayout">
          <motion.div
            key={value}
            initial={{ rotateX: -90, opacity: 0, scale: 0.9 }}
            animate={{ rotateX: 0, opacity: 1, scale: 1 }}
            exit={{ rotateX: 90, opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="px-3 py-2 sm:px-5 sm:py-3 text-center"
            style={{ perspective: '200px' }}
          >
            <div className="text-2xl sm:text-4xl font-bold text-gold-400 tabular-nums leading-none tracking-tight">
              {value}
            </div>
          </motion.div>
        </AnimatePresence>
        {/* Center divider line */}
        <div
          className="absolute left-0 right-0 top-1/2 h-px"
          style={{
            background: 'rgba(0, 0, 0, 0.3)',
            boxShadow: '0 1px 0 rgba(255, 255, 255, 0.05)',
          }}
        />
      </div>
      <div className="mt-1.5 sm:mt-2 text-[9px] sm:text-[10px] uppercase tracking-widest font-medium text-slate-400">
        {label}
      </div>
    </div>
  )
}

// ─── Animated Separator ───────────────────────────────────────────

function AnimatedSeparator() {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible((prev) => !prev)
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  return (
    <motion.span
      animate={{ opacity: visible ? 1 : 0.3 }}
      transition={{ duration: 0.5 }}
      className="text-2xl sm:text-3xl font-bold text-gold-500/50 self-start mt-2 sm:mt-3"
    >
      :
    </motion.span>
  )
}

// ─── Progress Ring ────────────────────────────────────────────────

function ProgressRing({
  progress,
  size = 48,
  strokeWidth = 3,
}: {
  progress: number
  size?: number
  strokeWidth?: number
}) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - progress * circumference

  return (
    <svg
      width={size}
      height={size}
      className="transform -rotate-90"
      style={{ filter: 'drop-shadow(0 0 4px rgba(245, 158, 11, 0.3))' }}
    >
      {/* Background ring */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="rgba(245, 158, 11, 0.1)"
        strokeWidth={strokeWidth}
      />
      {/* Progress ring */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="#F59E0B"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        style={{ transition: 'stroke-dashoffset 1s ease' }}
      />
    </svg>
  )
}

// ─── Main Countdown Timer ─────────────────────────────────────────

export function CountdownTimer({ endDate, startDate, status, compact }: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>(() => calculateTimeLeft(endDate))

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft(endDate))
    }, 1000)
    return () => clearInterval(timer)
  }, [endDate])

  const statusLabel = getStatusLabel(timeLeft, status)
  const statusColor = getStatusColor(statusLabel)
  const isUrgent = timeLeft.totalMs > 0 && timeLeft.totalMs < 24 * 60 * 60 * 1000

  // Calculate progress (0 = just started, 1 = ended)
  const progress = useMemo(() => {
    if (!startDate) return 0.5
    const total = +new Date(endDate) - +new Date(startDate)
    const elapsed = +new Date() - +new Date(startDate)
    if (total <= 0) return 1
    return Math.min(1, Math.max(0, elapsed / total))
  }, [startDate, endDate])

  const units = [
    { label: 'Days', value: String(timeLeft.days).padStart(2, '0') },
    { label: 'Hrs', value: String(timeLeft.hours).padStart(2, '0') },
    { label: 'Min', value: String(timeLeft.minutes).padStart(2, '0') },
    { label: 'Sec', value: String(timeLeft.seconds).padStart(2, '0') },
  ]

  // Compact mode for mobile
  const compactUnits = [
    { label: 'D', value: String(timeLeft.days) },
    { label: 'H', value: String(timeLeft.hours) },
    { label: 'M', value: String(timeLeft.minutes) },
    { label: 'S', value: String(timeLeft.seconds) },
  ]

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex flex-col items-center gap-4">
          {/* Status Label */}
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="flex items-center gap-2"
          >
            <span className="relative flex h-2 w-2">
              {isUrgent && (
                <motion.span
                  animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="absolute inline-flex h-full w-full rounded-full"
                  style={{ background: statusColor }}
                />
              )}
              <span
                className="relative inline-flex rounded-full h-2 w-2"
                style={{ background: statusColor }}
              />
            </span>
            <span
              className="text-xs font-semibold uppercase tracking-wider"
              style={{ color: statusColor }}
            >
              {statusLabel}
            </span>
          </motion.div>

          {/* Countdown + Progress Ring */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Progress Ring (desktop only) */}
            <div className="hidden sm:flex items-center mr-1">
              <ProgressRing progress={progress} size={48} strokeWidth={3} />
            </div>

            {/* Compact (mobile) */}
            <div className="flex sm:hidden items-center gap-1">
              {compactUnits.map((unit, index) => (
                <div key={unit.label} className="flex items-center gap-1">
                  <FlipDigit value={unit.value} label={unit.label} />
                  {index < compactUnits.length - 1 && <AnimatedSeparator />}
                </div>
              ))}
            </div>

            {/* Full (desktop) */}
            <div className="hidden sm:flex items-center gap-2">
              {units.map((unit, index) => (
                <div key={unit.label} className="flex items-center gap-2">
                  <FlipDigit value={unit.value} label={unit.label} />
                  {index < units.length - 1 && <AnimatedSeparator />}
                </div>
              ))}
            </div>
          </div>

          {/* Urgent pulse glow */}
          {isUrgent && (
            <motion.div
              animate={{
                boxShadow: [
                  '0 0 0px rgba(245, 158, 11, 0)',
                  '0 0 20px rgba(245, 158, 11, 0.15)',
                  '0 0 0px rgba(245, 158, 11, 0)',
                ],
              }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute inset-0 rounded-2xl pointer-events-none"
              style={{ border: '1px solid rgba(245, 158, 11, 0.1)' }}
            />
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent
        side="bottom"
        className="text-xs font-medium"
        style={{
          background: 'rgba(18, 24, 36, 0.95)',
          border: '1px solid rgba(245, 158, 11, 0.2)',
          color: '#F59E0B',
        }}
      >
        Ends: {formatEndDate(endDate)}
      </TooltipContent>
    </Tooltip>
  )
}
