"use client"

import { useMemo, useState, type ReactNode } from "react"
import { useQuery } from "@tanstack/react-query"
import { ExternalLink, Filter, Search } from "lucide-react"

import { AppShell } from "@/components/app-shell"
import { EmptyState } from "@/components/empty-state"
import { ErrorState } from "@/components/error-state"
import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { api, getApiError } from "@/lib/api"
import type { ParticipantRecord } from "@/lib/types"

const pageSize = 4

// Lets operators search, filter, and page through contestant records.
export function ParticipantsPage() {
  const query = useQuery({
    queryKey: ["participants"],
    queryFn: async () => (await api.get<{ items: ParticipantRecord[] }>("/participants")).data.items,
  })
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState<"All" | ParticipantRecord["status"]>("All")
  const [platform, setPlatform] = useState<"All" | ParticipantRecord["platform"]>("All")
  const [page, setPage] = useState(1)
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedParticipant, setSelectedParticipant] = useState<ParticipantRecord | null>(null)

  const filtered = useMemo(() => {
    const items = query.data ?? []

    return items.filter((participant) => {
      const matchesSearch =
        participant.name.toLowerCase().includes(search.toLowerCase()) ||
        participant.category.toLowerCase().includes(search.toLowerCase())
      const matchesStatus = status === "All" || participant.status === status
      const matchesPlatform = platform === "All" || participant.platform === platform
      return matchesSearch && matchesStatus && matchesPlatform
    })
  }, [platform, query.data, search, status])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentItems = filtered.slice((page - 1) * pageSize, page * pageSize)

  // Opens the participant detail drawer for a selected contestant.
  function openDetail(participant: ParticipantRecord) {
    setSelectedParticipant(participant)
    setDetailOpen(true)
  }

  return (
    <AppShell>
      <div className="admin-grid">
        <PageHeader
          eyebrow="Contestants"
          title="Participants"
          description="Monitor contestant status, platform, and vote totals with search and filtering."
          actions={<Badge variant="outline">Pagination enabled</Badge>}
        />
        <Card className="glass-panel">
          <CardContent className="grid gap-3 p-4 lg:grid-cols-[1.5fr_1fr_1fr_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search contestants or categories"
                className="pl-9"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value)
                  setPage(1)
                }}
              />
            </div>
            <select
              aria-label="Filter participants by status"
              className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as typeof status)
                setPage(1)
              }}
            >
              <option>All</option>
              <option>Active</option>
              <option>Pending</option>
              <option>Suspended</option>
            </select>
            <select
              aria-label="Filter participants by platform"
              className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
              value={platform}
              onChange={(event) => {
                setPlatform(event.target.value as typeof platform)
                setPage(1)
              }}
            >
              <option>All</option>
              <option>TikTok</option>
              <option>Facebook</option>
              <option>Instagram</option>
              <option>YouTube</option>
            </select>
            <Button type="button" variant="outline" onClick={() => {
              setSearch("")
              setStatus("All")
              setPlatform("All")
              setPage(1)
            }}>
              <Filter className="size-4" />
              Reset
            </Button>
          </CardContent>
        </Card>
        {query.isLoading ? <ParticipantsSkeleton /> : null}
        {query.error ? <ErrorState {...getApiError(query.error)} onRetry={() => query.refetch()} /> : null}
        {currentItems.length ? (
          <Card className="glass-panel">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Platform</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Votes</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentItems.map((participant) => (
                    <TableRow key={participant.id}>
                      <TableCell className="font-medium">
                        <div className="space-y-1">
                          <p>{participant.name}</p>
                          <p className="max-w-sm truncate text-xs text-muted-foreground">{participant.videoUrl}</p>
                        </div>
                      </TableCell>
                      <TableCell>{participant.category}</TableCell>
                      <TableCell>{participant.platform}</TableCell>
                      <TableCell>
                        <ParticipantBadge status={participant.status} />
                      </TableCell>
                      <TableCell>{participant.votes.toLocaleString()}</TableCell>
                      <TableCell className="text-right">
                        <Button type="button" variant="ghost" size="icon-sm" onClick={() => openDetail(participant)}>
                          <ExternalLink className="size-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ) : (
          <EmptyState
            title="No matching participants"
            message="Adjust the search or filters to see another slice of the contestant list."
          />
        )}
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" disabled={page === 1} onClick={() => setPage((current) => current - 1)}>
              Previous
            </Button>
            <Button type="button" variant="outline" disabled={page === totalPages} onClick={() => setPage((current) => current + 1)}>
              Next
            </Button>
          </div>
        </div>
      </div>
      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{selectedParticipant?.name}</SheetTitle>
            <SheetDescription>Contestant activity and metadata.</SheetDescription>
          </SheetHeader>
          {selectedParticipant ? (
            <div className="space-y-4 px-4 pb-4">
              <div className="grid gap-3">
                <DetailRow label="Category" value={selectedParticipant.category} />
                <DetailRow label="Platform" value={selectedParticipant.platform} />
                <DetailRow label="Status" value={<ParticipantBadge status={selectedParticipant.status} />} />
                <DetailRow label="Votes" value={selectedParticipant.votes.toLocaleString()} />
              </div>
              <div className="space-y-2 rounded-2xl border border-border/60 bg-muted/30 p-4">
                <p className="text-sm font-medium">Video URL</p>
                <a
                  href={selectedParticipant.videoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="break-all text-sm text-primary hover:underline"
                >
                  {selectedParticipant.videoUrl}
                </a>
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </AppShell>
  )
}

// Uses status badges that stay consistent with the rest of the admin views.
function ParticipantBadge({ status }: { status: ParticipantRecord["status"] }) {
  const variant = status === "Active" ? "default" : status === "Pending" ? "secondary" : "destructive"
  return <Badge variant={variant}>{status}</Badge>
}

// Displays the participant loading skeleton.
function ParticipantsSkeleton() {
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

// Renders a small label-value row for the side drawer.
function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 px-3 py-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  )
}
