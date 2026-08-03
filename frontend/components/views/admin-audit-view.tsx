'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  ScrollText,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Activity,
  Users,
  LogIn,
  AlertTriangle,
  Inbox,
  Download,
} from 'lucide-react'
import { listAuditLogs, type AuditLogEntry } from '@/lib/audit-api'
import { apiUrl } from '@/lib/api-client'
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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { toast } from 'sonner'

const PAGE_SIZE = 25

// Distinct action categories surfaced in the filter dropdown. The audit API
// accepts any free-form string, so we pass the raw value through as-is.
const ACTION_FILTERS: Array<{ label: string; value: string }> = [
  { label: 'All Actions', value: 'all' },
  { label: 'Login', value: 'Login' },
  { label: 'Logout', value: 'Logout' },
  { label: 'Create Event', value: 'Create Event' },
  { label: 'Update Participant', value: 'Update Participant' },
  { label: 'Approve Participant', value: 'Approve Participant' },
  { label: 'Delete Participant', value: 'Delete Participant' },
  { label: 'Failed Login', value: 'Failed Login' },
  { label: 'Update Settings', value: 'Update Settings' },
]

// Color-coded badge for an audit action — picks the closest semantic match.
function actionBadge(action: string) {
  const a = (action || '').toLowerCase()
  let className = 'bg-slate-500/15 text-slate-300 border-slate-500/30'
  if (a.includes('login')) {
    className = 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
  } else if (a.includes('logout')) {
    className = 'bg-slate-500/15 text-slate-300 border-slate-500/30'
  } else if (a.includes('create')) {
    className = 'bg-blue-500/15 text-blue-400 border-blue-500/30'
  } else if (a.includes('update') || a.includes('edit')) {
    className = 'bg-amber-500/15 text-amber-400 border-amber-500/30'
  } else if (a.includes('delete') || a.includes('failed')) {
    className = 'bg-red-500/15 text-red-400 border-red-500/30'
  } else if (a.includes('approve')) {
    className = 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
  } else if (a.includes('settings') || a.includes('config')) {
    className = 'bg-purple-500/15 text-purple-400 border-purple-500/30'
  }
  return (
    <Badge variant="outline" className={`whitespace-nowrap ${className}`}>
      {action || 'Unknown'}
    </Badge>
  )
}

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    return (
      d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }) +
      ' ' +
      d.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })
    )
  } catch {
    return iso
  }
}

function truncate(text: string | null, max = 80): string {
  if (!text) return '—'
  if (text.length <= max) return text
  return text.slice(0, max).trimEnd() + '…'
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  delay,
  loading,
}: {
  label: string
  value: number | string
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
  color: string
  delay: number
  loading: boolean
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
      className="h-full"
    >
      <div
        className="rounded-xl border p-4 h-full flex items-center gap-3 hover-lift"
        style={{
          background: 'var(--surface-1)',
          borderColor: 'var(--border-subtle)',
        }}
      >
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: `${color}20` }}
        >
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
            {label}
          </p>
          {loading ? (
            <Skeleton className="h-6 w-16 mt-1" style={{ background: 'var(--border-subtle)' }} />
          ) : (
            <p className="text-xl font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>
              {value}
            </p>
          )}
        </div>
      </div>
    </motion.div>
  )
}

