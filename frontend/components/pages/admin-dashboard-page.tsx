'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useSession } from '@/lib/use-session'
import { getDashboardSummary, type DashboardSummaryApi } from '@/lib/api'
import type { PaymentStatus } from '@/lib/types'

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, ease: 'easeOut' as const },
}

function paymentStatusBadge(status: string) {
  switch (status as PaymentStatus) {
    case 'Paid':
      return (
        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50">
          Paid
        </Badge>
      )
    case 'Pending':
    case 'Processing':
      return (
        <Badge className="bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-50">
          {status}
        </Badge>
      )
    case 'Failed':
    case 'Cancelled':
    case 'Expired':
    case 'Refunded':
      return (
        <Badge className="bg-red-50 text-red-700 border-red-200 hover:bg-red-50">
          {status}
        </Badge>
      )
    default:
      return <Badge variant="secondary">{status}</Badge>
  }
}

function timeAgo(dateStr: string) {
  const now = new Date()
  const date = new Date(dateStr)
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.floor(diffHr / 24)
  return `${diffDay}d ago`
}

export function AdminDashboardPage() {
  const { user: adminUser } = useSession()
  const [data, setData] = useState<DashboardSummaryApi | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const fetchDashboard = async () => {
      try {
        const result = await getDashboardSummary()
        if (!cancelled) setData(result)
      } catch {
        // error handled silently, data stays null
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchDashboard()
    return () => { cancelled = true }
  }, [])

  if (loading) {
    return (
      <>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      </>
    )
  }

  if (!data) {
    return (
      <>
        <div className="text-center py-20 text-sm text-muted-foreground">
          Failed to load dashboard data.
        </div>
      </>
    )
  }

  const stats = [
    {
      label: 'Active Event',
      value: data.activeEvent,
      isText: true,
    },
    {
      label: 'Total Contestants',
      value: data.totalParticipants.toLocaleString(),
      isText: false,
    },
    {
      label: 'Total Votes',
      value: data.totalVotes.toLocaleString(),
      isText: false,
      accent: true,
    },
    {
      label: 'Total Revenue',
      value: data.totalRevenue,
      isText: false,
    },
  ]

  return (
    <>
      <div className="space-y-6 max-w-6xl">
        {/* Heading */}
        <motion.div {...fadeIn}>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Welcome back, {adminUser?.name ?? 'Admin'}
          </p>
        </motion.div>

        {/* Stats row */}
        <motion.div
          className="grid grid-cols-2 lg:grid-cols-4 gap-4"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1, ease: 'easeOut' }}
        >
          {stats.map((s) => (
            <div
              key={s.label}
              className="border border-border rounded-lg p-4"
            >
              <p className="text-xs text-muted-foreground font-medium">
                {s.label}
              </p>
              <p
                className={`text-2xl font-bold mt-1 ${
                  s.isText ? 'text-lg' : ''
                } ${s.accent ? 'text-accent-brand' : ''}`}
              >
                {s.value}
              </p>
            </div>
          ))}
        </motion.div>

        {/* Recent Payments */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2, ease: 'easeOut' }}
        >
          <h2 className="text-base font-semibold mb-3">Recent Payments</h2>
          <div className="border border-border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="text-muted-foreground text-xs font-medium">
                    Reference
                  </TableHead>
                  <TableHead className="text-muted-foreground text-xs font-medium">
                    Contestant
                  </TableHead>
                  <TableHead className="text-muted-foreground text-xs font-medium">
                    Amount
                  </TableHead>
                  <TableHead className="text-muted-foreground text-xs font-medium hidden sm:table-cell">
                    Method
                  </TableHead>
                  <TableHead className="text-muted-foreground text-xs font-medium">
                    Status
                  </TableHead>
                  <TableHead className="text-muted-foreground text-xs font-medium hidden md:table-cell">
                    Date
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recentPayments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs">
                      {p.reference}
                    </TableCell>
                    <TableCell className="text-sm">
                      {p.contestant ?? '—'}
                    </TableCell>
                    <TableCell className="text-sm">
                      {p.amount}
                    </TableCell>
                    <TableCell className="text-sm hidden sm:table-cell">
                      {p.paymentMethod}
                    </TableCell>
                    <TableCell>{paymentStatusBadge(p.status)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground hidden md:table-cell">
                      {timeAgo(p.date)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </motion.div>

        {/* Recent Activity */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3, ease: 'easeOut' }}
        >
          <h2 className="text-base font-semibold mb-3">Recent Activity</h2>
          <div className="border border-border rounded-lg divide-y divide-border">
            {data.recentActivity.map((a) => (
              <div key={a.id} className="flex items-start gap-3 px-4 py-3">
                <div className="mt-1.5 size-2 rounded-full bg-accent-brand shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium">{a.title}</p>
                  {a.detail && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {a.detail}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    {timeAgo(a.time)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </>
  )
}