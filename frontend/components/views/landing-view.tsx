'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence, useInView, type Variants } from 'framer-motion'
import {
  Users,
  Vote,
  Clock,
  ArrowRight,
  Play,
  Shield,
  Zap,
  Share2,
  Crown,
  Medal,
  Mail,
  Check,
  HelpCircle,
  Sparkles,
  Bell,
  Trophy,
  Calendar,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion'
import { useAppStore } from '@/lib/store'
import { useRouter } from 'next/navigation'
import {
  getPublicStats,
  getPublicLeaderboard,
  listPublicEvents,
  type PublicLeaderboardEntry,
  type PublicStats,
  type EventItem,
} from '@/lib/api'
import { ParticipantAvatar } from '@/components/shared/participant-avatar'
import { CountdownTimer } from '@/components/shared/countdown-timer'
import { toast } from 'sonner'
import { format, parseISO, isValid } from 'date-fns'
import { nameToGradient } from '@/lib/utils'
import {
  useRealtime,
  type VoteGlobalData,
  type VoteMilestoneData,
} from '@/hooks/use-realtime'
import { useNotifications } from '@/hooks/use-notifications'
import { useNotificationStore } from '@/lib/notification-store'

// ─── Animated Counter Component ────────────────────────────────────
// Uses useInView + requestAnimationFrame for smooth count-up animation when the
// stats section scrolls into view.

function AnimatedCounter({ value, duration = 1500 }: { value: number; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-50px' })
  const [display, setDisplay] = useState(0)
  const rafRef = useRef<number>(0)
  const startRef = useRef<number>(0)
  const startValRef = useRef(0)

  useEffect(() => {
    if (!isInView || value === 0) return
    startValRef.current = 0
    startRef.current = 0

    const animate = (timestamp: number) => {
      if (!startRef.current) startRef.current = timestamp
      const elapsed = timestamp - startRef.current
      const progress = Math.min(elapsed / duration, 1)
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(Math.round(startValRef.current + (value - startValRef.current) * eased))
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate)
      }
    }
    rafRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(rafRef.current)
  }, [isInView, value, duration])

  return (
    <span
      ref={ref}
      className="shimmer-text inline-block"
      style={{
        backgroundImage: 'linear-gradient(90deg, #F59E0B, #FBBF24, #FFFFFF, #FBBF24, #F59E0B)',
        backgroundSize: '200% auto',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
        animation: isInView ? 'shimmer-text 3s linear infinite' : 'none',
      }}
    >
      {display.toLocaleString()}
    </span>
  )
}

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.15, duration: 0.6, ease: 'easeOut' },
  }),
}

const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.12 },
  },
}

const staggerItem: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
}

interface FaqItem {
  question: string
  answer: string
}

// FAQ data — will be loaded from settings when available
const faqs: FaqItem[] = []

// CSS-only confetti particles for milestone celebrations.
// 18 pieces with deterministic positions/colors so the animation is
// smooth and avoids hydration mismatch from random values.
const CONFETTI_COLORS = [
  'var(--gold-400)',
  'var(--gold-500)',
  'var(--gold-600)',
  '#FCD34D',
  '#FBBF24',
  '#FFFFFF',
]
const CONFETTI_PIECES = Array.from({ length: 18 }, (_, i) => {
  const left = (i * 5.5 + 5) % 100
  const color = CONFETTI_COLORS[i % CONFETTI_COLORS.length]
  const delay = (i % 6) * 0.08
  const duration = 1.8 + (i % 5) * 0.18
  const rotate = (i * 47) % 360
  const drift = ((i % 7) - 3) * 30
  return { id: i, left, color, delay, duration, rotate, drift }
})

interface ConfettiBurst {
  id: number
  key: string
}

