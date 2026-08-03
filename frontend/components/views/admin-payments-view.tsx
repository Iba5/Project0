'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  CreditCard,
  Search,
  Download,
  Eye,
  Filter,
  DollarSign,
  Receipt,
  Clock,
  XCircle,
  ChevronLeft,
  ChevronRight,
  Inbox,
} from 'lucide-react'
import { listPayments, paymentMethods, type PaymentItem } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from '@/components/ui/dialog'

// Local type extension — payments API now includes contestant relation
type PaymentWithParticipant = PaymentItem & {
  contestant?: {
    id: string
    name: string
    category: string
    platform: string
  } | null
}

const PAGE_SIZE = 10

function paymentStatusBadge(status: string) {
  switch (status) {
    case 'Completed':
    case 'Paid':
      return (
        <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30">
          Paid
        </Badge>
      )
    case 'Pending':
    case 'Created':
      return (
        <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 hover:bg-amber-500/30">
          Pending
        </Badge>
      )
    case 'Failed':
      return (
        <Badge className="bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/30">
          Failed
        </Badge>
      )
    default:
      return <Badge variant="secondary">{status}</Badge>
  }
}

function normalizeStatus(status: string): 'Paid' | 'Pending' | 'Failed' | 'Other' {
  switch (status) {
    case 'Completed':
    case 'Paid':
      return 'Paid'
    case 'Pending':
    case 'Created':
      return 'Pending'
    case 'Failed':
      return 'Failed'
    default:
      return 'Other'
  }
}

function getMethodEmoji(method: string): string | null {
  if (!method) return null
  const lowered = method.toLowerCase()
  const match = paymentMethods.find((m) => m.id.toLowerCase() === lowered || m.name.toLowerCase() === lowered)
  return match?.icon ?? null
}

function getContestantName(p: PaymentWithParticipant): string {
  return p.contestant?.name || p.voterName || p.contestantId?.slice(0, 8) || '—'
}

function formatCurrency(amount: number): string {
  return `$${Number(amount || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function escapeCsv(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function exportPaymentsCsv(rows: PaymentWithParticipant[]): void {
  const header = ['Reference', 'Contestant', 'Voter', 'Amount', 'Method', 'Status', 'Date']
  const body = rows.map((p) => [
    escapeCsv(p.reference),
    escapeCsv(getContestantName(p)),
    escapeCsv(p.voterName),
    escapeCsv(p.amount.toFixed(2)),
    escapeCsv(p.paymentMethod),
    escapeCsv(normalizeStatus(p.status)),
    escapeCsv(new Date(p.date).toLocaleString()),
  ])
  const csv = [header.join(','), ...body.map((r) => r.join(','))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', `vibehub-payments-${new Date().toISOString().slice(0, 10)}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  gradient,
  delay,
}: {
  label: string
  value: string
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
  color: string
  gradient: string
  delay: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
    >
      <div
        className="rounded-xl border overflow-hidden h-full hover-lift"
        style={{ background: gradient, borderColor: 'var(--border-subtle)' }}
      >
        <div className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                {label}
              </p>
              <p className="text-xl font-bold mt-1" style={{ color: 'var(--text-primary)' }}>
                {value}
              </p>
            </div>
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: `${color}20` }}
            >
              <Icon className="w-5 h-5" style={{ color }} />
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

