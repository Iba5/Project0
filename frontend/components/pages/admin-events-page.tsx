'use client'

import { useState, useEffect, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { motion } from 'framer-motion'
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import {  } from '@/components/admin/admin-shell'
import { listEvents, createEvent, updateEvent, deleteEvent, type EventApi } from '@/lib/api'

const eventSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string(),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().min(1, 'End date is required'),
  status: z.string().min(1, 'Status is required'),
  votePrice: z.number().min(0.01, 'Price must be positive'),
  currency: z.string().min(1, 'Currency is required'),
  votingOpens: z.string(),
  votingCloses: z.string(),
  publicLeaderboard: z.boolean(),
  allowedCategories: z.string(),
  allowedPlatforms: z.string(),
})

type EventFormValues = z.infer<typeof eventSchema>

const statusColors: Record<string, string> = {
  Draft: 'bg-warm-100 text-warm-700 border-warm-200 hover:bg-warm-100',
  Upcoming: 'bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-50',
  'Registration Open': 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50',
  'Voting Open': 'bg-[#C8A24D]/10 text-[#C8A24D] border-[#C8A24D]/30 hover:bg-[#C8A24D]/10',
  'Voting Closed': 'bg-warm-100 text-warm-700 border-warm-200 hover:bg-warm-100',
  Completed: 'bg-warm-100 text-warm-600 border-warm-200 hover:bg-warm-100',
  Archived: 'bg-warm-50 text-warm-500 border-warm-200 hover:bg-warm-50',
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function AdminEventsPage() {
  const [events, setEvents] = useState<EventApi[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const fetchEvents = useCallback(async () => {
    try {
      const result = await listEvents()
      setEvents(Array.isArray(result) ? result : (result as any).items ?? [])
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to fetch events')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchEvents()
  }, [fetchEvents])

  const form = useForm<EventFormValues>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      name: '',
      description: '',
      startDate: '',
      endDate: '',
      status: 'Draft',
      votePrice: 1,
      currency: 'USD',
      votingOpens: '',
      votingCloses: '',
      publicLeaderboard: false,
      allowedCategories: '',
      allowedPlatforms: '',
    },
  })

  const openCreate = () => {
    setEditingId(null)
    form.reset({
      name: '',
      description: '',
      startDate: '',
      endDate: '',
      status: 'Draft',
      votePrice: 1,
      currency: 'USD',
      votingOpens: '',
      votingCloses: '',
      publicLeaderboard: false,
      allowedCategories: '',
      allowedPlatforms: '',
    })
    setDialogOpen(true)
  }

  const openEdit = (evt: EventApi) => {
    setEditingId(evt.id)
    form.reset({
      name: evt.name,
      description: evt.description ?? '',
      startDate: evt.startDate.slice(0, 16),
      endDate: evt.endDate.slice(0, 16),
      status: evt.status,
      votePrice: evt.votePrice,
      currency: evt.currency,
      votingOpens: evt.votingOpens?.slice(0, 16) ?? '',
      votingCloses: evt.votingCloses?.slice(0, 16) ?? '',
      publicLeaderboard: evt.publicLeaderboard,
      allowedCategories: evt.allowedCategories,
      allowedPlatforms: evt.allowedPlatforms,
    })
    setDialogOpen(true)
  }

  const openDelete = (id: string) => {
    setDeletingId(id)
    setDeleteOpen(true)
  }

  const onSubmit = async (values: EventFormValues) => {
    setSaving(true)
    try {
      const payload = {
        name: values.name,
        description: values.description || null,
        startDate: new Date(values.startDate).toISOString(),
        endDate: new Date(values.endDate).toISOString(),
        status: values.status,
        votePrice: values.votePrice,
        currency: values.currency,
        votingOpens: values.votingOpens
          ? new Date(values.votingOpens).toISOString()
          : null,
        votingCloses: values.votingCloses
          ? new Date(values.votingCloses).toISOString()
          : null,
        publicLeaderboard: values.publicLeaderboard,
        allowedCategories: values.allowedCategories,
        allowedPlatforms: values.allowedPlatforms,
      }

      if (editingId) {
        await updateEvent(editingId, payload)
        toast.success('Event updated')
      } else {
        await createEvent(payload)
        toast.success('Event created')
      }
      setDialogOpen(false)
      await fetchEvents()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Operation failed')
    } finally {
      setSaving(false)
    }
  }

  const onDelete = async () => {
    if (deletingId) {
      try {
        await deleteEvent(deletingId)
        toast.success('Event deleted')
        await fetchEvents()
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : 'Delete failed')
      }
    }
    setDeleteOpen(false)
    setDeletingId(null)
  }

  if (loading) {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
    </div>
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
          <h1 className="text-2xl font-bold tracking-tight">Events</h1>
          <Button onClick={openCreate} className="rounded-full">
            <Plus className="size-4" />
            Create Event
          </Button>
        </div>

        {/* Table */}
        <div className="border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="text-muted-foreground text-xs font-medium">
                    Name
                  </TableHead>
                  <TableHead className="text-muted-foreground text-xs font-medium">
                    Status
                  </TableHead>
                  <TableHead className="text-muted-foreground text-xs font-medium hidden md:table-cell">
                    Start Date
                  </TableHead>
                  <TableHead className="text-muted-foreground text-xs font-medium hidden md:table-cell">
                    End Date
                  </TableHead>
                  <TableHead className="text-muted-foreground text-xs font-medium text-right">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((evt) => (
                  <TableRow key={evt.id}>
                    <TableCell className="font-medium text-sm">
                      {evt.name}
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColors[evt.status] ?? ''}>
                        {evt.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground hidden md:table-cell">
                      {formatDate(evt.startDate)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground hidden md:table-cell">
                      {formatDate(evt.endDate)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          onClick={() => openEdit(evt)}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-destructive hover:text-destructive"
                          onClick={() => openDelete(evt.id)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {events.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center text-sm text-muted-foreground py-8"
                    >
                      No events yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </motion.div>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingId ? 'Edit Event' : 'Create Event'}
            </DialogTitle>
            <DialogDescription>
              {editingId
                ? 'Update the event details below.'
                : 'Fill in the details to create a new event.'}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="space-y-4"
            >
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Event name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Describe the event..."
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Date</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="endDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>End Date</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {[
                          'Draft',
                          'Upcoming',
                          'Registration Open',
                          'Voting Open',
                          'Voting Closed',
                          'Completed',
                          'Archived',
                        ].map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="votePrice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vote Price</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          value={field.value}
                          onChange={(e) => field.onChange(e.target.value === '' ? 0 : e.target.valueAsNumber)}
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="currency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Currency</FormLabel>
                      <FormControl>
                        <Input placeholder="USD" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="votingOpens"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Voting Opens</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="votingCloses"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Voting Closes</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="publicLeaderboard"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border border-border p-3">
                    <FormLabel className="!mt-0">Public Leaderboard</FormLabel>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="allowedCategories"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Allowed Categories</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Singing,Dancing,Comedy"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="allowedPlatforms"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Allowed Platforms</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="TikTok,Instagram,YouTube"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                  className="rounded-full"
                >
                  Cancel
                </Button>
                <Button type="submit" className="rounded-full" disabled={saving}>
                  {saving && <Loader2 className="size-4 animate-spin" />}
                  {editingId ? 'Save Changes' : 'Create Event'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Event</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the
              event and all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={onDelete}
              className="rounded-full bg-destructive text-white hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}