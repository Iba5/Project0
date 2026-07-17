"use client"

import { useQuery } from "@tanstack/react-query"
import type { ReactNode } from "react"
import {
  Activity,
  BadgeDollarSign,
  CalendarRange,
  TrendingUp,
  Users,
  Vote,
} from "lucide-react"

import { AppShell } from "@/components/app-shell"
import { EmptyState } from "@/components/empty-state"
import { ErrorState } from "@/components/error-state"
import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { api, getApiError } from "@/lib/api"
import type { DashboardSummary, PaymentRecord } from "@/lib/types"

// Formats a payment's numeric cent value to a locale currency string at render time.
function formatAmount(payment: PaymentRecord) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: payment.currency || "USD",
  }).format(payment.amountCents / 100)
}

// Fetches the dashboard overview and renders summary, activity, and payments.
export function DashboardPage() {
  const query = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: async () => (await api.get<DashboardSummary>("/dashboard")).data,
  })

  return (
    <AppShell>
      <div className="admin-grid">
        <PageHeader
          eyebrow="Overview"
          title="Dashboard"
          description="Track the active event, live revenue, participation, and operational activity in one place."
          actions={
            <Badge variant="outline" className="gap-1.5 px-3 py-1.5 text-xs">
              <TrendingUp className="size-3.5" />
              Live data
            </Badge>
          }
        />
        {query.isLoading ? <DashboardSkeleton /> : null}
        {query.error ? (
          <ErrorState {...getApiError(query.error)} onRetry={() => query.refetch()} />
        ) : null}
        {query.data ? <DashboardContent data={query.data} /> : null}
      </div>
    </AppShell>
  )
}

// Renders the main dashboard cards and transactional tables.
function DashboardContent({ data }: { data: DashboardSummary }) {
  return (
    <div className="admin-grid">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Active Event"
          value={data.activeEvent}
          description="Current competition in focus"
          icon={<CalendarRange className="size-4" />}
        />
        <MetricCard
          title="Total Participants"
          value={data.totalParticipants.toLocaleString()}
          description="Contestants enrolled in the platform"
          icon={<Users className="size-4" />}
        />
        <MetricCard
          title="Total Votes"
          value={data.totalVotes.toLocaleString()}
          description="Total votes recorded"
          icon={<Vote className="size-4" />}
        />
        <MetricCard
          title="Total Revenue"
          value={data.totalRevenue}
          description="Processed payments and settlement totals"
          icon={<BadgeDollarSign className="size-4" />}
        />
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="glass-panel">
          <CardHeader>
            <CardTitle>Recent Payments</CardTitle>
          </CardHeader>
          <CardContent>
            {data.recentPayments.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Reference</TableHead>
                    <TableHead>Contestant</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.recentPayments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell className="font-medium">{payment.reference}</TableCell>
                      <TableCell>{payment.contestant}</TableCell>
                      <TableCell>{formatAmount(payment)}</TableCell>
                      <TableCell>
                        <PaymentStatusBadge status={payment.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <EmptyState
                title="No payments yet"
                message="Payment records will appear here once transactions are processed."
              />
            )}
          </CardContent>
        </Card>
        <Card className="glass-panel">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.recentActivity.length ? (
              data.recentActivity.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start gap-3 rounded-2xl border border-border/60 bg-background/60 p-4"
                >
                  <div className="rounded-full bg-primary/10 p-2 text-primary">
                    <Activity className="size-4" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">{item.title}</p>
                    <p className="text-sm text-muted-foreground">{item.detail}</p>
                    <p className="text-xs text-muted-foreground">{item.time}</p>
                  </div>
                </div>
              ))
            ) : (
              <EmptyState
                title="No activity recorded"
                message="Recent activity will appear here as events occur."
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// Renders a single metric card with an icon, label, and supporting text.
function MetricCard({
  title,
  value,
  description,
  icon,
}: {
  title: string
  value: string
  description: string
  icon: ReactNode
}) {
  return (
    <Card className="glass-panel">
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">{title}</p>
          <CardTitle className="text-2xl">{value}</CardTitle>
        </div>
        <div className="rounded-xl bg-primary/10 p-2 text-primary">{icon}</div>
      </CardHeader>
      <CardContent className="pb-5 text-sm text-muted-foreground">{description}</CardContent>
    </Card>
  )
}

// Maps payment status values to readable color treatments.
function PaymentStatusBadge({ status }: { status: PaymentRecord["status"] }) {
  const variant =
    status === "Successful" ? "default" : status === "Pending" ? "secondary" : "destructive"

  return <Badge variant={variant}>{status}</Badge>
}

// Displays the dashboard skeleton while the query is still loading.
function DashboardSkeleton() {
  return (
    <div className="admin-grid">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card className="glass-panel" key={index}>
            <CardHeader className="space-y-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-40" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-4 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="glass-panel">
          <CardHeader>
            <Skeleton className="h-5 w-40" />
          </CardHeader>
          <CardContent className="space-y-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-12 w-full" />
            ))}
          </CardContent>
        </Card>
        <Card className="glass-panel">
          <CardHeader>
            <Skeleton className="h-5 w-36" />
          </CardHeader>
          <CardContent className="space-y-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-20 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
