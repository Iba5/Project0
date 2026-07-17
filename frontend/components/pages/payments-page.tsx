"use client"

import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { BadgeDollarSign } from "lucide-react"

import { AppShell } from "@/components/app-shell"
import { EmptyState } from "@/components/empty-state"
import { ErrorState } from "@/components/error-state"
import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { api, getApiError } from "@/lib/api"
import type { PaymentRecord } from "@/lib/types"

// Surfaces payment history with a simple status filter and clear totals.
export function PaymentsPage() {
  const query = useQuery({
    queryKey: ["payments"],
    queryFn: async () => (await api.get<{ items: PaymentRecord[] }>("/payments")).data.items,
  })
  const [status, setStatus] = useState<"All" | PaymentRecord["status"]>("All")

  const filtered = useMemo(
    () => (query.data ?? []).filter((payment) => status === "All" || payment.status === status),
    [query.data, status]
  )

  return (
    <AppShell>
      <div className="admin-grid">
        <PageHeader
          eyebrow="Revenue"
          title="Payments"
          description="Track payment references, contestants, methods, status, and timing without leaving the dashboard."
          actions={<Badge variant="outline" className="gap-1.5"><BadgeDollarSign className="size-3.5" />Transaction log</Badge>}
        />
        <Card className="glass-panel">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Payments are read through `/api/payments` so the backend can own all settlement state.
            </p>
            <select
              aria-label="Filter payments by status"
              className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
              value={status}
              onChange={(event) => setStatus(event.target.value as typeof status)}
            >
              <option>All</option>
              <option>Pending</option>
              <option>Successful</option>
              <option>Failed</option>
            </select>
          </CardContent>
        </Card>
        {query.isLoading ? <PaymentsSkeleton /> : null}
        {query.error ? <ErrorState {...getApiError(query.error)} onRetry={() => query.refetch()} /> : null}
        {filtered.length ? (
          <Card className="glass-panel">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Reference</TableHead>
                    <TableHead>Contestant</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell className="font-medium">{payment.reference}</TableCell>
                      <TableCell>{payment.contestant}</TableCell>
                      <TableCell>{payment.amount}</TableCell>
                      <TableCell>{payment.paymentMethod}</TableCell>
                      <TableCell>
                        <PaymentBadge status={payment.status} />
                      </TableCell>
                      <TableCell>{new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(payment.date))}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ) : (
          <EmptyState title="No payments match the filter" message="Use another status or wait for the backend to return more records." />
        )}
      </div>
    </AppShell>
  )
}

// Maps payment states to the badge styling used across the app.
function PaymentBadge({ status }: { status: PaymentRecord["status"] }) {
  const variant = status === "Successful" ? "default" : status === "Pending" ? "secondary" : "destructive"
  return <Badge variant={variant}>{status}</Badge>
}

// Displays the payment list skeleton while data is loading.
function PaymentsSkeleton() {
  return (
    <Card className="glass-panel">
      <CardContent className="space-y-3 p-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-12 w-full" />
        ))}
      </CardContent>
    </Card>
  )
}