export function AdminAuditView() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [actionFilter, setActionFilter] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    listAuditLogs({ limit: 200, offset: 0 })
      .then(({ logs }) => {
        if (cancelled) return
        setLogs(logs)
      })
      .catch((err) => {
        if (cancelled) return
        const msg = err instanceof Error ? err.message : 'Failed to load audit logs'
        setError(msg)
        toast.error(msg)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Reset to first page whenever the active filters change.
  useEffect(() => {
    setPage(0)
  }, [actionFilter, search])

  // Apply action filter + free-text search across name, email, details, IP.
  const filtered = useMemo(() => {
  const q = search.trim().toLowerCase()
  const safeLogs = logs || []; // Fallback here
  
  return safeLogs.filter((log) => {
    if (actionFilter !== 'all' && log.action !== actionFilter) return false
      const haystack = [
        log.action,
        log.details ?? '',
        log.ipAddress ?? '',
        log.user?.name ?? '',
        log.user?.email ?? '',
      ]
        .join(' ')
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [logs, actionFilter, search])

  // Pagination metadata.
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages - 1)
  const pageStart = currentPage * PAGE_SIZE
  const pageEnd = Math.min(pageStart + PAGE_SIZE, filtered.length)
  const pageItems = filtered.slice(pageStart, pageEnd)

// Aggregate summary stats (last 30 days only).
const stats = useMemo(() => {
  const safeLogs = Array.isArray(logs) ? logs : []
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000
  const recent = safeLogs.filter((l) => l?.timestamp && new Date(l.timestamp).getTime() >= thirtyDaysAgo)
  
  const uniqueUsers = new Set(
    recent
      .map((l) => l?.user?.email)
      .filter((e): e is string => Boolean(e))
  ).size

  const loginEvents = recent.filter((l) =>
    (l?.action || '').toLowerCase().includes('login')
  ).length

  const failedOrDelete = recent.filter((l) => {
    const a = (l?.action || '').toLowerCase()
    return a.includes('failed') || a.includes('delete')
  }).length

  return {
    total: recent.length,
    uniqueUsers,
    loginEvents,
    failedActions: failedOrDelete,
  }
}, [logs])

  // Trigger a server-side CSV download from /api/audit-logs?format=csv.
  // Use fetch with credentials to ensure cookies are sent, then create download link.
  const handleExportCsv = async () => {
    try {
      const params = new URLSearchParams()
      params.set('format', 'csv')
      if (actionFilter !== 'all') params.set('action', actionFilter)
      
      const res = await fetch(apiUrl(`/audit-logs?${params.toString()}`), {
        credentials: 'include'
      })
      
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || 'Failed to export CSV')
      }
      
      const text = await res.text()
      const blob = new Blob([text], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `vibehub-audit-logs-${new Date().toISOString().slice(0, 10)}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      toast.success('CSV exported')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to export CSV')
    }
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
          <ScrollText className="w-6 h-6" style={{ color: '#F59E0B' }} />
          Audit Logs
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          Track all admin activities and system events
        </p>
      </motion.div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">
        <StatCard
          label="Logs (30 days)"
          value={stats.total}
          icon={Activity}
          color="#F59E0B"
          delay={0.05}
          loading={loading}
        />
        <StatCard
          label="Unique Users"
          value={stats.uniqueUsers}
          icon={Users}
          color="#10B981"
          delay={0.1}
          loading={loading}
        />
        <StatCard
          label="Login Events"
          value={stats.loginEvents}
          icon={LogIn}
          color="#3B82F6"
          delay={0.15}
          loading={loading}
        />
        <StatCard
          label="Failed / Delete"
          value={stats.failedActions}
          icon={ShieldAlert}
          color="#EF4444"
          delay={0.2}
          loading={loading}
        />
      </div>

      {/* Filter bar */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15 }}
        className="flex flex-col sm:flex-row sm:items-center gap-3"
      >
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 shrink-0" style={{ color: 'var(--text-muted)' }} />
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger
              className="w-full sm:w-52 rounded-xl border-none"
              style={{ background: 'var(--surface-1)', color: 'var(--text-primary)' }}
            >
              <SelectValue placeholder="Filter by action" />
            </SelectTrigger>
            <SelectContent
              className="rounded-xl border"
              style={{ background: 'var(--surface-2)', borderColor: 'var(--border-subtle)' }}
            >
              {ACTION_FILTERS.map((opt) => (
                <SelectItem
                  key={opt.value}
                  value={opt.value}
                  style={{ color: 'var(--text-primary)' }}
                >
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="relative flex-1">
          <Search
            className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: 'var(--text-muted)' }}
          />
          <Input
            placeholder="Search by user, IP, or details…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 rounded-xl border-none"
            style={{ background: 'var(--surface-1)', color: 'var(--text-primary)' }}
          />
        </div>

        <Button
          onClick={handleExportCsv}
          disabled={loading || !logs || logs.length === 0}
          className="rounded-full shrink-0 self-start sm:self-auto"
          style={{
            background: '#F59E0B',
            color: 'var(--surface-3)',
            fontWeight: 600,
          }}
        >
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </Button>
      </motion.div>

      {/* Table card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.25 }}
        className="rounded-xl border overflow-hidden table-row-hover"
        style={{
          background: 'var(--surface-1)',
          borderColor: 'var(--border-subtle)',
        }}
      >
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow
                style={{
                  background: 'var(--surface-3)',
                  borderBottomColor: 'var(--border-subtle)',
                }}
              >
                <TableHead style={{ color: 'var(--text-muted)' }} className="min-w-[160px]">Timestamp</TableHead>
                <TableHead style={{ color: 'var(--text-muted)' }} className="min-w-[180px]">User</TableHead>
                <TableHead style={{ color: 'var(--text-muted)' }} className="min-w-[160px]">Action</TableHead>
                <TableHead style={{ color: 'var(--text-muted)' }} className="min-w-[140px]">IP Address</TableHead>
                <TableHead style={{ color: 'var(--text-muted)' }} className="min-w-[260px]">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                [...Array(8)].map((_, i) => (
                  <TableRow key={`skeleton-${i}`} style={{ borderBottomColor: 'var(--surface-3)' }}>
                    <TableCell colSpan={5} className="py-3">
                      <Skeleton className="h-6 w-full" style={{ background: 'var(--surface-3)' }} />
                    </TableCell>
                  </TableRow>
                ))
              ) : pageItems.length === 0 ? (
                <TableRow style={{ borderBottomColor: 'transparent' }}>
                  <TableCell colSpan={5} className="py-16">
                    <div className="flex flex-col items-center justify-center text-center">
                      <div
                        className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3"
                        style={{
                          background: 'rgba(245,158,11,0.08)',
                          boxShadow: '0 0 0 6px rgba(245,158,11,0.04)',
                        }}
                      >
                        <Inbox className="w-7 h-7" style={{ color: '#F59E0B' }} />
                      </div>
                      <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                        No audit logs found
                      </p>
                      <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                        {error
                          ? error
                          : filtered.length === 0 && logs.length > 0
                            ? 'Try adjusting your filters or search query.'
                            : 'Audit events will appear here as admins use the platform.'}
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                pageItems.map((log, idx) => {
                  const ip = log.ipAddress || '—'
                  const details = log.details
                  return (
                    <motion.tr
                      key={log.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25, delay: Math.min(idx * 0.02, 0.3) }}
                      style={{
                        borderBottomColor: 'var(--surface-3)',
                        background: idx % 2 === 0 ? 'transparent' : 'var(--surface-3)',
                      }}
                    >
                      <TableCell className="py-3">
                        <span className="text-xs tabular-nums" style={{ color: 'var(--text-muted)' }}>
                          {formatTimestamp(log.timestamp)}
                        </span>
                      </TableCell>
                      <TableCell className="py-3">
                        {log.user ? (
                          <div className="flex flex-col leading-tight">
                            <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                              {log.user.name}
                            </span>
                            <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                              {log.user.email}
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
                            <span className="text-xs italic" style={{ color: 'var(--text-muted)' }}>
                              Anonymous
                            </span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="py-3">{actionBadge(log.action)}</TableCell>
                      <TableCell className="py-3">
                        <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                          {ip}
                        </span>
                      </TableCell>
                      <TableCell className="py-3">
                        {details ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span
                                className="text-xs cursor-help"
                                style={{ color: 'var(--text-secondary)' }}
                              >
                                {truncate(details)}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent
                              className="max-w-md text-xs leading-relaxed"
                              style={{
                                background: 'var(--surface-elevated)',
                                color: 'var(--text-primary)',
                                border: '1px solid var(--border-subtle)',
                              }}
                            >
                              {details}
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            —
                          </span>
                        )}
                      </TableCell>
                    </motion.tr>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination footer */}
        <div
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3"
          style={{ borderTop: '1px solid var(--border-subtle)' }}
        >
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {loading
              ? 'Loading…'
              : filtered.length === 0
                ? 'Showing 0 of 0'
                : `Showing ${pageStart + 1}–${pageEnd} of ${filtered.length}`}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={loading || currentPage === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="rounded-lg gap-1"
              style={{ color: 'var(--text-muted)' }}
            >
              <ChevronLeft className="w-4 h-4" /> Prev
            </Button>
            <span className="text-xs tabular-nums px-2" style={{ color: 'var(--text-muted)' }}>
              Page {currentPage + 1} / {totalPages}
            </span>
            <Button
              variant="ghost"
              size="sm"
              disabled={loading || currentPage >= totalPages - 1}
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              className="rounded-lg gap-1"
              style={{ color: 'var(--text-muted)' }}
            >
              Next <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

export default AdminAuditView