export default function LandingView() {
  const router = useRouter()
  const [stats, setStats] = useState({
    contestants: 0,
    votes: 0,
    daysRemaining: 0,
  })
  const [activeEvent, setActiveEvent] = useState<PublicStats['activeEvent']>(null)
  const [leaderboard, setLeaderboard] = useState<PublicLeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [subscribed, setSubscribed] = useState(false)
  const [hasMountedClient, setHasMountedClient] = useState(false)

  useEffect(() => {
    setHasMountedClient(true)
  }, [])

  // Parallax scroll state for hero section
  const [scrollY, setScrollY] = useState(0)
  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])
  // Phase 9 Feature B — Featured Events section
  const [featuredEvents, setFeaturedEvents] = useState<EventItem[]>([])

  // Phase 9 — realtime vote notifications + browser notifications
  const { onVoteGlobal, onVoteMilestone } = useRealtime()
  const {
    permission: notificationPermission,
    requestPermission: requestNotificationPermission,
    showMilestoneNotification,
    isSupported: notificationsSupported,
    isReady: notificationsReady,
  } = useNotifications()
  const addNotification = useNotificationStore((s) => s.addNotification)
  const [confettiBursts, setConfettiBursts] = useState<ConfettiBurst[]>([])
  const confettiIdRef = useRef(0)

  const triggerConfetti = useCallback(() => {
    const id = ++confettiIdRef.current
    const burst: ConfettiBurst = { id, key: `confetti-${id}-${Date.now()}` }
    setConfettiBursts((prev) => [...prev, burst])
    // Remove the burst after the animation finishes so we don't leak nodes.
    setTimeout(() => {
      setConfettiBursts((prev) => prev.filter((b) => b.id !== id))
    }, 3200)
  }, [])

  useEffect(() => {
    // vote:global — small celebratory toast on every vote + notification center
    const unsubscribeGlobal = onVoteGlobal((data: VoteGlobalData) => {
      toast.success(
        `🎉 ${data.participantName} just received ${data.votesDelta} vote${data.votesDelta === 1 ? '' : 's'}!`,
        {
          duration: 4000,
          position: 'bottom-right',
          icon: <Vote className="size-4" />,
        },
      )
      // Add to notification center
      addNotification({
        type: 'vote_received',
        title: 'Vote Received',
        message: `${data.participantName} just received ${data.votesDelta} vote${data.votesDelta === 1 ? '' : 's'}!`,
        link: `contestant-detail:${data.participantId}`,
      })
    })

    // vote:milestone — browser notification + gold toast + confetti burst + notification center
    const unsubscribeMilestone = onVoteMilestone(
      (data: VoteMilestoneData) => {
        showMilestoneNotification(
          data.participantName,
          data.totalVotes,
          data.milestone,
        )
        toast(
          `🏆 ${data.participantName} reached ${data.milestone.toLocaleString()} votes!`,
          {
            duration: 6000,
            position: 'bottom-right',
            icon: <Trophy className="size-4" />,
            // Gold gradient background, white text — milestone styling spec.
            className: 'milestone-toast',
            style: {
              background:
                'linear-gradient(135deg, var(--gold-500), var(--gold-600))',
              color: '#FFFFFF',
              border: '1px solid var(--gold-400)',
              fontWeight: 600,
            },
          },
        )
        triggerConfetti()
        // Add to notification center
        addNotification({
          type: 'milestone_reached',
          title: 'Milestone Reached!',
          message: `${data.participantName} reached ${data.milestone.toLocaleString()} votes!`,
          link: `contestant-detail:${data.participantId}`,
        })
      },
    )

    return () => {
      unsubscribeGlobal()
      unsubscribeMilestone()
    }
  }, [onVoteGlobal, onVoteMilestone, showMilestoneNotification, triggerConfetti, addNotification])

  useEffect(() => {
    let cancelled = false
    async function loadData() {
      try {
        const [statsData, leaderboardData] = await Promise.all([
          getPublicStats(),
          getPublicLeaderboard(),
        ])
        if (cancelled) return
        setStats({
          contestants: statsData.totalParticipants,
          votes: statsData.totalVotes,
          daysRemaining: statsData.daysRemaining,
        })
        setActiveEvent(statsData.activeEvent)
        setLeaderboard(leaderboardData.leaderboard.slice(0, 3))
      } catch (err) {
        console.error('[LandingView] loadData error:', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadData()
    return () => { cancelled = true }
  }, [])

  // Phase 9 Feature B — fetch active/upcoming events for the Featured
  // Events strip. Failures are non-fatal (we just hide the section).
  useEffect(() => {
    let cancelled = false
    listPublicEvents()
      .then(({ events }) => {
        if (cancelled) return
        const visible = (events || [])
          .filter((e) => {
            const s = (e.status || '').toLowerCase().replace(/\s+/g, '')
            return (
              s !== 'draft' &&
              s !== 'completed' &&
              s !== 'archived' &&
              s !== 'votingclosed'
            )
          })
          .slice(0, 3)
        setFeaturedEvents(visible)
      })
      .catch(() => {
        // Silent — section is hidden when no events are loaded.
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Format a start/end date range using date-fns. Defensive against
  // invalid strings (returns "Dates TBA").
  const formatEventRange = (startISO: string, endISO: string): string => {
    const start = startISO ? parseISO(startISO) : null
    const end = endISO ? parseISO(endISO) : null
    const startValid = start && isValid(start)
    const endValid = end && isValid(end)
    if (!startValid && !endValid) return 'Dates TBA'
    if (startValid && endValid) {
      if (start.getFullYear() === end.getFullYear()) {
        return `${format(start, 'MMM d')} → ${format(end, 'MMM d, yyyy')}`
      }
      return `${format(start, 'MMM d, yyyy')} → ${format(end, 'MMM d, yyyy')}`
    }
    const d = startValid ? start : end
    return d ? format(d, 'MMM d, yyyy') : 'Dates TBA'
  }

  const handleShareEvent = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      toast.success('Link copied to clipboard!')
    }).catch(() => {
      toast.error('Failed to copy link')
    })
  }

  const handleContestantClick = (id: string) => {
    router.push(`/contestants/${id}`)
  }

  const handleNewsletterSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !email.includes('@')) {
      toast.error('Please enter a valid email address')
      return
    }
    setSubscribed(true)
    toast.success('You\u2019re subscribed! Watch your inbox for reminders.')
    setEmail('')
    setTimeout(() => setSubscribed(false), 4000)
  }

  // Floating "Enable Notifications" button — only rendered while the
  // permission is still 'default' (prompt not yet shown). Once the user
  // grants or denies we hide it to keep the UI clean.
  const showEnableNotificationsButton =
    hasMountedClient && notificationsReady && notificationsSupported && notificationPermission === 'default'

  const handleEnableNotifications = useCallback(async () => {
    const result = await requestNotificationPermission()
    if (result === 'granted') {
      toast.success('Notifications enabled — you\'ll get milestone alerts!', {
        icon: <Bell className="size-4" />,
      })
    } else if (result === 'denied') {
      toast.info('No problem — we\'ll show in-app toasts instead.', {
        icon: <Bell className="size-4" />,
      })
    }
  }, [requestNotificationPermission])

  return (
    <div className="min-h-screen bg-background overflow-hidden">
      {/* Floating "Enable Notifications" button — top-right, glass-premium,
          gold accent, hover-lift, rounded-full, Bell icon. Visible only while
          the browser permission is still 'default'. */}
      <AnimatePresence>
        {showEnableNotificationsButton && (
          <motion.button
            key="enable-notifications"
            onClick={handleEnableNotifications}
            initial={{ opacity: 0, scale: 0.8, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: -10 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="glass-premium hover-lift fixed top-4 right-4 z-50 flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium focus-ring-gold"
            style={{
              color: 'var(--text-primary)',
              borderColor: 'rgba(245, 158, 11, 0.4)',
            }}
            aria-label="Enable browser notifications"
          >
            <Bell className="size-4" style={{ color: 'var(--gold-500)' }} />
            <span>Enable Notifications</span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Confetti overlay — pure CSS pieces animated via Framer Motion. */}
      <AnimatePresence>
        {confettiBursts.map((burst) => (
          <div
            key={burst.key}
            className="pointer-events-none fixed inset-0 z-[60] overflow-hidden"
            aria-hidden="true"
          >
            {CONFETTI_PIECES.map((p) => (
              <motion.div
                key={`${burst.key}-${p.id}`}
                className="absolute top-1/4 rounded-sm"
                style={{
                  left: `${p.left}%`,
                  width: 8,
                  height: 12,
                  background: p.color,
                  boxShadow: '0 0 6px rgba(245,158,11,0.4)',
                }}
                initial={{ y: -20, opacity: 0, rotate: p.rotate }}
                animate={{
                  y: [-20, 600],
                  opacity: [0, 1, 1, 0],
                  x: [0, p.drift, p.drift * 2, p.drift],
                  rotate: [p.rotate, p.rotate + 180, p.rotate + 360],
                }}
                transition={{
                  duration: p.duration,
                  delay: p.delay,
                  ease: 'easeIn',
                }}
              />
            ))}
          </div>
        ))}
      </AnimatePresence>

      {/* ─── Hero Section ─── */}
      <section className="relative min-h-[85vh] flex items-center justify-center px-4 pt-12 pb-20 hero-gradient overflow-hidden">
        {/* Subtle grid overlay for depth */}
        <div className="absolute inset-0 bg-grid opacity-60 pointer-events-none" />

        {/* Parallax floating particles/shapes */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
          {/* Diamond shapes */}
          <div className="absolute top-[15%] left-[8%] w-3 h-3 rotate-45 parallax-float-fast" style={{ background: 'rgba(245,158,11,0.3)', transform: `translateY(${scrollY * 0.2}px)` }} />
          <div className="absolute top-[25%] right-[12%] w-2 h-2 rotate-45 parallax-float" style={{ background: 'rgba(251,191,36,0.25)', transform: `translateY(${scrollY * 0.15}px)` }} />
          <div className="absolute bottom-[30%] left-[20%] w-2.5 h-2.5 rotate-45 parallax-float-slow" style={{ background: 'rgba(217,119,6,0.2)', transform: `translateY(${scrollY * 0.1}px)` }} />
          {/* Circle shapes */}
          <div className="absolute top-[40%] right-[25%] w-2 h-2 rounded-full parallax-float" style={{ background: 'rgba(245,158,11,0.35)', transform: `translateY(${scrollY * 0.18}px)` }} />
          <div className="absolute top-[60%] left-[15%] w-1.5 h-1.5 rounded-full parallax-float-fast" style={{ background: 'rgba(251,191,36,0.3)', transform: `translateY(${scrollY * 0.22}px)` }} />
          <div className="absolute top-[20%] left-[45%] w-2 h-2 rounded-full parallax-float-slow" style={{ background: 'rgba(245,158,11,0.2)', transform: `translateY(${scrollY * 0.12}px)` }} />
          {/* Small cross/plus shapes */}
          <div className="absolute top-[70%] right-[8%] w-4 h-4 parallax-float" style={{ transform: `translateY(${scrollY * 0.16}px)` }}>
            <div className="absolute top-1/2 left-0 w-full h-0.5 bg-gold-500/25 -translate-y-1/2" />
            <div className="absolute left-1/2 top-0 h-full w-0.5 bg-gold-500/25 -translate-x-1/2" />
          </div>
          <div className="absolute top-[10%] right-[35%] w-3 h-3 parallax-float-slow" style={{ transform: `translateY(${scrollY * 0.14}px)` }}>
            <div className="absolute top-1/2 left-0 w-full h-0.5 bg-amber-400/20 -translate-y-1/2" />
            <div className="absolute left-1/2 top-0 h-full w-0.5 bg-amber-400/20 -translate-x-1/2" />
          </div>
        </div>

        {/* Animated gradient orb behind hero text */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full gradient-orb-pulse pointer-events-none"
          style={{
            background: 'radial-gradient(circle, rgba(245,158,11,0.12) 0%, rgba(217,119,6,0.06) 40%, transparent 70%)',
            filter: 'blur(60px)',
          }}
        />

        {/* Bokeh Background Effects — with parallax offset */}
        <div className="bokeh w-72 h-72 bg-gold-500 top-10 left-10" style={{ transform: `translateY(${scrollY * 0.15}px)` }} />
        <div className="bokeh w-96 h-96 bg-gold-600 bottom-20 right-10" style={{ transform: `translateY(${scrollY * 0.1}px)` }} />
        <div className="bokeh w-48 h-48 bg-amber-400 top-1/2 left-1/3" style={{ transform: `translateY(${scrollY * 0.2}px)` }} />
        <div className="bokeh w-64 h-64 bg-gold-500/50 top-1/3 right-1/4" style={{ transform: `translateY(${scrollY * 0.12}px)` }} />

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-background via-transparent to-background pointer-events-none" />

        <div className="relative z-10 max-w-4xl mx-auto text-center gentle-float" style={{ transform: `translateY(${scrollY * 0.08}px)` }}>
          {/* Live Status Badge — with pulsing glow */}
          <motion.div
            custom={0}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            className="inline-flex items-center gap-2 mb-8"
          >
            <span className="glass rounded-full px-4 py-2 flex items-center gap-2 text-sm warm-badge-pulse">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping-slow absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
              </span>
              <span className="text-green-400 font-medium">Voting Open</span>
            </span>
          </motion.div>

          {/* Headline — warm, personal, human */}
          <motion.h1
            custom={1}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            className="text-4xl sm:text-5xl md:text-7xl font-bold tracking-tight mb-6 hero-text-glow"
          >
            Discover Talent.{' '}
            <span className="shimmer-text">Support Your Favourites.</span>
          </motion.h1>

          {/* Subtitle — conversational, like a real person talking */}
          <motion.p
            custom={2}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10"
          >
            Real performers. Real votes. Your $1 helps someone&apos;s dream take off.
            Find the talent that moves you and back them all the way.
          </motion.p>

          {/* CTA Buttons — with animated gradient border */}
          <motion.div
            custom={3}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <div className="relative group animated-gradient-border rounded-full">
              <div className="absolute -inset-0.5 rounded-full bg-gradient-to-r from-gold-500 via-gold-300 to-gold-500 opacity-60 group-hover:opacity-100 transition-opacity duration-500 gradient-shift blur-sm" />
              <Button
                onClick={() => router.push('/contestants')}
                className="relative bg-gold-500 hover:bg-gold-600 text-[#0B0F17] font-semibold rounded-full px-8 h-12 text-base pulse-glow cta-shimmer cta-float subscribe-press"
              >
                Meet the Performers
                <ArrowRight className="size-4 ml-1" />
              </Button>
            </div>
            <Button
              onClick={() => router.push('/leaderboard')}
              variant="outline"
              className="rounded-full px-8 h-12 text-base bg-gold-500/5 border-gold-500/50 text-gold-300 hover:bg-gold-500/15 hover:text-gold-200 hover:border-gold-500/70 backdrop-blur-sm"
            >
              <Crown className="size-4 mr-1" />
              See Leaderboard
            </Button>
            <Button
              onClick={handleShareEvent}
              variant="outline"
              className="rounded-full px-8 h-12 text-base bg-gold-500/5 border-gold-500/50 text-gold-300 hover:bg-gold-500/15 hover:text-gold-200 hover:border-gold-500/70 backdrop-blur-sm gap-2"
            >
              <Share2 className="size-4" />
              Share Event
            </Button>
          </motion.div>
        </div>
      </section>

      {/* ─── Countdown Timer ─── */}
      {activeEvent && (
        <section className="relative px-4 py-16">
          <div className="bokeh w-72 h-72 bg-gold-500 top-0 left-1/4" />
          <div className="bokeh w-96 h-96 bg-amber-400 bottom-0 right-1/4" />
          <div className="relative max-w-4xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="inline-flex items-center gap-2 mb-4"
            >
              <span className="glass rounded-full px-3 py-1.5 flex items-center gap-2 text-xs">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping-slow absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                </span>
                <span className="text-green-400 font-medium">Voting Open</span>
              </span>
            </motion.div>

            <motion.h2
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.05 }}
              className="text-xl sm:text-2xl font-bold mb-6"
            >
              Time <span className="gold-text">Left</span> to Vote
            </motion.h2>

            <CountdownTimer endDate={activeEvent.endDate} status={activeEvent.status} />
          </div>
        </section>
      )}

      {/* ─── Stats Section ─── */}
      <section className="px-4 py-20">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-10"
          >
            <h2 className="text-2xl sm:text-3xl font-bold mb-3">
              The <span className="gold-text">Numbers</span> So Far
            </h2>
            <p className="text-muted-foreground">Here&apos;s how the competition is shaping up</p>
          </motion.div>

          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-50px' }}
            className="grid grid-cols-3 gap-4 sm:gap-6"
          >
            {[
              {
                icon: <Users className="size-5 text-gold-500" />,
                label: '🎤 Performers',
                numericValue: stats.contestants,
              },
              {
                icon: <Vote className="size-5 text-gold-500" />,
                label: '✨ Votes',
                numericValue: stats.votes,
              },
              {
                icon: <Clock className="size-5 text-gold-500" />,
                label: '⏳ Days Left',
                numericValue: stats.daysRemaining,
              },
            ].map((stat) => (
              <motion.div
                key={stat.label}
                variants={staggerItem}
                whileHover={{ y: -6, scale: 1.02, transition: { duration: 0.25 } }}
                className="gradient-border-card rounded-2xl cursor-default card-hover-lift breathing-glow card-entrance-glow relative"
              >
                {/* Pulsing glow behind the card */}
                <div
                  className="absolute inset-0 rounded-2xl pulse-glow opacity-30 pointer-events-none"
                  style={{
                    background: 'radial-gradient(circle at center, rgba(245,158,11,0.15), transparent 70%)',
                  }}
                />
                <div
                  className="relative rounded-2xl p-4 sm:p-6 text-center"
                  style={{
                    background: 'rgba(18, 24, 36, 0.6)',
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                    border: '1px solid rgba(245, 158, 11, 0.15)',
                  }}
                >
                  <div className="flex justify-center mb-2">
                    <div className="w-10 h-10 rounded-full bg-gold-500/10 flex items-center justify-center">
                      {stat.icon}
                    </div>
                  </div>
                  <div className="text-2xl sm:text-3xl font-bold mb-1">
                    {loading ? (
                      <span className="text-gold-400">&mdash;</span>
                    ) : (
                      <AnimatedCounter value={stat.numericValue} />
                    )}
                  </div>
                  <div className="text-xs sm:text-sm text-muted-foreground">{stat.label}</div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ─── Featured Contestants - Top Performers ─── */}
      <section className="relative px-4 py-20">
        <div className="bokeh w-72 h-72 bg-gold-500 top-10 left-10" />
        <div className="bokeh w-96 h-96 bg-gold-600 bottom-20 right-10" />
        <div className="relative max-w-4xl mx-auto border-glow rounded-3xl p-6 sm:p-8" style={{ borderColor: 'rgba(245, 158, 11, 0.25)' }}>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-2xl sm:text-3xl font-bold mb-3">
              Top <span className="gold-text">Performers</span>
            </h2>
            <p className="text-muted-foreground">The ones everyone&apos;s rooting for right now</p>
          </motion.div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="dark-card rounded-2xl p-6 h-64 animate-pulse" />
              ))}
            </div>
          ) : leaderboard.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>No performers yet. Check back soon!</p>
            </div>
          ) : (
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-50px' }}
              className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch"
            >
              {leaderboard.map((entry, index) => {
                const isFirst = index === 0
                const isSecond = index === 1

                const borderGradient = isFirst
                  ? 'linear-gradient(135deg, #F59E0B, #D97706, #F59E0B)'
                  : isSecond
                  ? 'linear-gradient(135deg, #9CA3AF, #6B7280, #9CA3AF)'
                  : 'linear-gradient(135deg, #D97706, #92400E, #D97706)'

                const rankBadgeBg = isFirst
                  ? 'linear-gradient(135deg, #F59E0B, #D97706)'
                  : isSecond
                  ? 'linear-gradient(135deg, #9CA3AF, #6B7280)'
                  : 'linear-gradient(135deg, #D97706, #92400E)'

                const rankLabel = isFirst
                  ? '1st Place'
                  : isSecond
                  ? '2nd Place'
                  : '3rd Place'

                return (
                  <motion.div
                    key={entry.id}
                    variants={staggerItem}
                    whileHover={{ y: -4, transition: { duration: 0.2 } }}
                    onClick={() => handleContestantClick(entry.id)}
                    className="cursor-pointer group relative interactive-card-glow"
                  >
                    <div
                      className="absolute -inset-px rounded-2xl opacity-40 group-hover:opacity-80 transition-opacity"
                      style={{ background: borderGradient }}
                    />
                    <div
                      className={`relative dark-card rounded-2xl p-6 text-center flex flex-col card-shine ${
                        isFirst ? 'md:scale-105 gold-glow-strong' : ''
                      }`}
                      style={isFirst ? { boxShadow: '0 0 24px rgba(245,158,11,0.15)' } : undefined}
                    >
                      {/* Rank badge */}
                      <div className="flex justify-center mb-3">
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center rank-badge-shine"
                          style={{ background: rankBadgeBg }}
                        >
                          {isFirst ? (
                            <Crown className="size-5 text-[#0B0F17]" />
                          ) : (
                            <Medal className="size-5 text-white" />
                          )}
                        </div>
                      </div>

                      {isFirst && (
                        <Badge className="bg-gold-500/20 text-gold-400 border-gold-500/30 text-[10px] mb-2 self-center">
                          Leading
                        </Badge>
                      )}

                      {/* Avatar */}
                      <div className="mx-auto mb-3 performer-avatar-hover">
                        <ParticipantAvatar
                          name={entry.name}
                          imageUrl={entry.imageUrl}
                          thumbnailUrl={entry.thumbnailUrl}
                          size={isFirst ? 'lg' : 'md'}
                          className="rounded-full"
                        />
                      </div>

                      {/* Name */}
                      <div className="text-sm font-semibold truncate mb-1">{entry.name}</div>
                      <div className="text-[10px] text-muted-foreground mb-3">{rankLabel}</div>

                      {/* Badges */}
                      <div className="flex flex-wrap items-center justify-center gap-1.5 mb-3">
                        <Badge
                          variant="outline"
                          className="text-[10px] border-border text-muted-foreground"
                        >
                          {entry.category}
                        </Badge>

                      </div>

                      {/* Vote count */}
                      <div className="text-gold-400 font-bold text-xl mb-3">
                        {entry.votes.toLocaleString()}
                      </div>
                      <div className="text-[10px] text-muted-foreground mb-4">votes</div>

                      {/* View Profile button */}
                      <Button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleContestantClick(entry.id)
                        }}
                        className="bg-gold-500 hover:bg-gold-600 text-[#0B0F17] font-semibold rounded-full px-4 h-9 text-xs w-full mt-auto subscribe-press"
                      >
                        View Profile
                        <ArrowRight className="size-3.5 ml-1" />
                      </Button>
                    </div>
                  </motion.div>
                )
              })}
            </motion.div>
          )}
        </div>
      </section>

      {/* ─── How It Works ─── */}
      <section className="px-4 py-20">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mb-14"
          >
            <h2 className="text-2xl sm:text-3xl font-bold mb-3">How It Works</h2>
            <p className="text-muted-foreground">Three quick steps — that&apos;s all it takes</p>
          </motion.div>

          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-50px' }}
            className="grid grid-cols-1 md:grid-cols-3 gap-6 relative"
          >
            {/* Connecting line between steps — enhanced animated gradient flow */}
            <div className="hidden md:block absolute top-1/2 left-[16%] right-[16%] -translate-y-1/2 pointer-events-none step-connector-enhanced rounded-full" />

            {/* Animated connector dots */}
            <div className="hidden md:flex absolute top-1/2 -translate-y-1/2 left-[33%] -translate-x-1/2 pointer-events-none z-20">
              <div className="w-3 h-3 rounded-full bg-gold-500/50 pulse-gold" />
            </div>
            <div className="hidden md:flex absolute top-1/2 -translate-y-1/2 left-[66%] -translate-x-1/2 pointer-events-none z-20">
              <div className="w-3 h-3 rounded-full bg-gold-500/50 pulse-gold" />
            </div>

            {[
              {
                step: '01',
                icon: <Play className="size-6 text-gold-500" />,
                title: 'Find Your Favourite',
                description:
                  'Browse performers, watch their clips, and pick the one who speaks to you.',
              },
              {
                step: '02',
                icon: <Shield className="size-6 text-gold-500" />,
                title: 'Chip In $1',
                description:
                  'A single dollar unlocks your vote. Quick, easy, and every bit helps.',
              },
              {
                step: '03',
                icon: <Zap className="size-6 text-gold-500" />,
                title: 'Cast Your Vote',
                description:
                  'Vote as many times as you want. Help your favourite climb to the top!',
              },
            ].map((item, i) => (
              <motion.div
                key={item.step}
                variants={staggerItem}
                custom={i}
                whileHover={{ y: -6, transition: { duration: 0.25 } }}
                className="glass rounded-2xl p-6 text-center group step-card-hover card-shine relative z-10"
              >
                <div className="text-gold-500/30 text-5xl font-bold mb-4">{item.step}</div>
                <div className="w-14 h-14 rounded-full bg-gold-500/10 flex items-center justify-center mx-auto mb-4 group-hover:bg-gold-500/20 group-hover:scale-110 transition-all duration-300">
                  {item.icon}
                </div>
                <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ─── Featured Events ─── */}
      {featuredEvents.length > 0 && (
        <section className="relative px-4 py-20">
          <div className="bokeh w-72 h-72 bg-gold-500 top-0 left-1/4" />
          <div className="bokeh w-96 h-96 bg-amber-400 bottom-0 right-1/4" />
          <div className="relative max-w-4xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-12"
            >
              <div className="inline-flex items-center gap-2 glass rounded-full px-3 py-1.5 mb-4">
                <Calendar className="size-3.5 text-gold-400" />
                <span className="text-xs uppercase tracking-wider text-gold-300 font-semibold">
                  Don&apos;t Miss Out
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold mb-3">
                Featured <span className="gold-text">Events</span>
              </h2>
              <p className="text-muted-foreground">
                Jump into an active competition or get ready for an upcoming season
              </p>
            </motion.div>

            <motion.div
              variants={staggerContainer}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-50px' }}
              className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6"
            >
              {featuredEvents.map((event) => (
                <motion.div
                  key={event.id}
                  variants={staggerItem}
                  whileHover={{ y: -4, transition: { duration: 0.2 } }}
                  onClick={() => router.push('/events')}
                  className="hover-lift dark-card rounded-2xl overflow-hidden cursor-pointer group flex flex-col interactive-card-glow"
                >
                  {/* Banner (16:9) with gradient overlay */}
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
                        className="w-full h-full flex items-center justify-center"
                        style={{ background: nameToGradient(event.name) }}
                      >
                        <span className="text-xl font-bold text-white/90 drop-shadow-md text-center px-4 line-clamp-2">
                          {event.name}
                        </span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-background/30 to-transparent pointer-events-none" />
                  </div>

                  {/* Body */}
                  <div className="p-4 md:p-5 flex flex-col gap-2 flex-1">
                    <h3
                      className="text-base md:text-lg font-bold leading-tight line-clamp-1"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {event.name}
                    </h3>
                    {event.description && (
                      <p
                        className="text-xs leading-relaxed line-clamp-2"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        {event.description}
                      </p>
                    )}
                    <div
                      className="flex items-center gap-1.5 text-xs mt-1"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      <Calendar className="size-3.5 shrink-0" />
                      <span>{formatEventRange(event.startDate, event.endDate)}</span>
                    </div>
                    <div className="mt-auto pt-2">
                      <Button
                        onClick={(e) => {
                          e.stopPropagation()
                          router.push('/events')
                        }}
                        className="w-full rounded-full text-xs font-semibold transition-all duration-300"
                        style={{
                          background: 'rgba(245, 158, 11, 0.12)',
                          color: '#F59E0B',
                          border: '1px solid rgba(245, 158, 11, 0.3)',
                        }}
                        variant="ghost"
                      >
                        Learn More
                        <ArrowRight className="size-3.5 ml-1.5" />
                      </Button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>

            <div className="text-center mt-8">
              <Button
                onClick={() => router.push('/events')}
                variant="outline"
                className="rounded-full px-6 h-11 text-sm border-gold-500/30 text-gold-400 hover:bg-gold-500/10 hover:text-gold-300 transition-all duration-300 gap-1.5"
              >
                <Calendar className="size-4" />
                Browse All Events
                <ArrowRight className="size-4 ml-1" />
              </Button>
            </div>
          </div>
        </section>
      )}

      {/* ─── FAQ Section ─── */}
      <section className="px-4 py-20">
        <div className="max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-10"
          >
            <div className="inline-flex items-center gap-2 glass rounded-full px-3 py-1.5 mb-4">
              <HelpCircle className="size-3.5 text-gold-400" />
              <span className="text-xs uppercase tracking-wider text-gold-300 font-semibold">
                Got Questions?
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold mb-3">
              Frequently Asked <span className="gold-text">Questions</span>
            </h2>
            <p className="text-muted-foreground">Everything you need to know before you vote</p>
          </motion.div>

          {faqs.length > 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.5 }}
              className="glass rounded-2xl p-4 sm:p-6 interactive-card-glow"
            >
              <Accordion type="single" collapsible defaultValue="faq-0" className="[&_[data-state=open]>svg]:rotate-180">
                {faqs.map((faq, i) => (
                  <AccordionItem key={faq.question} value={`faq-${i}`} className="border-b border-border/40 last:border-b-0">
                    <AccordionTrigger className="text-left text-sm sm:text-base font-semibold hover:text-gold-300 hover:no-underline transition-colors duration-200 py-4 [&>svg]:transition-transform [&>svg]:duration-300 interactive-hover rounded-lg px-2 -mx-2">
                      {faq.question}
                    </AccordionTrigger>
                    <AccordionContent className="text-sm text-muted-foreground leading-relaxed overflow-hidden faq-accordion-content">
                      {faq.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="glass rounded-2xl p-8 sm:p-12 text-center"
            >
              <HelpCircle className="size-10 text-gold-400 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                FAQs coming soon
              </h3>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                Frequently asked questions will be available here once configured by the admin.
              </p>
            </motion.div>
          )}
        </div>
      </section>

      {/* ─── Newsletter Signup ─── */}
      <section className="relative px-4 py-20">
        <div className="bokeh w-72 h-72 bg-gold-500 top-0 left-1/4" />
        <div className="bokeh w-96 h-96 bg-amber-400 bottom-0 right-1/4" />
        <div className="relative max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="newsletter-gradient-bg glass-strong rounded-3xl p-8 sm:p-10 text-center"
          >
            <div className="inline-flex items-center gap-2 glass rounded-full px-3 py-1.5 mb-5">
              <Sparkles className="size-3.5 text-gold-400" />
              <span className="text-xs uppercase tracking-wider text-gold-300 font-semibold">
                Stay in the loop
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold mb-3">
              Don&apos;t Miss a <span className="gold-text">Thing</span>
            </h2>
            <p className="text-muted-foreground mb-6 max-w-xl mx-auto text-sm sm:text-base">
              Drop your email and we&apos;ll keep you posted on new events, voting deadlines, and
              behind-the-scenes updates. No spam, promise.
            </p>
            <form
              onSubmit={handleNewsletterSubmit}
              className="flex flex-col sm:flex-row items-center gap-3 max-w-md mx-auto"
            >
              <div className="relative flex-1 w-full">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 bg-surface border-border rounded-full text-sm placeholder:text-muted-foreground h-11"
                  aria-label="Email address"
                />
              </div>
              <Button
                type="submit"
                disabled={subscribed}
                className="bg-gold-500 hover:bg-gold-600 text-[#0B0F17] font-semibold rounded-full px-6 h-11 gold-glow-sm subscribe-press gap-2 w-full sm:w-auto"
              >
                {subscribed ? (
                  <>
                    <Check className="size-4" />
                    You&apos;re In!
                  </>
                ) : (
                  <>
                    Subscribe
                    <ArrowRight className="size-4" />
                  </>
                )}
              </Button>
            </form>
            <p className="text-[11px] text-muted-foreground/60 mt-4">
              We respect your privacy. Unsubscribe anytime.
            </p>
          </motion.div>
        </div>
      </section>

      {/* ─── Bottom CTA ─── */}
      <section className="px-4 py-20 pb-28">
        <div className="max-w-2xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-2xl sm:text-3xl font-bold mb-4">
              Ready to <span className="gold-text">Make It Count</span>?
            </h2>
            <p className="text-muted-foreground mb-8">
              Your vote could be the one that tips the scales. Come meet the performers and back your favourite.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button
                onClick={() => router.push('/contestants')}
                className="bg-gold-500 hover:bg-gold-600 text-[#0B0F17] font-semibold rounded-full px-10 h-12 text-base gold-glow-sm cta-shimmer cta-float subscribe-press"
              >
                Meet the Performers
                <ArrowRight className="size-4 ml-1" />
              </Button>
              <Button
                onClick={handleShareEvent}
                variant="outline"
                className="rounded-full px-8 h-12 text-base border-gold-500/30 text-gold-400 hover:bg-gold-500/10 hover:text-gold-300 gap-2"
              >
                <Share2 className="size-4" />
                Share Event
              </Button>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  )
}
