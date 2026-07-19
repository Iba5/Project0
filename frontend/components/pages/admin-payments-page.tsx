'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { ShieldCheck, Info, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { listPayments, type PaymentApi } from '@/lib/api'
import type { PaymentStatus } from '@/lib/types'

const statusOptions = ['All', 'Paid', 'Pending', 'Processing', 'Failed', 'Cancelled', 'Refunded', 'Expired']
const methodOptions = ['All', 'EcoCash', 'OneMoney', 'InnBucks', 'Omari', 'Zimswitch', 'Visa', 'Mastercard', 'PayPal', 'Apple Pay', 'Google Pay']

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

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function AdminPaymentsPage() {
  const [payments, setPayments] = useState<PaymentApi[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('All')
  const [methodFilter, setMethodFilter] = useState('All')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const fetchPayments = useCallback(async () => {
    try {
      const result = await listPayments()
      setPayments(result)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to fetch payments')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPayments()
  }, [fetchPayments])

  const filtered = useMemo(() => {
  if (!Array.isArray(payments)) return [];

  const sorted = [...payments].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  return sorted.filter((p) => {
    if (statusFilter !== 'All' && p.status !== statusFilter) return false;
    if (methodFilter !== 'All' && p.paymentMethod !== methodFilter)
      return false;
    if (dateFrom && new Date(p.date) < new Date(dateFrom)) return false;
    if (dateTo && new Date(p.date) > new Date(`${dateTo}T23:59:59`))
      return false;

    return true;
  });
}, [payments, statusFilter, methodFilter, dateFrom, dateTo]);

  if (loading) {
    return (
      <>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      </>
    )
  }

  return (
    <>
      <motion.div
        className="space-y-6 max-w-6xl"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
      >
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">Payments</h1>
              <Badge variant="outline" className="text-xs gap-1">
                <ShieldCheck className="size-3" />
                Immutable Record
              </Badge>
            </div>
          </div>
        </div>

        {/* Info callout */}
        <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3">
          <Info className="size-4 text-muted-foreground mt-0.5 shrink-0" />
          <p className="text-sm text-muted-foreground">
            Payment records are permanent and cannot be modified. This ensures
            vote integrity and audit compliance.
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={methodFilter} onValueChange={setMethodFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Method" />
            </SelectTrigger>
            <SelectContent>
              {methodOptions.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-[150px]"
            placeholder="From"
          />
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-[150px]"
            placeholder="To"
          />
        </div>

        {/* Table — NO action column */}
        <div className="border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
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
                {filtered.map((p) => (
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
                    <TableCell className="text-sm text-muted-foreground hidden sm:table-cell">
                      {p.paymentMethod}
                    </TableCell>
                    <TableCell>{paymentStatusBadge(p.status)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground hidden md:table-cell">
                      {formatDate(p.date)}
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center text-sm text-muted-foreground py-8"
                    >
                      No payments match the current filters.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </motion.div>
    </>
  )
}