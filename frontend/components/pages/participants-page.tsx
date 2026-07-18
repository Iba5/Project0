"use client"

import { useMemo, useState, type ReactNode } from "react"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQuery } from "@tanstack/react-query"
import { ExternalLink, Filter, Pencil, Plus, Search, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { AppShell } from "@/components/app-shell"
import { EmptyState } from "@/components/empty-state"
import { ErrorState } from "@/components/error-state"
import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { api, getApiError } from "@/lib/api"
import { participantSchema, type ParticipantFormValues } from "@/lib/schemas"
import type { ParticipantRecord } from "@/lib/types"

const pageSize = 4

const emptyForm: ParticipantFormValues = {
  name: "",
  category: "",
  platform: "TikTok",
  videoUrl: "",
  status: "Pending",
  votes: 0,
}

// Lets operators search, filter, page, and CRUD contestant records.
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
  const [editorOpen, setEditorOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [selectedParticipant, setSelectedParticipant] = useState<ParticipantRecord | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<ParticipantFormValues>({
    resolver: zodResolver(participantSchema),
    defaultValues: emptyForm,
  })

  const save = useMutation({
    mutationFn: async (values: ParticipantFormValues) =>
      selectedParticipant
        ? (await api.patch(`/participants/${selectedParticipant.id}`, { ...values, id: selectedParticipant.id })).data
        : (await api.post("/participants", values)).data,
    onSuccess: async (data: { message: string }) => {
      toast.success(data.message || "Participant saved.")
      setEditorOpen(false)
      setSelectedParticipant(null)
      reset(emptyForm)
      await query.refetch()
    },
    onError: (error) => {
      const apiError = getApiError(error)
      toast.error(apiError.message, apiError.hint ? { description: apiError.hint } : undefined)
    },
  })

  const remove = useMutation({
    mutationFn: async (id: string) => (await api.delete(`/participants/${id}`)).data,
    onSuccess: async (data: { message: string }) => {
      toast.success(data.message || "Participant removed.")
      setDeleteOpen(false)
      setSelectedParticipant(null)
      await query.refetch()
    },
    onError: (error) => {
      const apiError = getApiError(error)
      toast.error(apiError.message, apiError.hint ? { description: apiError.hint } : undefined)
    },
  })

  const filtered = useMemo(() => {
    const items = query.data ?? []
    return items.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.category.toLowerCase().includes(search.toLowerCase())
      const matchesStatus = status === "All" || p.status === status
      const matchesPlatform = platform === "All" || p.platform === platform
      return matchesSearch && matchesStatus && matchesPlatform
    })
  }, [platform, query.data, search, status])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentItems = filtered.slice((page - 1) * pageSize, page * pageSize)

  function openDetail(participant: ParticipantRecord) {
    setSelectedParticipant(participant)
    setDetailOpen(true)
  }

  function openEditor(participant?: ParticipantRecord) {
    setSelectedParticipant(participant ?? null)
    reset(
      participant
        ? {
            name: participant.name,
            category: participant.category,
            platform: participant.platform,
            videoUrl: participant.videoUrl,
            status: participant.status,
            votes: participant.votes,
          }
        : emptyForm
    )
    setEditorOpen(true)
  }

  function openDeleteDialog(participant: ParticipantRecord) {
    setSelectedParticipant(participant)
    setDeleteOpen(true)
  }

  return (
    <AppShell>
      <div className="admin-grid">
        <PageHeader
          eyebrow="Contestants"
          title="Participants"
          description="Monitor contestant status, platform, and vote totals with search and filtering."
          actions={
            <Button type="button" onClick={() => openEditor()}>
              <Plus className="size-4" />
              Add participant
            </Button>
          }
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
            <Select value={status} onValueChange={(val) => { setStatus(val as typeof status); setPage(1) }}>
              <SelectTrigger aria-label="Filter participants by status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All</SelectItem>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Pending">Pending</SelectItem>
                <SelectItem value="Suspended">Suspended</SelectItem>
              </SelectContent>
            </Select>
            <Select value={platform} onValueChange={(val) => { setPlatform(val as typeof platform); setPage(1) }}>
              <SelectTrigger aria-label="Filter participants by platform">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All</SelectItem>
                <SelectItem value="TikTok">TikTok</SelectItem>
                <SelectItem value="Facebook">Facebook</SelectItem>
                <SelectItem value="Instagram">Instagram</SelectItem>
                <SelectItem value="YouTube">YouTube</SelectItem>
              </SelectContent>
            </Select>
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
                    <TableHead className="text-right">Actions</TableHead>
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
                        <div className="flex justify-end gap-1">
                          <Button type="button" variant="ghost" size="icon-sm" onClick={() => openDetail(participant)}>
                            <ExternalLink className="size-4" />
                          </Button>
                          <Button type="button" variant="ghost" size="icon-sm" onClick={() => openEditor(participant)}>
                            <Pencil className="size-4" />
                          </Button>
                          <Button type="button" variant="ghost" size="icon-sm" onClick={() => openDeleteDialog(participant)}>
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
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

      {/* ── Create / Edit dialog ── */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedParticipant ? "Edit participant" : "Add participant"}</DialogTitle>
            <DialogDescription>
              Update contestant information and voting details.
            </DialogDescription>
          </DialogHeader>
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit((v) => save.mutate(v))}>
            <FormField label="Name">
              <Input {...register("name")} placeholder="Contestant full name" />
              {errors.name ? <p className="text-xs text-destructive">{errors.name.message}</p> : null}
            </FormField>
            <FormField label="Category">
              <Input {...register("category")} placeholder="Dance, Singing, Comedy…" />
              {errors.category ? <p className="text-xs text-destructive">{errors.category.message}</p> : null}
            </FormField>
            <FormField label="Platform">
              <Controller
                control={control}
                name="platform"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger className="w-full" aria-label="Platform">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="TikTok">TikTok</SelectItem>
                            <SelectItem value="Facebook">Facebook</SelectItem>
                            <SelectItem value="Instagram">Instagram</SelectItem>
                            <SelectItem value="YouTube">YouTube</SelectItem>
                          </SelectContent>
                        </Select>
                )}
              />
            </FormField>
            <FormField label="Status">
              <Controller
                control={control}
                name="status"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger className="w-full" aria-label="Status">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Active">Active</SelectItem>
                            <SelectItem value="Pending">Pending</SelectItem>
                            <SelectItem value="Suspended">Suspended</SelectItem>
                          </SelectContent>
                        </Select>
                )}
              />
            </FormField>
            <div className="sm:col-span-2">
              <FormField label="Video URL">
                <Input {...register("videoUrl")} placeholder="https://tiktok.com/@handle/video/…" />
                {errors.videoUrl ? <p className="text-xs text-destructive">{errors.videoUrl.message}</p> : null}
              </FormField>
            </div>
            <FormField label="Votes">
              <Input type="number" min={0} {...register("votes")} />
              {errors.votes ? <p className="text-xs text-destructive">{errors.votes.message}</p> : null}
            </FormField>
            <DialogFooter className="sm:col-span-2">
              <Button type="submit" disabled={save.isPending}>
                {save.isPending ? "Saving..." : "Save participant"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Delete confirmation dialog ── */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove participant?</DialogTitle>
            <DialogDescription>
              This permanently removes the contestant and their vote history.
            </DialogDescription>
          </DialogHeader>
          {selectedParticipant ? (
            <div className="space-y-2 rounded-xl border border-border/60 bg-muted/30 p-4 text-sm">
              <p className="font-medium">{selectedParticipant.name}</p>
              <p className="text-muted-foreground">
                {selectedParticipant.category} · {selectedParticipant.platform}
              </p>
              <p className="text-muted-foreground">{selectedParticipant.votes.toLocaleString()} votes</p>
            </div>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={remove.isPending || !selectedParticipant}
              onClick={() => {
                if (selectedParticipant) {
                  remove.mutate(selectedParticipant.id)
                }
              }}
            >
              {remove.isPending ? "Removing..." : "Remove participant"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Detail sheet ── */}
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
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setDetailOpen(false)
                    openEditor(selectedParticipant)
                  }}
                >
                  <Pencil className="size-4" />
                  Edit
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  className="flex-1"
                  onClick={() => {
                    setDetailOpen(false)
                    openDeleteDialog(selectedParticipant)
                  }}
                >
                  <Trash2 className="size-4" />
                  Remove
                </Button>
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

// Renders a labeled form field in the participant modal.
function FormField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  )
}
