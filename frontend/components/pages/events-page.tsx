"use client"

import { useMemo, useState } from "react"
import type { FormEvent, ReactNode } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { Eye, Pencil, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { AppShell } from "@/components/app-shell"
import { ErrorState } from "@/components/error-state"
import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { api, getApiError } from "@/lib/api"
import type { EventRecord } from "@/lib/types"

type EventForm = Omit<EventRecord, "id">

const emptyForm: EventForm = {
  name: "",
  description: "",
  banner: "",
  startDate: "",
  endDate: "",
  status: "Upcoming",
}

// Handles create, edit, delete, and view actions for competition events.
export function EventsPage() {
  const query = useQuery({
    queryKey: ["events"],
    queryFn: async () => (await api.get<{ items: EventRecord[] }>("/events")).data.items,
  })
  const [editorOpen, setEditorOpen] = useState(false)
  const [viewerOpen, setViewerOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<EventRecord | null>(null)
  const [form, setForm] = useState<EventForm>(emptyForm)

  const save = useMutation({
    mutationFn: async () =>
      selectedEvent
        ? (await api.put(`/events/${selectedEvent.id}`, { ...form, id: selectedEvent.id })).data
        : (await api.post("/events", form)).data,
    onSuccess: async (data: { message: string }) => {
      toast.success(data.message || "Event saved.")
      setEditorOpen(false)
      setSelectedEvent(null)
      setForm(emptyForm)
      await query.refetch()
    },
    onError: (error) => {
      const apiError = getApiError(error)
      toast.error(apiError.message, apiError.hint ? { description: apiError.hint } : undefined)
    },
  })

  const remove = useMutation({
    mutationFn: async (id: string) => (await api.delete(`/events/${id}`)).data,
    onSuccess: async (data: { message: string }) => {
      toast.success(data.message || "Event removed.")
      setDeleteOpen(false)
      setSelectedEvent(null)
      await query.refetch()
    },
    onError: (error) => {
      const apiError = getApiError(error)
      toast.error(apiError.message, apiError.hint ? { description: apiError.hint } : undefined)
    },
  })

  const events = useMemo(() => query.data ?? [], [query.data])

  // Opens the editor with either a blank form or the selected record's values.
  function openEditor(event?: EventRecord) {
    setSelectedEvent(event ?? null)
    setForm(
      event
        ? {
            name: event.name,
            description: event.description,
            banner: event.banner,
            startDate: event.startDate,
            endDate: event.endDate,
            status: event.status,
          }
        : emptyForm
    )
    setEditorOpen(true)
  }

  // Opens a read-only viewer for one event record.
  function openViewer(event: EventRecord) {
    setSelectedEvent(event)
    setViewerOpen(true)
  }

  // Opens the confirmation dialog for a selected event record.
  function openDeleteDialog(event: EventRecord) {
    setSelectedEvent(event)
    setDeleteOpen(true)
  }

  // Saves the current event form through the backend-facing API route.
  function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    save.mutate()
  }

  return (
    <AppShell>
      <div className="admin-grid">
        <PageHeader
          eyebrow="Operations"
          title="Events"
          description="Create, edit, view, and retire competition events from a single workspace."
          actions={
            <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
              <DialogTrigger asChild>
                <Button type="button" onClick={() => openEditor()}>
                  <Plus className="size-4" />
                  New event
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>{selectedEvent ? "Edit event" : "Create event"}</DialogTitle>
                  <DialogDescription>
                    Keep the backend record aligned with the dashboard schedule.
                  </DialogDescription>
                </DialogHeader>
                <form className="grid gap-4 sm:grid-cols-2" onSubmit={handleSave}>
                  <FormField label="Name">
                    <Input
                      value={form.name}
                      onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                    />
                  </FormField>
                  <FormField label="Status">
                    <select
                      aria-label="Event status"
                      className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                      value={form.status}
                      onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as EventForm["status"] }))}
                    >
                      <option>Upcoming</option>
                      <option>Ongoing</option>
                      <option>Expired</option>
                    </select>
                  </FormField>
                  <FormField label="Start date">
                    <Input
                      type="date"
                      value={form.startDate}
                      onChange={(event) => setForm((current) => ({ ...current, startDate: event.target.value }))}
                    />
                  </FormField>
                  <FormField label="End date">
                    <Input
                      type="date"
                      value={form.endDate}
                      onChange={(event) => setForm((current) => ({ ...current, endDate: event.target.value }))}
                    />
                  </FormField>
                  <div className="sm:col-span-2">
                    <FormField label="Banner URL">
                      <Input
                        value={form.banner}
                        onChange={(event) => setForm((current) => ({ ...current, banner: event.target.value }))}
                      />
                    </FormField>
                  </div>
                  <div className="sm:col-span-2">
                    <FormField label="Description">
                      <Textarea
                        value={form.description}
                        onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                      />
                    </FormField>
                  </div>
                  <DialogFooter className="sm:col-span-2">
                    <Button type="submit" disabled={save.isPending}>
                      {save.isPending ? "Saving..." : "Save event"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          }
        />
        {query.isLoading ? <EventsSkeleton /> : null}
        {query.error ? <ErrorState {...getApiError(query.error)} onRetry={() => query.refetch()} /> : null}
        {events.length ? (
          <Card className="glass-panel">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Dates</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell className="font-medium">{event.name}</TableCell>
                      <TableCell>
                        {event.startDate} to {event.endDate}
                      </TableCell>
                      <TableCell>
                        <EventStatusBadge status={event.status} />
                      </TableCell>
                      <TableCell className="max-w-md whitespace-normal text-muted-foreground">
                        {event.description}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          <Button type="button" variant="ghost" size="icon-sm" onClick={() => openViewer(event)}>
                            <Eye className="size-4" />
                          </Button>
                          <Button type="button" variant="ghost" size="icon-sm" onClick={() => openEditor(event)}>
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => openDeleteDialog(event)}
                          >
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
        ) : null}
      </div>
      <Dialog open={viewerOpen} onOpenChange={setViewerOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedEvent?.name}</DialogTitle>
            <DialogDescription>Read-only event overview.</DialogDescription>
          </DialogHeader>
          {selectedEvent ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <Card className="overflow-hidden">
                  <img src={selectedEvent.banner} alt={selectedEvent.name} className="h-48 w-full object-cover" />
                </Card>
                <div className="space-y-3">
                  <DetailRow label="Status" value={<EventStatusBadge status={selectedEvent.status} />} />
                  <DetailRow label="Start date" value={selectedEvent.startDate} />
                  <DetailRow label="End date" value={selectedEvent.endDate} />
                  <p className="text-sm text-muted-foreground">{selectedEvent.description}</p>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setViewerOpen(false)}>
                  Close
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    setViewerOpen(false)
                    openEditor(selectedEvent)
                  }}
                >
                  <Pencil className="size-4" />
                  Edit event
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete event?</DialogTitle>
            <DialogDescription>
              This permanently removes the selected event from the dashboard list.
            </DialogDescription>
          </DialogHeader>
          {selectedEvent ? (
            <div className="space-y-3">
              <Card className="overflow-hidden">
                <img src={selectedEvent.banner} alt={selectedEvent.name} className="h-40 w-full object-cover" />
              </Card>
              <div className="space-y-2 text-sm">
                <p className="font-medium">{selectedEvent.name}</p>
                <p className="text-muted-foreground">
                  {selectedEvent.startDate} to {selectedEvent.endDate}
                </p>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={remove.isPending || !selectedEvent}
              onClick={() => {
                if (selectedEvent) {
                  remove.mutate(selectedEvent.id)
                }
              }}
            >
              {remove.isPending ? "Deleting..." : "Delete event"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  )
}

// Renders a labeled form field in the event modal.
function FormField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  )
}

// Shows the event status using the same palette across the app.
function EventStatusBadge({ status }: { status: EventRecord["status"] }) {
  const variant = status === "Ongoing" ? "default" : status === "Upcoming" ? "secondary" : "outline"
  return <Badge variant={variant}>{status}</Badge>
}

// Renders a compact label/value row inside the detail dialog.
function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 px-3 py-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  )
}

// Displays the loading state for the event table.
function EventsSkeleton() {
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
