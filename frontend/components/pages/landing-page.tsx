'use client'

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { motion, type Variants } from 'framer-motion'
import { Play, Lock, ThumbsUp, ChevronRight, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { getPublicParticipants, type ParticipantApi } from '@/lib/api'

const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay: i * 0.1, ease: 'easeOut' as const },
  }),
}

const stagger: Variants = {
  visible: {
    transition: { staggerChildren: 0.1 },
  },
}

export function LandingPage() {
  const [participants, setParticipants] = useState<ParticipantApi[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
  let cancelled = false

  const fetchData = async () => {
      try {
        const result = await getPublicParticipants()

        if (!cancelled) {
          setParticipants(result.items)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    fetchData()

    return () => {
      cancelled = true
    }
  }, [])

  const stats = useMemo(() => {
  const approved = participants.filter(
    (p) => p.status === 'Approved'
  )

  const totalVotes = approved.reduce(
    (sum, p) => sum + p.votes,
    0
  )

  return {
      contestants: approved.length,
      totalVotes,
      daysLeft: 18,
    }
  }, [participants])

  return (
    <div>
      {/* Hero Section */}
      <section className="relative flex min-h-[70vh] items-center overflow-hidden md:min-h-[80vh]">
        {/* Dark gradient placeholder for hero image */}
        <div className="absolute inset-0 bg-foreground" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />

        <div className="relative z-10 mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 md:py-28">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={stagger}
            className="max-w-2xl"
          >
            {/* Live status badge */}
            <motion.div variants={fadeInUp} custom={0} className="mb-6">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-sm text-white backdrop-blur-sm">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#22C55E] opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-[#22C55E]" />
                </span>
                Voting Open — Closes in {stats.daysLeft} day
                {stats.daysLeft !== 1 ? 's' : ''}
              </span>
            </motion.div>

            {/* Headline */}
            <motion.h1
              variants={fadeInUp}
              custom={1}
              className="text-4xl font-extrabold leading-tight tracking-tight text-white md:text-6xl"
            >
              Your Vote Shapes
              <br />
              the Stage
            </motion.h1>

            {/* Subheadline */}
            <motion.p
              variants={fadeInUp}
              custom={2}
              className="mt-4 max-w-lg text-base leading-relaxed text-white/70 md:text-lg"
            >
              Watch the most talented performers across Southern Africa compete for the crown — and your vote decides who takes it home.
            </motion.p>

            {/* CTAs */}
            <motion.div
              variants={fadeInUp}
              custom={3}
              className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center"
            >
              <Link href="/contestants">
                <Button
                  size="lg"
                  className="h-11 w-full rounded-full bg-white px-6 text-sm font-semibold text-black hover:bg-white/90 sm:w-auto"
                >
                  Vote Now
                  <ChevronRight className="size-4" />
                </Button>
              </Link>
              <Link href="/leaderboard">
                <Button
                  variant="outline"
                  size="lg"
                  className="h-11 w-full rounded-full border-white/30 bg-transparent px-6 text-sm font-semibold text-white hover:bg-white/10 hover:text-white sm:w-auto"
                >
                  View Leaderboard
                </Button>
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="border-y border-border bg-muted/30">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-60px' }}
          variants={stagger}
          className="mx-auto grid max-w-6xl grid-cols-3 gap-4 px-4 py-10 sm:px-6 md:py-14"
        >
          {loading ? (
            <div className="col-span-3 flex items-center justify-center py-4">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            [
              { value: stats.contestants, label: 'Contestants' },
              { value: stats.totalVotes.toLocaleString(), label: 'Votes Cast' },
              { value: stats.daysLeft, label: 'Days Remaining' },
            ].map((stat, i) => (
              <motion.div
                key={stat.label}
                variants={fadeInUp}
                custom={i}
                className="text-center"
              >
                <p className="text-2xl font-extrabold tracking-tight text-foreground md:text-3xl">
                  {stat.value}
                </p>
                <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
                  {stat.label}
                </p>
              </motion.div>
            ))
          )}
        </motion.div>
      </section>

      {/* How It Works */}
      <section className="py-16 md:py-20">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-60px' }}
          variants={stagger}
          className="mx-auto max-w-6xl px-4 sm:px-6"
        >
          <motion.h2
            variants={fadeInUp}
            custom={0}
            className="text-center text-2xl font-bold tracking-tight md:text-3xl"
          >
            How It Works
          </motion.h2>
          <motion.p
            variants={fadeInUp}
            custom={1}
            className="mx-auto mt-2 max-w-md text-center text-sm text-muted-foreground leading-relaxed"
          >
            Watch performances on social media, then come here to support your favourites
          </motion.p>

          <div className="mt-10 grid gap-8 sm:grid-cols-3 md:gap-12">
            {[
              {
                icon: Play,
                step: '01',
                title: 'Watch on Social Media',
                description:
                  'Find contestant performances posted on TikTok, YouTube, Instagram, and Facebook.',
              },
              {
                icon: Lock,
                step: '02',
                title: 'Unlock Voting',
                description:
                  'Pay a one-time $1.00 fee via Paynow to unlock unlimited voting for the current round.',
              },
              {
                icon: ThumbsUp,
                step: '03',
                title: 'Vote Freely',
                description:
                  'Cast unlimited votes for your favourite contestants and watch the leaderboard shift in real time.',
              },
            ].map((item, i) => (
              <motion.div
                key={item.step}
                variants={fadeInUp}
                custom={i + 2}
                className="flex flex-col items-center text-center"
              >
                <div className="flex size-12 items-center justify-center rounded-full border border-border bg-muted">
                  <item.icon className="size-5 text-muted-foreground" />
                </div>
                <span className="mt-3 text-xs font-medium text-[#C8A24D]">
                  Step {item.step}
                </span>
                <h3 className="mt-1 text-base font-bold">{item.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground max-w-xs">
                  {item.description}
                </p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      <Separator className="mx-auto max-w-6xl" />
    </div>
  )
}