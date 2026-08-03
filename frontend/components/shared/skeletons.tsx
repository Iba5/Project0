'use client'

import { Skeleton } from '@/components/ui/skeleton'

/**
 * Reusable skeleton loaders that match the layout of real cards/rows.
 * All use the existing shadcn Skeleton component plus the
 * `.skeleton-shimmer-enhanced` utility class for a gold-tinted shimmer.
 *
 * Usage:
 *   {loading ? <ContestantCardSkeleton /> : <ContestantCard />}
 *   {loading ? <DashboardSkeleton /> : <DashboardView />}
 */

// ─── Contestant Card Skeleton ────────────────────────────────────
// Matches the contestant grid card layout (avatar/image + name + badges + votes + button)
export function ContestantCardSkeleton() {
  return (
    <div className="dark-card rounded-2xl overflow-hidden skeleton-shimmer-enhanced skeleton-wave">
      {/* Image area */}
      <Skeleton className="w-full aspect-[4/5] rounded-none bg-transparent" />
      <div className="p-4 space-y-3">
        <Skeleton className="h-5 w-3/4" />
        <div className="flex gap-2">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-6 w-12 rounded-full" />
        </div>
        <Skeleton className="h-9 w-full rounded-full" />
      </div>
    </div>
  )
}

// ─── Leaderboard Row Skeleton ────────────────────────────────────
// Matches the leaderboard list row layout (rank + avatar + name + votes)
export function LeaderboardRowSkeleton() {
  return (
    <div className="dark-card rounded-xl p-4 flex items-center gap-4 skeleton-shimmer-enhanced skeleton-wave">
      <Skeleton className="size-10 rounded-full shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-20" />
      </div>
      <Skeleton className="h-5 w-16" />
    </div>
  )
}

// ─── Event Card Skeleton ────────────────────────────────────────
// Matches the public Events view card layout (banner + name + description + badges + button)
export function EventCardSkeleton() {
  return (
    <div className="dark-card rounded-2xl overflow-hidden skeleton-shimmer-enhanced skeleton-wave">
      <Skeleton className="w-full aspect-video rounded-none" />
      <div className="p-4 md:p-6 space-y-3">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
        <div className="flex gap-2 pt-1">
          <Skeleton className="h-6 w-24 rounded-full" />
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
        <Skeleton className="h-10 w-full rounded-full" />
      </div>
    </div>
  )
}

// ─── Stat Card Skeleton ─────────────────────────────────────────
// Matches admin dashboard stat cards (icon + label + value + trend)
export function StatCardSkeleton() {
  return (
    <div className="dark-card rounded-xl p-5 skeleton-shimmer-enhanced skeleton-wave">
      <div className="flex items-start justify-between mb-3">
        <div className="space-y-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-7 w-24" />
        </div>
        <Skeleton className="size-10 rounded-lg" />
      </div>
      <Skeleton className="h-3 w-32" />
    </div>
  )
}

// ─── Table Skeleton ─────────────────────────────────────────────
// Matches the admin table layout (header row + N body rows with X columns)
export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="dark-card rounded-xl overflow-hidden skeleton-shimmer-enhanced skeleton-wave">
      {/* Header */}
      <div
        className="grid gap-4 px-4 py-3 border-b"
        style={{
          gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
          borderColor: 'var(--border-subtle)',
        }}
      >
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={`h-${i}`} className="h-3 w-24" />
        ))}
      </div>
      {/* Body */}
      <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
        {Array.from({ length: rows }).map((_, r) => (
          <div
            key={`r-${r}`}
            className="grid gap-4 px-4 py-3.5"
            style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: cols }).map((_, c) => (
              <Skeleton key={`c-${r}-${c}`} className="h-4 w-full" />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Compare Card Skeleton ──────────────────────────────────────
// Matches the comparison card layout used in CompareView
export function CompareCardSkeleton() {
  return (
    <div className="dark-card rounded-2xl p-6 space-y-4 skeleton-shimmer-enhanced skeleton-wave">
      <div className="flex flex-col items-center gap-3">
        <Skeleton className="size-20 rounded-full" />
        <Skeleton className="h-6 w-28" />
        <div className="flex gap-2">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      </div>
      <Skeleton className="h-8 w-20 mx-auto" />
      <Skeleton className="h-2.5 w-full rounded-full" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-10 w-full rounded-full" />
    </div>
  )
}

// ─── Top Voter Row Skeleton ─────────────────────────────────────
// Matches the TopVotersView leaderboard row layout
export function TopVoterRowSkeleton() {
  return (
    <div
      className="rounded-xl p-4 sm:p-5 flex items-center gap-4 skeleton-shimmer-enhanced skeleton-wave"
      style={{
        background: 'var(--surface-elevated)',
        border: '1px solid var(--border-subtle)',
      }}
    >
      <Skeleton className="size-10 rounded-full shrink-0" />
      <Skeleton className="size-10 rounded-full shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-20 rounded-full" />
      </div>
      <div className="hidden sm:flex items-center gap-4">
        <Skeleton className="h-6 w-12" />
        <Skeleton className="h-6 w-12" />
      </div>
    </div>
  )
}

// ─── Full Dashboard Skeleton ────────────────────────────────────
// Used by the admin dashboard while initial data is loading
export function DashboardSkeleton() {
  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>

      {/* Stat cards row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="dark-card rounded-xl p-5 space-y-3 lg:col-span-2 skeleton-shimmer-enhanced skeleton-wave">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-64 w-full" />
        </div>
        <div className="dark-card rounded-xl p-5 space-y-3 skeleton-shimmer-enhanced skeleton-wave">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>

      {/* Recent activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="dark-card rounded-xl p-5 space-y-3 skeleton-shimmer-enhanced skeleton-wave">
          <Skeleton className="h-5 w-40" />
          <TableSkeleton rows={4} cols={3} />
        </div>
        <div className="dark-card rounded-xl p-5 space-y-3 skeleton-shimmer-enhanced skeleton-wave">
          <Skeleton className="h-5 w-40" />
          <TableSkeleton rows={4} cols={3} />
        </div>
      </div>
    </div>
  )
}
