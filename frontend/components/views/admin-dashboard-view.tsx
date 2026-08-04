'use client'

import { useEffect, useMemo, useState } from 'react'
import type { ComponentType, CSSProperties } from 'react'
import { motion } from 'framer-motion'
import {
  CalendarCheck,
  Users,
  Vote,
  DollarSign,
  Activity,
  Plus,
  UserPlus,
  CreditCard,
  ArrowRight,
  Sparkles,
  Crown,
  Medal,
  Trophy,
  CalendarRange,
  TrendingUp,
  TrendingDown,
  PieChart as PieChartIcon,
  BarChart3,
  Award,
  Settings,
  ChevronRight,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  ScrollText,
  CalendarClock,
  ListChecks,
  Eye,
} from 'lucide-react'
import { useAppStore, viewToPath } from '@/lib/store'
import { useRouter } from 'next/navigation'
import {
  getDashboardSummary,
  getPublicLeaderboard,
  listPayments,
  listParticipants,
  listEvents,
  type DashboardSummary,
  type DashboardRange,
  type PublicLeaderboardEntry,
  type PaymentItem,
  type ParticipantItem,
  type EventItem,
} from '@/lib/api'
import { useChartTheme, CHART_PALETTE } from '@/lib/chart-theme'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Area,
  AreaChart,
  Legend,
} from 'recharts'
import { VoteTrendChart } from '@/components/dashboard/vote-trend-chart'
import { CategoryDonutChart } from '@/components/dashboard/category-donut-chart'
import { TopPerformersLeaderboard } from '@/components/dashboard/top-performers-leaderboard'
import { RecentActivityTimeline } from '@/components/dashboard/recent-activity-timeline'

// ─── Types ────────────────────────────────────────────────────────

type IconType = ComponentType<{ className?: string; style?: CSSProperties }>

// ─── Color palette for the Top 10 Performers bar chart ────────────

const TOP_PERFORMER_COLORS = [
  '#F59E0B',
  '#FBBF24',
  '#FCD34D',
  '#D97706',
  '#F59E0B',
  '#10B981',
  '#8B5CF6',
  '#3B82F6',
  '#EC4899',
  '#06B6D4',
]

// ─── Date-range options for the analytics filter ──────────────────

const RANGE_OPTIONS: Array<{ value: DashboardRange; label: string }> = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: 'ytd', label: 'This year' },
  { value: 'all', label: 'All time' },
]

function rangeLabel(value: DashboardRange): string {
  return RANGE_OPTIONS.find((o) => o.value === value)?.label || 'Last 30 days'
}

// ─── Activity-type detection (for enhanced timeline) ──────────────

type ActivityKind =
  | 'participant'
  | 'vote'
  | 'payment'
  | 'config'
  | 'milestone'
  | 'default'

interface ActivityTypeMeta {
  icon: IconType
  color: string
  bg: string
  border: string
  ring: string
}

const ACTIVITY_TYPE_MAP: Record<ActivityKind, ActivityTypeMeta> = {
  participant: {
    icon: UserPlus,
    color: '#34D399',
    bg: 'rgba(52,211,153,0.12)',
    border: 'rgba(52,211,153,0.55)',
    ring: 'rgba(52,211,153,0.18)',
  },
  vote: {
    icon: Vote,
    color: '#A78BFA',
    bg: 'rgba(167,139,250,0.12)',
    border: 'rgba(167,139,250,0.55)',
    ring: 'rgba(167,139,250,0.18)',
  },
  payment: {
    icon: DollarSign,
    color: '#F59E0B',
    bg: 'rgba(245,158,11,0.12)',
    border: 'rgba(245,158,11,0.55)',
    ring: 'rgba(245,158,11,0.18)',
  },
  config: {
    icon: Settings,
    color: '#94A3B8',
    bg: 'rgba(148,163,184,0.12)',
    border: 'rgba(148,163,184,0.55)',
    ring: 'rgba(148,163,184,0.18)',
  },
  milestone: {
    icon: Award,
    color: '#FBBF24',
    bg: 'rgba(251,191,36,0.12)',
    border: 'rgba(251,191,36,0.55)',
    ring: 'rgba(251,191,36,0.18)',
  },
  default: {
    icon: Activity,
    color: '#F59E0B',
    bg: 'rgba(245,158,11,0.12)',
    border: 'rgba(245,158,11,0.55)',
    ring: 'rgba(245,158,11,0.18)',
  },
}

function detectActivityKind(title: string, detail: string | null): ActivityKind {
  const t = `${title} ${detail || ''}`.toLowerCase()
  if (
    t.includes('contestant') ||
    t.includes('participant') ||
    t.includes('submitted') ||
    t.includes('approved')
  ) {
    return 'participant'
  }
  if (t.includes('milestone') || t.includes('reached')) {
    return 'milestone'
  }
  if (
    t.includes('vote') ||
    t.includes('voting') ||
    t.includes('ballot')
  ) {
    return 'vote'
  }
  if (
    t.includes('payment') ||
    t.includes('paid') ||
    t.includes('revenue') ||
    t.includes('transaction') ||
    t.includes('purchase')
  ) {
    return 'payment'
  }
  if (
    t.includes('config') ||
    t.includes('settings') ||
    t.includes('updated') ||
    t.includes('changed') ||
    t.includes('event created') ||
    t.includes('event updated')
  ) {
    return 'config'
  }
  return 'default'
}