export function AdminPaymentsView() {
  const [payments, setPayments] = useState<PaymentWithParticipant[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<PaymentWithParticipant | null>(null)
  const [page, setPage] = useState(0)

  useEffect(() => {
    listPayments()
      .then(({ payments: p }) => setPayments(p as PaymentWithParticipant[]))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return payments.filter((p) => {
      // Status filter (client-side)
      if (statusFilter !== 'all') {
        const norm = normalizeStatus(p.status)
        if (statusFilter.toLowerCase() !== norm.toLowerCase()) return false
      }
      // Search filter — reference, voterName, contestant name
      if (q) {
        const contestant = getContestantName(p).toLowerCase()
        const voter = (p.voterName || '').toLowerCase()
        const ref = (p.reference || '').toLowerCase()
        if (!ref.includes(q) && !voter.includes(q) && !contestant.includes(q)) {
          return false
        }
      }
      return true
    })
  }, [payments, statusFilter, search])

  // Handlers reset page to first when filters/search change (avoids the
  // setState-in-effect anti-pattern by coupling reset with the user action)
  const handleSearchChange = (val: string) => {
    setSearch(val)
    setPage(0)
  }
  const handleStatusChange = (val: string) => {
    setStatusFilter(val)
    setPage(0)
  }

  const stats = useMemo(() => {
    const paid = payments.filter((p) => normalizeStatus(p.status) === 'Paid')
    const pending = payments.filter((p) => normalizeStatus(p.status) === 'Pending')
    const failed = payments.filter((p) => normalizeStatus(p.status) === 'Failed')
    const totalRevenue = paid.reduce((sum, p) => sum + (p.amount || 0), 0)
    return {
      totalRevenue,
      total: payments.length,
      pendingCount: pending.length,
      failedCount: failed.length,
    }
  }, [payments])

  // Pagination calculations
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages - 1)
  const paged = filtered.slice(
    currentPage * PAGE_SIZE,
    (currentPage + 1) * PAGE_SIZE,
  )
  const startIdx = filtered.length === 0 ? 0 : currentPage * PAGE_SIZE + 1
  const endIdx = Math.min((currentPage + 1) * PAGE_SIZE, filtered.length)

  // Sum of all filtered payment amounts (for footer summary)
  const filteredTotal = useMemo(
    () => filtered.reduce((sum, p) => sum + (p.amount || 0), 0),
    [filtered],
  )

  const handleExport = () => {
    if (filtered.length === 0) return
    exportPaymentsCsv(filtered)
  }

  const hasActiveFilters = statusFilter !== 'all' || search.trim() !== ''

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
          Payments
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          Track all payment transactions across your events
        </p>
      </motion.div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Revenue (Paid)"
          value={formatCurrency(stats.totalRevenue)}
          icon={DollarSign}
          color="#F59E0B"
          gradient="linear-gradient(135deg, rgba(245,158,11,0.2), rgba(217,119,6,0.1))"
          delay={0.05}
        />
        <StatCard
          label="Total Payments"
          value={stats.total.toLocaleString()}
          icon={Receipt}
          color="#10B981"
          gradient="linear-gradient(135deg, rgba(16,185,129,0.2), rgba(5,150,105,0.1))"
          delay={0.1}
        />
        <StatCard
          label="Pending"
          value={stats.pendingCount.toLocaleString()}
          icon={Clock}
          color="#F59E0B"
          gradient="linear-gradient(135deg, rgba(245,158,11,0.15), rgba(217,119,6,0.08))"
          delay={0.15}
        />
        <StatCard
          label="Failed"
          value={stats.failedCount.toLocaleString()}
          icon={XCircle}
          color="#EF4444"
          gradient="linear-gradient(135deg, rgba(239,68,68,0.2), rgba(220,38,38,0.1))"
          delay={0.2}
        />
      </div>

      {/* Table card with filters + export */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.25 }}
      >
        <div
          className="rounded-xl border overflow-hidden table-row-hover"
          style={{ background: 'var(--surface-1)', borderColor: 'var(--border-subtle)' }}
        >
          {/* Filter / Search bar — all controls inline, Export CSV aligned to far right */}
          <div
            className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-4 border-b"
            style={{ borderColor: 'var(--border-subtle)' }}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center w-full sm:w-auto sm:flex-1">
              <div className="relative w-full sm:w-72">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
                  style={{ color: 'var(--text-muted)' }}
                />
                <Input
                  placeholder="Search reference, voter, contestant..."
                  value={search}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="pl-9 rounded-full input-focus-gold"
                  style={{
                    background: 'var(--surface-3)',
                    borderColor: 'var(--border-subtle)',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 hidden sm:block" style={{ color: 'var(--text-muted)' }} />
                <Select value={statusFilter} onValueChange={handleStatusChange}>
                  <SelectTrigger
                    className="rounded-full w-full sm:w-[160px]"
                    style={{
                      background: 'var(--surface-3)',
                      borderColor: 'var(--border-subtle)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent
                    style={{
                      background: 'var(--surface-elevated)',
                      borderColor: 'var(--border-subtle)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button
              onClick={handleExport}
              disabled={filtered.length === 0}
              className="rounded-full self-start sm:self-auto shrink-0 button-press"
              style={{
                background: '#F59E0B',
                color: 'var(--surface-3)',
                fontWeight: 600,
              }}
            >
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          </div>

          {/* Table */}
          <Table>
            <TableHeader>
              <TableRow
                style={{
                  background: 'var(--surface-3)',
                  borderBottomColor: 'var(--border-subtle)',
                }}
              >
                <TableHead style={{ color: 'var(--text-muted)' }} className="w-[180px]">Reference</TableHead>
                <TableHead style={{ color: 'var(--text-muted)' }}>Contestant</TableHead>
                <TableHead style={{ color: 'var(--text-muted)' }} className="w-[160px]">Voter</TableHead>
                <TableHead style={{ color: 'var(--text-muted)' }} className="w-[110px] text-right">Amount</TableHead>
                <TableHead style={{ color: 'var(--text-muted)' }} className="w-[130px]">Method</TableHead>
                <TableHead style={{ color: 'var(--text-muted)' }} className="w-[110px]">Status</TableHead>
                <TableHead style={{ color: 'var(--text-muted)' }} className="w-[110px]">Date</TableHead>
                <TableHead style={{ color: 'var(--text-muted)' }} className="w-[60px] text-right">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                // Loading skeleton rows (5 rows)
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={`skeleton-${i}`} style={{ borderBottomColor: 'var(--surface-3)' }}>
                    <TableCell colSpan={8} className="py-3">
                      <div className="flex items-center gap-4">
                        <Skeleton className="h-4 w-32 rounded-md" />
                        <Skeleton className="h-4 w-24 rounded-md" />
                        <Skeleton className="h-4 w-20 rounded-md" />
                        <Skeleton className="h-4 w-16 rounded-md ml-auto" />
                        <Skeleton className="h-4 w-14 rounded-md" />
                        <Skeleton className="h-4 w-12 rounded-md" />
                        <Skeleton className="h-4 w-16 rounded-md" />
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-16">
                    <div className="flex flex-col items-center gap-3">
                      <div
                        className="w-14 h-14 rounded-full flex items-center justify-center"
                        style={{
                          background: 'rgba(245,158,11,0.1)',
                          border: '1px solid rgba(245,158,11,0.2)',
                        }}
                      >
                        <Inbox className="w-7 h-7" style={{ color: '#F59E0B' }} />
                      </div>
                      <div>
                        <p className="font-medium" style={{ color: 'var(--text-primary)' }}>
                          {payments.length === 0
                            ? 'No payments found'
                            : hasActiveFilters
                              ? 'No payments match your filters'
                              : 'No payments found'}
                        </p>
                        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                          {payments.length === 0
                            ? 'Payments will appear here once transactions are processed.'
                            : 'Try adjusting your search or status filter.'}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                paged.map((p) => {
                  const emoji = getMethodEmoji(p.paymentMethod)
                  return (
                    <TableRow
                      key={p.id}
                      onClick={() => setSelected(p)}
                      className="cursor-pointer transition-colors glass-card-hover"
                      style={{ borderBottomColor: 'var(--surface-3)' }}
                    >
                      <TableCell className="font-mono text-xs" style={{ color: 'var(--text-primary)' }}>
                        {p.reference}
                      </TableCell>
                      <TableCell style={{ color: 'var(--text-primary)' }}>
                        <div className="flex flex-col">
                          <span className="font-medium">{getContestantName(p)}</span>
                          {p.contestant?.category && (
                            <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                              {p.contestant.category}
                              {p.contestant.platform ? ` · ${p.contestant.platform}` : ''}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell style={{ color: 'var(--text-muted)' }}>
                        {p.voterName || '—'}
                      </TableCell>
                      <TableCell className="font-semibold text-right" style={{ color: 'var(--text-primary)' }}>
                        {formatCurrency(p.amount)}
                      </TableCell>
                      <TableCell style={{ color: 'var(--text-muted)' }}>
                        <span className="inline-flex items-center gap-1.5">
                          {emoji && <span aria-hidden>{emoji}</span>}
                          <span className="capitalize">{p.paymentMethod}</span>
                        </span>
                      </TableCell>
                      <TableCell>{paymentStatusBadge(p.status)}</TableCell>
                      <TableCell className="text-sm" style={{ color: 'var(--text-muted)' }}>
                        {new Date(p.date).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </TableCell>
                      <TableCell className="text-right">
                        <span
                          className="inline-flex items-center justify-center w-8 h-8 rounded-full"
                          style={{ background: 'rgba(245,158,11,0.12)' }}
                        >
                          <Eye className="w-4 h-4" style={{ color: '#F59E0B' }} />
                        </span>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>

          {/* Footer — summary + pagination controls */}
          {!loading && filtered.length > 0 && (
            <div
              className="px-4 py-3 border-t flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between text-xs"
              style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}
            >
              <div>
                Total:{' '}
                <span style={{ color: '#F59E0B', fontWeight: 600 }}>
                  {formatCurrency(filteredTotal)}
                </span>{' '}
                across <span style={{ color: 'var(--text-muted)' }}>{filtered.length}</span> payments{' '}
                (showing <span style={{ color: 'var(--text-muted)' }}>{paged.length}</span>)
              </div>
              <div className="flex items-center gap-3">
                <span>
                  Showing <span style={{ color: 'var(--text-muted)' }}>{startIdx}–{endIdx}</span> of{' '}
                  <span style={{ color: 'var(--text-muted)' }}>{filtered.length}</span>
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage === 0}
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    className="h-8 rounded-full"
                    style={{
                      borderColor: 'var(--border-subtle)',
                      color: 'var(--text-primary)',
                      background: 'var(--surface-3)',
                    }}
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    Prev
                  </Button>
                  <span className="text-xs px-2" style={{ color: 'var(--text-muted)' }}>
                    {currentPage + 1} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage >= totalPages - 1}
                    onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                    className="h-8 rounded-full"
                    style={{
                      borderColor: 'var(--border-subtle)',
                      color: 'var(--text-primary)',
                      background: 'var(--surface-3)',
                    }}
                  >
                    Next
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* Detail Dialog */}
      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent
          className="sm:max-w-lg glass-premium"
          style={{
            background: 'var(--surface-1)',
            borderColor: 'var(--border-subtle)',
            color: 'var(--text-primary)',
          }}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <CreditCard className="w-5 h-5" style={{ color: '#F59E0B' }} />
              Payment Details
            </DialogTitle>
            <DialogDescription style={{ color: 'var(--text-muted)' }}>
              Full payment information for this transaction.
            </DialogDescription>
          </DialogHeader>

          {selected && (
            <div className="space-y-4">
              {/* Status + amount summary */}
              <div
                className="flex items-center justify-between p-4 rounded-xl"
                style={{ background: 'var(--surface-3)', border: '1px solid var(--border-subtle)' }}
              >
                <div>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    Amount
                  </p>
                  <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                    {formatCurrency(selected.amount)}
                  </p>
                </div>
                {paymentStatusBadge(selected.status)}
              </div>

              {/* Detail rows */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <DetailField label="Reference" value={selected.reference} mono />
                <DetailField
                  label="Contestant"
                  value={
                    selected.contestant?.name ||
                    selected.voterName ||
                    selected.contestantId ||
                    '—'
                  }
                />
                <DetailField
                  label="Contestant Category"
                  value={selected.contestant?.category || '—'}
                />
                <DetailField
                  label="Contestant Platform"
                  value={selected.contestant?.platform || '—'}
                />
                <DetailField label="Voter Name" value={selected.voterName || '—'} />
                <DetailField label="Voter Email" value={selected.voterEmail || '—'} />
                <DetailField
                  label="Voter Phone"
                  value={(selected as PaymentItem & { voterPhone?: string | null }).voterPhone || '—'}
                />
                <DetailField
                  label="Source Platform"
                  value={selected.sourcePlatform || '—'}
                />
                <DetailField
                  label="Payment Method"
                  value={selected.paymentMethod}
                />
                <DetailField
                  label="Idempotency Key"
                  value={
                    (selected as PaymentItem & { idempotencyKey?: string | null }).idempotencyKey ||
                    '—'
                  }
                  mono
                />
                <DetailField
                  label="Created At"
                  value={new Date(selected.createdAt).toLocaleString()}
                />
                <DetailField
                  label="Payment Date"
                  value={new Date(selected.date).toLocaleString()}
                />
              </div>

              <div className="flex justify-end pt-2">
                <DialogClose asChild>
                  <Button
                    variant="outline"
                    className="rounded-full"
                    style={{
                      borderColor: 'var(--border-strong)',
                      color: 'var(--text-primary)',
                      background: 'transparent',
                    }}
                  >
                    Close
                  </Button>
                </DialogClose>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function DetailField({
  label,
  value,
  mono,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div
      className="p-3 rounded-lg"
      style={{ background: 'var(--surface-3)', border: '1px solid var(--border-subtle)' }}
    >
      <p className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
        {label}
      </p>
      <p
        className={`mt-1 text-sm break-words ${mono ? 'font-mono text-xs' : ''}`}
        style={{ color: 'var(--text-primary)' }}
      >
        {value}
      </p>
    </div>
  )
}