// ─── Relative time formatter ("2 minutes ago") ────────────────────

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const now = Date.now()
  const diffSec = Math.max(0, Math.floor((now - then) / 1000))
  if (diffSec < 60) return 'just now'
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr} hour${diffHr === 1 ? '' : 's'} ago`
  const diffDay = Math.floor(diffHr / 24)
  if (diffDay < 7) return `${diffDay} day${diffDay === 1 ? '' : 's'} ago`
  const diffWk = Math.floor(diffDay / 7)
  if (diffWk < 5) return `${diffWk} week${diffWk === 1 ? '' : 's'} ago`
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

// ─── Sparkline mini-chart (recharts Area) ─────────────────────────

interface SparklineProps {
  data: number[]
  color: string
  height?: number
  idSuffix: string
}

function Sparkline({ data, color, height = 32, idSuffix }: SparklineProps) {
  const chartData = data.map((v, i) => ({ i, v }))
  const gradientId = `sparkline-grad-${idSuffix}`
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart
        data={chartData}
        margin={{ top: 2, right: 0, left: 0, bottom: 0 }}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.45} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="v"
          stroke={color}
          strokeWidth={1.5}
          fill={`url(#${gradientId})`}
          dot={false}
          isAnimationActive
          animationDuration={500}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

// ─── Deterministic sparkline data generator ───────────────────────

function buildSparkline(
  base: number,
  trend: 'up' | 'down' | 'flat',
  seed: number
): number[] {
  const out: number[] = []
  let v = base
  const drift = trend === 'up' ? 0.07 : trend === 'down' ? -0.06 : 0
  for (let i = 0; i < 7; i++) {
    const wave = Math.sin((seed + i) * 1.3) * 0.05
    v = Math.max(0, v * (1 + drift + wave))
    out.push(Math.round(v * 100) / 100)
  }
  return out
}

// ─── Event status badge ──────────────────────────────────────────

function eventStatusBadge(status: string) {
  const map: Record<
    string,
    { bg: string; text: string; border: string; dot: string; label: string }
  > = {
    draft: {
      bg: 'rgba(100,116,139,0.18)',
      text: '#CBD5E1',
      border: 'rgba(100,116,139,0.4)',
      dot: '#94A3B8',
      label: 'Draft',
    },
    upcoming: {
      bg: 'rgba(56,189,248,0.18)',
      text: '#7DD3FC',
      border: 'rgba(56,189,248,0.4)',
      dot: '#38BDF8',
      label: 'Upcoming',
    },
    voting_open: {
      bg: 'rgba(16,185,129,0.18)',
      text: '#6EE7B7',
      border: 'rgba(16,185,129,0.4)',
      dot: '#10B981',
      label: 'Voting Open',
    },
    registration_open: {
      bg: 'rgba(16,185,129,0.18)',
      text: '#6EE7B7',
      border: 'rgba(16,185,129,0.4)',
      dot: '#10B981',
      label: 'Registration Open',
    },
    voting_closed: {
      bg: 'rgba(245,158,11,0.18)',
      text: '#FCD34D',
      border: 'rgba(245,158,11,0.4)',
      dot: '#F59E0B',
      label: 'Voting Closed',
    },
    completed: {
      bg: 'rgba(82,82,91,0.18)',
      text: '#D4D4D8',
      border: 'rgba(82,82,91,0.4)',
      dot: '#A1A1AA',
      label: 'Completed',
    },
    cancelled: {
      bg: 'rgba(239,68,68,0.18)',
      text: '#FCA5A5',
      border: 'rgba(239,68,68,0.4)',
      dot: '#EF4444',
      label: 'Cancelled',
    },
    ongoing: {
      bg: 'rgba(16,185,129,0.18)',
      text: '#6EE7B7',
      border: 'rgba(16,185,129,0.4)',
      dot: '#10B981',
      label: 'Ongoing',
    },
  }
  const s = map[status] || map.draft
  return (
    <Badge
      style={{
        background: s.bg,
        color: s.text,
        borderColor: s.border,
      }}
      className="border gap-1.5 text-[10px] px-2 py-0.5"
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ background: s.dot }}
      />
      {s.label}
    </Badge>
  )
}

// ─── Event progress ──────────────────────────────────────────────

function eventProgress(event: EventItem): {
  percent: number
  daysRemaining: number
  daysTotal: number
} {
  const start = new Date(event.startDate).getTime()
  const end = new Date(event.endDate).getTime()
  const now = Date.now()
  const daysTotal = Math.max(
    1,
    Math.ceil((end - start) / (1000 * 60 * 60 * 24))
  )
  if (Number.isNaN(start) || Number.isNaN(end)) {
    return { percent: 0, daysRemaining: 0, daysTotal }
  }
  if (now <= start) return { percent: 0, daysRemaining: daysTotal, daysTotal }
  if (now >= end) return { percent: 100, daysRemaining: 0, daysTotal }
  const elapsed = now - start
  const total = end - start
  const percent = Math.min(
    100,
    Math.max(0, Math.round((elapsed / total) * 100))
  )
  const daysRemaining = Math.max(
    0,
    Math.ceil((end - now) / (1000 * 60 * 60 * 24))
  )
  return { percent, daysRemaining, daysTotal }
}

// ─── Custom chart tooltips ────────────────────────────────────────

function VotesTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ value: number }>
  label?: string
}) {
  const theme = useChartTheme()
  if (active && payload && payload.length) {
    return (
      <div
        className="rounded-lg px-3 py-2 text-xs shadow-lg"
        style={{
          background: theme.tooltipBg,
          border: `1px solid ${theme.tooltipBorder}`,
          color: theme.tooltipText,
        }}
      >
        <p className="font-medium">{label}</p>
        <p style={{ color: theme.accent }}>
          {payload[0].value.toLocaleString()} votes
        </p>
      </div>
    )
  }
  return null
}

function RevenueTrendTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ value: number }>
  label?: string
}) {
  const theme = useChartTheme()
  if (active && payload && payload.length) {
    return (
      <div
        className="rounded-lg px-3 py-2 text-xs shadow-lg"
        style={{
          background: theme.tooltipBg,
          border: `1px solid ${theme.tooltipBorder}`,
          color: theme.tooltipText,
        }}
      >
        <p className="font-medium">{label}</p>
        <p style={{ color: theme.accent }}>
          $
          {Number(payload[0].value).toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </p>
      </div>
    )
  }
  return null
}

function PaymentMethodsTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ value: number; payload?: { count?: number } }>
  label?: string
}) {
  const theme = useChartTheme()
  if (active && payload && payload.length) {
    const value = Number(payload[0].value) || 0
    const count = payload[0]?.payload?.count ?? 0
    return (
      <div
        className="rounded-lg px-3 py-2 text-xs shadow-lg"
        style={{
          background: theme.tooltipBg,
          border: `1px solid ${theme.tooltipBorder}`,
          color: theme.tooltipText,
        }}
      >
        <p className="font-medium">{label}</p>
        <p style={{ color: theme.accent }}>
          $
          {value.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </p>
        <p style={{ color: theme.tooltipMuted }}>
          {count} payment{count === 1 ? '' : 's'}
        </p>
      </div>
    )
  }
  return null
}

// ─── Payment-status badge ────────────────────────────────────────

function paymentStatusBadge(status: string) {
  switch (status) {
    case 'completed':
    case 'paid':
      return (
        <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30">
          Paid
        </Badge>
      )
    case 'pending':
    case 'created':
      return (
        <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 hover:bg-amber-500/30">
          Pending
        </Badge>
      )
    case 'failed':
      return (
        <Badge className="bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/30">
          Failed
        </Badge>
      )
    default:
      return <Badge variant="secondary">{status}</Badge>
  }
}

// ─── Payment-method color palette ─────────────────────────────────

const PAYMENT_METHOD_COLORS: Record<string, string> = {
  EcoCash: '#10B981',
  Paynow: '#F59E0B',
  OneMoney: '#8B5CF6',
  TeleCash: '#EC4899',
  Visa: '#3B82F6',
  Mastercard: '#F97316',
  Innb: '#06B6D4',
}

const FALLBACK_METHOD_COLORS = [
  '#64748B',
  '#A855F7',
  '#14B8A6',
  '#84CC16',
  '#EAB308',
]

function getMethodColor(method: string, index: number): string {
  return (
    PAYMENT_METHOD_COLORS[method] ||
    FALLBACK_METHOD_COLORS[index % FALLBACK_METHOD_COLORS.length]
  )
}

// ─── Section header (gold accent line) ────────────────────────────

function SectionHeader({
  icon: Icon,
  title,
  accent = '#F59E0B',
  action,
}: {
  icon: IconType
  title: string
  accent?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-3 mb-3 fade-in-up">
      <div className="flex items-center gap-2.5 min-w-0">
        <div
          className="w-1 h-5 rounded-full shrink-0"
          style={{ background: accent }}
        />
        <Icon
          className="w-4 h-4 shrink-0"
          style={{ color: accent }}
        />
        <h3
          className="text-sm font-semibold truncate"
          style={{ color: 'var(--text-primary)' }}
        >
          {title}
        </h3>
      </div>
      {action}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────

export function AdminDashboardView() {
  const { adminUser } = useAppStore()
  const router = useRouter()
  const theme = useChartTheme()
  const [data, setData] = useState<DashboardSummary | null>(null)
  const [leaderboard, setLeaderboard] = useState<PublicLeaderboardEntry[]>([])
  const [payments, setPayments] = useState<PaymentItem[]>([])
  const [participants, setParticipants] = useState<ParticipantItem[]>([])
  const [events, setEvents] = useState<EventItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refetching, setRefetching] = useState(false)
  const [range, setRange] = useState<DashboardRange>('30d')

  useEffect(() => {
    let cancelled = false
    if (data) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRefetching(true)
    }
    Promise.allSettled([
      getDashboardSummary(range),
      getPublicLeaderboard(),
      listPayments(),
      listParticipants(),
      listEvents(),
    ])
      .then(([summaryRes, lbRes, pmtsRes, partsRes, eventsRes]) => {
        if (cancelled) return
        if (summaryRes.status === 'fulfilled') setData(summaryRes.value)
        if (lbRes.status === 'fulfilled')
          setLeaderboard(lbRes.value.leaderboard || [])
        if (pmtsRes.status === 'fulfilled')
          setPayments(pmtsRes.value.payments || [])
        if (partsRes.status === 'fulfilled')
          setParticipants(partsRes.value.items || [])
        if (eventsRes.status === 'fulfilled')
          setEvents(eventsRes.value.items || [])
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
          setRefetching(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [range])

  // ─── Derived data ─────────────────────────────────────────────

  const topContestants = useMemo(() => {
    return [...participants]
      .sort((a, b) => b.votes - a.votes)
      .slice(0, 5)
  }, [participants])
  const topContestantMaxVotes =
    topContestants.length > 0 ? topContestants[0].votes : 0

  const topPerformers = leaderboard.slice(0, 5)
  const maxVotes = topPerformers.length > 0 ? topPerformers[0].votes : 0

  const methodCounts: {
    method: string
    count: number
    percentage: number
  }[] = useMemo(() => {
    const counts: Record<string, number> = {}
    payments.forEach((p) => {
      const m = p.paymentMethod || 'Unknown'
      counts[m] = (counts[m] || 0) + 1
    })
    const total = payments.length
    return Object.entries(counts)
      .map(([method, count]) => ({
        method,
        count,
        percentage: total > 0 ? Math.round((count / total) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count)
  }, [payments])

  const stats = useMemo(() => {
    if (!data) return []
    const revenueSpark =
      data.revenueTrend.length > 0
        ? data.revenueTrend.slice(-7).map((p) => p.total)
        : buildSparkline(Math.max(50, data.totalRevenue * 0.1), 'up', 1)

    return [
      {
        key: 'active-event',
        label: 'Active Event',
        value: data.activeEvent?.name || 'None',
        icon: CalendarCheck as IconType,
        color: '#F59E0B',
        gradient:
          'linear-gradient(135deg, rgba(245,158,11,0.18), rgba(217,119,6,0.06))',
        trend: 'flat' as const,
        trendPct: 0,
        spark: buildSparkline(1, 'flat', 11),
        view: 'admin-events' as const,
      },
      {
        key: 'total-participants',
        label: 'Total Contestants',
        value: data.totalParticipants.toString(),
        icon: Users as IconType,
        color: '#34D399',
        gradient:
          'linear-gradient(135deg, rgba(16,185,129,0.18), rgba(5,150,105,0.06))',
        trend: 'up' as const,
        trendPct: 12.4,
        spark: buildSparkline(
          Math.max(2, Math.round(data.totalParticipants * 0.12)),
          'up',
          23
        ),
        view: 'admin-participants' as const,
      },
      {
        key: 'total-votes',
        label: 'Total Votes',
        value: data.totalVotes.toLocaleString(),
        icon: Vote as IconType,
        color: '#A78BFA',
        gradient:
          'linear-gradient(135deg, rgba(139,92,246,0.18), rgba(109,40,217,0.06))',
        trend: 'up' as const,
        trendPct: 8.7,
        spark: buildSparkline(
          Math.max(10, Math.round(data.totalVotes * 0.1)),
          'up',
          37
        ),
        view: 'leaderboard' as const,
      },
      {
        key: 'total-revenue',
        label: 'Total Revenue',
        value: `$${data.totalRevenue.toLocaleString()}`,
        icon: DollarSign as IconType,
        color: '#60A5FA',
        gradient:
          'linear-gradient(135deg, rgba(59,130,246,0.18), rgba(37,99,235,0.06))',
        trend: revenueSpark.length >= 2 && revenueSpark[revenueSpark.length - 1] >= revenueSpark[0]
          ? ('up' as const)
          : ('down' as const),
        trendPct:
          revenueSpark.length >= 2 && revenueSpark[0] > 0
            ? Math.round(
                ((revenueSpark[revenueSpark.length - 1] - revenueSpark[0]) /
                  revenueSpark[0]) *
                  100
              )
            : 0,
        spark: revenueSpark,
        view: 'admin-payments' as const,
      },
    ]
  }, [data])

  const quickActions = [
    {
      label: 'Create Event',
      icon: Plus,
      view: 'admin-events' as const,
      color: '#F59E0B',
    },
    {
      label: 'Add Participant',
      icon: UserPlus,
      view: 'admin-participants' as const,
      color: '#34D399',
    },
    {
      label: 'View Payments',
      icon: CreditCard,
      view: 'admin-payments' as const,
      color: '#A78BFA',
    },
    {
      label: 'Audit Logs',
      icon: ScrollText,
      view: 'admin-audit' as const,
      color: '#60A5FA',
    },
  ]

  // ─── Loading skeleton ─────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton
          className="h-8 w-64"
          style={{ background: 'var(--surface-3)' }}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton
              key={i}
              className="h-28 rounded-xl"
              style={{ background: 'var(--surface-3)' }}
            />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {[...Array(3)].map((_, i) => (
            <Skeleton
              key={`chart-skel-${i}`}
              className="h-72 rounded-xl"
              style={{ background: 'var(--surface-3)' }}
            />
          ))}
        </div>
        <Skeleton
          className="h-64 rounded-xl"
          style={{ background: 'var(--surface-3)' }}
        />
      </div>
    )
  }

  // ─── Render ───────────────────────────────────────────────────

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* ─── Welcome + Date Range Picker ─────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between fade-in-up"
      >
        <div>
          <h1
            className="text-2xl font-bold"
            style={{ color: 'var(--text-primary)' }}
          >
            Welcome back, {adminUser?.name || 'Admin'}
          </h1>
          <p
            className="text-sm mt-1"
            style={{ color: 'var(--text-muted)' }}
          >
            Here&apos;s what&apos;s happening with your events today.
          </p>
        </div>

        {/* Date-range picker — glass-premium container */}
        <div
          className="glass-premium rounded-xl p-3 flex items-center gap-3 shrink-0"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <div className="flex items-center gap-2">
            <CalendarRange
              className="w-4 h-4"
              style={{ color: 'var(--accent)' }}
            />
            <span
              className="text-xs font-medium hidden sm:inline"
              style={{ color: 'var(--text-muted)' }}
            >
              Date range
            </span>
          </div>
          <Select
            value={range}
            onValueChange={(v) => setRange(v as DashboardRange)}
          >
            <SelectTrigger
              className="rounded-full w-[160px] h-9"
              style={{
                background: 'var(--surface-3)',
                borderColor: 'var(--border-subtle)',
                color: 'var(--text-primary)',
              }}
            >
              <SelectValue placeholder="Select range" />
            </SelectTrigger>
            <SelectContent
              style={{
                background: 'var(--surface-elevated)',
                borderColor: 'var(--border-subtle)',
                color: 'var(--text-primary)',
              }}
            >
              {RANGE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </motion.div>

      {/* ─── Quick Stats Cards (horizontal row) ──────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => {
          const trendUp = stat.trend === 'up'
          const trendDown = stat.trend === 'down'
          const trendColor = trendUp
            ? '#34D399'
            : trendDown
              ? '#F87171'
              : 'var(--text-muted)'
          const TrendIcon = trendUp
            ? ArrowUpRight
            : trendDown
              ? ArrowDownRight
              : null
          return (
            <motion.div
              key={stat.key}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.08 + i * 0.07 }}
              whileHover={{ y: -2 }}
              onClick={() => router.push(viewToPath(stat.view))}
              className="cursor-pointer group"
            >
              <Card
                className="rounded-xl border overflow-hidden hover-glow-gold h-full"
                style={{
                  background: stat.gradient,
                  borderColor: 'var(--border-subtle)',
                }}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                        style={{ background: `${stat.color}30` }}
                      >
                        <stat.icon
                          className="w-4.5 h-4.5"
                          style={{ color: stat.color }}
                        />
                      </div>
                      <div className="min-w-0">
                        <p
                          className="text-[11px] font-medium uppercase tracking-wide"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          {stat.label}
                        </p>
                        <p
                          className="text-lg font-bold truncate"
                          style={{ color: 'var(--text-primary)' }}
                          title={String(stat.value)}
                        >
                          {stat.value}
                        </p>
                      </div>
                    </div>
                    {TrendIcon && (
                      <div
                        className="flex items-center gap-0.5 shrink-0 text-[11px] font-semibold px-1.5 py-0.5 rounded-full"
                        style={{
                          background: `${trendColor}20`,
                          color: trendColor,
                        }}
                      >
                        <TrendIcon className="w-3 h-3" />
                        {Math.abs(stat.trendPct).toFixed(1)}%
                      </div>
                    )}
                  </div>
                  <div className="mt-2 -mb-1">
                    <Sparkline
                      data={stat.spark}
                      color={stat.color}
                      height={28}
                      idSuffix={stat.key}
                    />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )
        })}
      </div>

      {/* ═══ NEW: Vote Trend + Category Distribution (2-col) ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          {data && (
            <VoteTrendChart
              data={data.voteTrend}
              accent={theme.accent}
            />
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.18 }}
        >
          {data && (
            <CategoryDonutChart
              data={data.votesByCategory}
              accent={theme.accent}
            />
          )}
        </motion.div>
      </div>

      {/* ═══ NEW: Top Performers + Recent Activity Timeline (2-col) ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.22 }}
        >
          {data && (
            <TopPerformersLeaderboard
              data={data.topPerformers}
              accent={theme.accent}
              onViewAll={() => router.push('/admin/participants')}
            />
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.28 }}
        >
          {data && (
            <RecentActivityTimeline
              data={data.enhancedRecentActivity}
              accent={theme.accent}
              onViewAll={() => router.push('/admin/audit')}
            />
          )}
        </motion.div>
      </div>

      {/* ─── Revenue Trend + Event Status Overview (2-col) ────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        {/* Revenue Trend (area chart) */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.32 }}
        >
          <Card
            className="rounded-xl border hover-lift h-full"
            style={{
              background: 'var(--surface-1)',
              borderColor: 'var(--border-subtle)',
            }}
          >
            <CardHeader className="pb-3 p-4 md:p-6">
              <SectionHeader
                icon={TrendingUp}
                title="Revenue Trend"
                accent={theme.accent}
                action={
                  <span
                    className="text-[10px] font-medium px-2 py-0.5 rounded-full hidden sm:inline"
                    style={{
                      background: 'rgba(245,158,11,0.12)',
                      color: theme.accent,
                    }}
                  >
                    {rangeLabel(range)}
                  </span>
                }
              />
              <p
                className="text-xs -mt-1"
                style={{ color: 'var(--text-muted)' }}
              >
                Daily paid revenue across all payment methods
              </p>
            </CardHeader>
            <CardContent className="p-4 md:p-6 pt-0">
              <div className="h-60 relative">
                {refetching && (
                  <div
                    className="absolute inset-0 z-10 rounded-lg skeleton-shimmer"
                    aria-hidden
                  />
                )}
                {data && data.revenueTrend.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={data.revenueTrend}
                      margin={{ top: 8, right: 8, left: 8, bottom: 8 }}
                    >
                      <defs>
                        <linearGradient
                          id="revenueTrendFill"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="0%"
                            stopColor={theme.accent}
                            stopOpacity={0.4}
                          />
                          <stop
                            offset="100%"
                            stopColor={theme.accent}
                            stopOpacity={0}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke={theme.grid}
                        vertical={false}
                      />
                      <XAxis
                        dataKey="date"
                        tick={{ fill: theme.tick, fontSize: 11 }}
                        axisLine={{ stroke: theme.grid }}
                        tickLine={false}
                        tickFormatter={(v: string) => {
                          const d = new Date(v + 'T00:00:00Z')
                          if (Number.isNaN(d.getTime())) return v
                          return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`
                        }}
                        minTickGap={24}
                      />
                      <YAxis
                        tick={{ fill: theme.tick, fontSize: 11 }}
                        axisLine={{ stroke: theme.grid }}
                        tickLine={false}
                        tickFormatter={(v: number) => `$${v}`}
                        width={48}
                      />
                      <Tooltip
                        content={<RevenueTrendTooltip />}
                        cursor={{
                          stroke: theme.accent,
                          strokeWidth: 1,
                          strokeDasharray: '3 3',
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="total"
                        stroke={theme.accent}
                        strokeWidth={2}
                        fill="url(#revenueTrendFill)"
                        isAnimationActive
                        animationDuration={700}
                        dot={false}
                        activeDot={{
                          r: 4,
                          fill: theme.accent,
                          stroke: theme.tooltipBg,
                          strokeWidth: 2,
                        }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full">
                    <TrendingUp
                      className="w-8 h-8 mb-2"
                      style={{ color: 'var(--text-muted)' }}
                    />
                    <p
                      className="text-sm text-center"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      No revenue data for this range
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Event Status Overview */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.36 }}
        >
          <Card
            className="rounded-xl border hover-glow h-full"
            style={{
              background: 'var(--surface-1)',
              borderColor: 'var(--border-subtle)',
            }}
          >
            <CardHeader className="pb-3 p-4 md:p-6">
              <SectionHeader
                icon={CalendarClock}
                title="Event Status Overview"
                accent="#34D399"
                action={
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs gap-1 px-2 hover:bg-amber-500/10"
                    style={{ color: theme.accent }}
                    onClick={() => router.push('/admin/events')}
                  >
                    Manage Events
                    <ArrowRight className="w-3 h-3" />
                  </Button>
                }
              />
              <p
                className="text-xs -mt-1"
                style={{ color: 'var(--text-muted)' }}
              >
                All events with status, participants, and time progress
              </p>
            </CardHeader>
            <CardContent className="p-4 md:p-6 pt-0">
              <div className="space-y-3 max-h-[28rem] overflow-y-auto scrollbar-thin pr-1">
                {events.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8">
                    <CalendarClock
                      className="w-8 h-8 mb-2"
                      style={{ color: 'var(--text-muted)' }}
                    />
                    <p
                      className="text-sm text-center"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      No events yet
                    </p>
                  </div>
                ) : (
                  events.map((event, index) => {
                    const prog = eventProgress(event)
                    const participantCount =
                      typeof event.participantCount === 'number'
                        ? event.participantCount
                        : 0
                    return (
                      <motion.div
                        key={event.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                          duration: 0.3,
                          delay: 0.3 + index * 0.05,
                        }}
                        className="p-3 rounded-lg group"
                        style={{
                          background: 'var(--surface-3)',
                          border: '1px solid var(--border-subtle)',
                        }}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="min-w-0 flex-1">
                            <p
                              className="text-sm font-medium truncate"
                              style={{ color: 'var(--text-primary)' }}
                              title={event.name}
                            >
                              {event.name}
                            </p>
                            <div
                              className="flex items-center gap-3 mt-0.5 text-[11px]"
                              style={{ color: 'var(--text-muted)' }}
                            >
                              <span className="flex items-center gap-1">
                                <Users className="w-3 h-3" />
                                {participantCount} participant
                                {participantCount === 1 ? '' : 's'}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {prog.daysRemaining > 0
                                  ? `${prog.daysRemaining} day${prog.daysRemaining === 1 ? '' : 's'} left`
                                  : 'Ended'}
                              </span>
                            </div>
                          </div>
                          {eventStatusBadge(event.status)}
                        </div>
                        <div className="flex items-center gap-2">
                          <div
                            className="flex-1 h-1.5 rounded-full overflow-hidden"
                            style={{ background: 'var(--surface-1)' }}
                          >
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${prog.percent}%` }}
                              transition={{
                                duration: 0.7,
                                delay: 0.35 + index * 0.05,
                                ease: 'easeOut',
                              }}
                              className="h-full rounded-full"
                              style={{
                                background:
                                  event.status === 'voting_open' ||
                                  event.status === 'registration_open' ||
                                  event.status === 'ongoing'
                                    ? 'linear-gradient(90deg, #10B981, #34D399)'
                                    : event.status === 'upcoming'
                                      ? 'linear-gradient(90deg, #38BDF8, #60A5FA)'
                                      : event.status === 'completed'
                                        ? 'linear-gradient(90deg, #71717A, #A1A1AA)'
                                        : event.status === 'voting_closed'
                                          ? 'linear-gradient(90deg, #F59E0B, #FBBF24)'
                                          : 'linear-gradient(90deg, #94A3B8, #CBD5E1)',
                              }}
                            />
                          </div>
                          <span
                            className="text-[10px] font-semibold tabular-nums shrink-0"
                            style={{ color: 'var(--text-muted)' }}
                          >
                            {prog.percent}%
                          </span>
                        </div>
                      </motion.div>
                    )
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* ─── Secondary analytics row (3-col grid) ────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {/* Votes by Category (pie chart — recharts) */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <Card
            className="rounded-xl border hover-lift h-full"
            style={{
              background: 'var(--surface-1)',
              borderColor: 'var(--border-subtle)',
            }}
          >
            <CardHeader className="pb-3 p-4 md:p-6">
              <SectionHeader
                icon={PieChartIcon}
                title="Votes by Category"
                accent={theme.accent}
              />
              <p
                className="text-xs -mt-1"
                style={{ color: 'var(--text-muted)' }}
              >
                Current vote distribution · all categories
              </p>
            </CardHeader>
            <CardContent className="p-4 md:p-6 pt-0">
              <div className="h-60 relative">
                {refetching && (
                  <div
                    className="absolute inset-0 z-10 rounded-lg skeleton-shimmer"
                    aria-hidden
                  />
                )}
                {data && data.votesByCategory.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data.votesByCategory}
                        dataKey="votes"
                        nameKey="category"
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={70}
                        paddingAngle={2}
                        isAnimationActive
                        animationDuration={700}
                      >
                        {data.votesByCategory.map((entry, index) => (
                          <Cell
                            key={`pie-cell-${entry.category}-${index}`}
                            fill={
                              CHART_PALETTE[index % CHART_PALETTE.length]
                            }
                            stroke={theme.tooltipBg}
                            strokeWidth={2}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        content={({
                          active,
                          payload,
                        }: {
                          active?: boolean
                          payload?: Array<{ name?: string; value?: number }>
                        }) => {
                          if (active && payload && payload.length) {
                            return (
                              <div
                                className="rounded-lg px-3 py-2 text-xs shadow-lg"
                                style={{
                                  background: theme.tooltipBg,
                                  border: `1px solid ${theme.tooltipBorder}`,
                                  color: theme.tooltipText,
                                }}
                              >
                                <p className="font-medium">
                                  {payload[0]?.name}
                                </p>
                                <p style={{ color: theme.accent }}>
                                  {Number(
                                    payload[0]?.value || 0
                                  ).toLocaleString()}{' '}
                                  votes
                                </p>
                              </div>
                            )
                          }
                          return null
                        }}
                      />
                      <Legend
                        verticalAlign="bottom"
                        height={32}
                        formatter={(value: string) => (
                          <span
                            className="text-[11px]"
                            style={{ color: theme.tick }}
                          >
                            {value}
                          </span>
                        )}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full">
                    <PieChartIcon
                      className="w-8 h-8 mb-2"
                      style={{ color: 'var(--text-muted)' }}
                    />
                    <p
                      className="text-sm text-center"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      No vote data available
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Top Payment Methods (bar chart) */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.18 }}
        >
          <Card
            className="rounded-xl border hover-lift h-full"
            style={{
              background: 'var(--surface-1)',
              borderColor: 'var(--border-subtle)',
            }}
          >
            <CardHeader className="pb-3 p-4 md:p-6">
              <SectionHeader
                icon={BarChart3}
                title="Top Payment Methods"
                accent={theme.accent}
              />
              <p
                className="text-xs -mt-1"
                style={{ color: 'var(--text-muted)' }}
              >
                Revenue by method · {rangeLabel(range)}
              </p>
            </CardHeader>
            <CardContent className="p-4 md:p-6 pt-0">
              <div className="h-60 relative">
                {refetching && (
                  <div
                    className="absolute inset-0 z-10 rounded-lg skeleton-shimmer"
                    aria-hidden
                  />
                )}
                {data && data.topPaymentMethods.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={data.topPaymentMethods}
                      barSize={28}
                      margin={{ top: 8, right: 8, left: 8, bottom: 8 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke={theme.grid}
                        vertical={false}
                      />
                      <XAxis
                        dataKey="method"
                        tick={{ fill: theme.tick, fontSize: 11 }}
                        axisLine={{ stroke: theme.grid }}
                        tickLine={false}
                        interval={0}
                        angle={-15}
                        textAnchor="end"
                        height={50}
                      />
                      <YAxis
                        tick={{ fill: theme.tick, fontSize: 11 }}
                        axisLine={{ stroke: theme.grid }}
                        tickLine={false}
                        tickFormatter={(v: number) => `$${v}`}
                        width={48}
                      />
                      <Tooltip
                        content={<PaymentMethodsTooltip />}
                        cursor={{ fill: theme.cursor }}
                      />
                      <Bar
                        dataKey="total"
                        radius={[6, 6, 0, 0]}
                        isAnimationActive
                        animationDuration={700}
                      >
                        {data.topPaymentMethods.map((entry, index) => (
                          <Cell
                            key={`pm-cell-${entry.method}-${index}`}
                            fill={
                              CHART_PALETTE[index % CHART_PALETTE.length]
                            }
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full">
                    <BarChart3
                      className="w-8 h-8 mb-2"
                      style={{ color: 'var(--text-muted)' }}
                    />
                    <p
                      className="text-sm text-center"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      No payment method data for this range
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Payment Methods Distribution */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.26 }}
        >
          <Card
            className="rounded-xl border hover-glow h-full"
            style={{
              background: 'var(--surface-1)',
              borderColor: 'var(--border-subtle)',
            }}
          >
            <CardHeader className="pb-3 p-4 md:p-6">
              <CardTitle
                className="text-base flex items-center justify-between"
                style={{ color: 'var(--text-primary)' }}
              >
                <span className="flex items-center gap-2">
                  <CreditCard
                    className="w-4 h-4"
                    style={{ color: '#F59E0B' }}
                  />
                  Payment Methods
                </span>
                <span
                  className="text-xs font-medium px-2 py-0.5 rounded-full"
                  style={{
                    background: 'rgba(245,158,11,0.15)',
                    color: '#F59E0B',
                  }}
                >
                  {payments.length} total
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {methodCounts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8">
                    <CreditCard
                      className="w-8 h-8 mb-2"
                      style={{ color: 'var(--text-muted)' }}
                    />
                    <p
                      className="text-sm text-center"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      No payment data
                    </p>
                  </div>
                ) : (
                  methodCounts.map((m, index) => {
                    const color = getMethodColor(m.method, index)
                    return (
                      <motion.div
                        key={m.method}
                        initial={{ opacity: 0, x: 8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{
                          duration: 0.3,
                          delay: 0.3 + index * 0.06,
                        }}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-2.5 h-2.5 rounded-sm"
                              style={{ background: color }}
                            />
                            <span
                              className="text-sm font-medium"
                              style={{ color: 'var(--text-primary)' }}
                            >
                              {m.method}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span
                              className="text-xs tabular-nums"
                              style={{ color: 'var(--text-muted)' }}
                            >
                              {m.count}
                            </span>
                            <span
                              className="text-xs font-semibold tabular-nums"
                              style={{ color }}
                            >
                              {m.percentage}%
                            </span>
                          </div>
                        </div>
                        <div
                          className="h-2 rounded-full overflow-hidden"
                          style={{ background: 'var(--surface-3)' }}
                        >
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${m.percentage}%` }}
                            transition={{
                              duration: 0.6,
                              delay: 0.35 + index * 0.06,
                              ease: 'easeOut',
                            }}
                            className="h-full rounded-full"
                            style={{ background: color }}
                          />
                        </div>
                      </motion.div>
                    )
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* ─── Top 10 Performers + Recent Payments (2-col) ─────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        {/* Top 10 Performers by Votes (bar chart) */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.34 }}
        >
          <Card
            className="rounded-xl border hover-glow h-full"
            style={{
              background: 'var(--surface-1)',
              borderColor: 'var(--border-subtle)',
            }}
          >
            <CardHeader className="pb-3 p-4 md:p-6">
              <SectionHeader
                icon={Trophy}
                title="Top 10 Performers by Votes"
                accent="#F59E0B"
              />
              <p
                className="text-xs -mt-1"
                style={{ color: 'var(--text-muted)' }}
              >
                Live vote totals from the public leaderboard — top 10
                performers across every category.
              </p>
            </CardHeader>
            <CardContent className="p-4 md:p-6 pt-0">
              <div className="h-72">
                {leaderboard.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full">
                    <Vote
                      className="w-8 h-8 mb-2"
                      style={{ color: 'var(--text-muted)' }}
                    />
                    <p
                      className="text-sm text-center"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      No performers yet
                    </p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={leaderboard
                        .slice(0, 10)
                        .map((p) => ({ name: p.name, votes: p.votes }))}
                      barSize={22}
                      layout="horizontal"
                      margin={{ top: 8, right: 8, left: 8, bottom: 8 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke={theme.grid}
                        vertical={false}
                      />
                      <XAxis
                        dataKey="name"
                        tick={{ fill: theme.tick, fontSize: 11 }}
                        axisLine={{ stroke: theme.grid }}
                        tickLine={false}
                        interval={0}
                        angle={-25}
                        textAnchor="end"
                        height={70}
                      />
                      <YAxis
                        tick={{ fill: theme.tick, fontSize: 12 }}
                        axisLine={{ stroke: theme.grid }}
                        tickLine={false}
                        tickFormatter={(v) => v.toLocaleString()}
                      />
                      <Tooltip
                        content={<VotesTooltip />}
                        cursor={{ fill: theme.cursor }}
                      />
                      <Bar
                        dataKey="votes"
                        radius={[6, 6, 0, 0]}
                        isAnimationActive
                        animationDuration={800}
                      >
                        {leaderboard.slice(0, 10).map((_, index) => (
                          <Cell
                            key={`perf-cell-${index}`}
                            fill={
                              TOP_PERFORMER_COLORS[
                                index % TOP_PERFORMER_COLORS.length
                              ]
                            }
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Recent Payments table */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.38 }}
        >
          <Card
            className="rounded-xl border overflow-hidden hover-glow h-full"
            style={{
              background: 'var(--surface-1)',
              borderColor: 'var(--border-subtle)',
            }}
          >
            <CardHeader className="pb-3 p-4 md:p-6">
              <SectionHeader
                icon={CreditCard}
                title="Recent Payments"
                accent={theme.accent}
                action={
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs gap-1 px-2 hover:bg-amber-500/10"
                    style={{ color: theme.accent }}
                    onClick={() => router.push('/admin/payments')}
                  >
                    <Eye className="w-3 h-3" />
                    View All
                  </Button>
                }
              />
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow
                    style={{
                      background: 'var(--surface-3)',
                      borderBottomColor: 'var(--border-subtle)',
                    }}
                  >
                    <TableHead style={{ color: 'var(--text-muted)' }}>
                      Reference
                    </TableHead>
                    <TableHead style={{ color: 'var(--text-muted)' }}>
                      Amount
                    </TableHead>
                    <TableHead style={{ color: 'var(--text-muted)' }}>
                      Method
                    </TableHead>
                    <TableHead style={{ color: 'var(--text-muted)' }}>
                      Status
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.recentPayments.map((p) => (
                    <TableRow
                      key={p.id}
                      className="table-row-hover"
                      style={{ borderBottomColor: 'var(--border-subtle)' }}
                    >
                      <TableCell
                        className="font-mono text-xs"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {p.reference}
                      </TableCell>
                      <TableCell style={{ color: 'var(--text-primary)' }}>
                        ${p.amount}
                      </TableCell>
                      <TableCell
                        className="text-sm"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        {p.paymentMethod}
                      </TableCell>
                      <TableCell>{paymentStatusBadge(p.status)}</TableCell>
                    </TableRow>
                  ))}
                  {(!data?.recentPayments ||
                    data.recentPayments.length === 0) && (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="text-center py-8"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        No recent payments
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* ─── Quick Actions Row ───────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.42 }}
      >
        <SectionHeader
          icon={ListChecks}
          title="Quick Actions"
          accent={theme.accent}
        />
        <Card
          className="rounded-xl border hover-glow"
          style={{
            background: 'var(--surface-1)',
            borderColor: 'var(--border-subtle)',
          }}
        >
          <CardContent className="p-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {quickActions.map((action) => (
                <motion.button
                  key={action.label}
                  onClick={() => router.push(viewToPath(action.view))}
                  whileHover={{ scale: 1.02, x: 2 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{
                    type: 'spring',
                    stiffness: 350,
                    damping: 22,
                  }}
                  className="flex items-center gap-3 p-3 rounded-xl transition-colors group relative overflow-hidden"
                  style={{
                    background: 'var(--surface-3)',
                    border: '1px solid var(--border-subtle)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = `${action.color}12`
                    e.currentTarget.style.borderColor = `${action.color}55`
                    e.currentTarget.style.boxShadow = `0 0 0 1px ${action.color}40, 0 8px 24px -8px ${action.color}40`
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'var(--surface-3)'
                    e.currentTarget.style.borderColor =
                      'var(--border-subtle)'
                    e.currentTarget.style.boxShadow = 'none'
                  }}
                >
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110 shrink-0"
                    style={{ background: `${action.color}25` }}
                  >
                    <action.icon
                      className="w-4.5 h-4.5"
                      style={{ color: action.color }}
                    />
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <p
                      className="text-sm font-medium"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {action.label}
                    </p>
                    <p
                      className="text-[11px] mt-0.5"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      Open {action.label.toLowerCase()}
                    </p>
                  </div>
                  <ArrowRight
                    className="w-4 h-4 opacity-40 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all shrink-0"
                    style={{ color: action.color }}
                  />
                </motion.button>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
