'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { motion } from 'framer-motion'
import { Plus, Pencil, MoreVertical, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { listParticipants, createParticipant, updateParticipantStatus, type ParticipantApi } from '@/lib/api'
import type { ContestantStatus, SocialPlatformType } from '@/lib/types'

const categories = ['All', 'Singing', 'Dancing', 'Comedy', 'Acting', 'Fashion']
const platforms: SocialPlatformType[] = [
  'TikTok',
  'Facebook',
  'Instagram',
  'YouTube',
]
const statuses: ContestantStatus[] = [
  'Draft',
  'Submitted',
  'Under Review',
  'Approved',
  'Rejected',
  'Disqualified',
  'Archived',
]

const participantSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  category: z.string().min(1, 'Category is required'),
  platform: z.string().min(1, 'Platform is required'),
  videoUrl: z.string().min(1, 'Video URL is required'),
  bio: z.string(),
  status: z.string().min(1, 'Status is required'),
})

type ParticipantFormValues = z.infer<typeof participantSchema>

const statusColors: Record<string, string> = {
  Draft: 'bg-warm-100 text-warm-700 border-warm-200 hover:bg-warm-100',
  Submitted: 'bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-50',
  'Under Review': 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-50',
  Approved: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50',
  Rejected: 'bg-red-50 text-red-700 border-red-200 hover:bg-red-50',
  Disqualified: 'bg-red-50 text-red-700 border-red-200 hover:bg-red-50',
  Archived: 'bg-warm-50 text-warm-500 border-warm-200 hover:bg-warm-50',
}

function PlatformIcon({ platform }: { platform: string }) {
  const colors: Record<string, string> = {
    TikTok: 'text-black',
    Facebook: 'text-blue-600',
    Instagram: 'text-pink-600',
    YouTube: 'text-red-600',
  }
  return (
    <span className={`text-xs font-medium ${colors[platform] ?? ''}`}>
      {platform}
    </span>
  )
}

export function AdminParticipantsPage() {
  const [participants, setParticipants] = useState<ParticipantApi[]>([])
  const [loading, setLoading] = useState(true)
  const [categoryFilter, setCategoryFilter] = useState('All')
  const [statusFilter, setStatusFilter] = useState('All')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const fetchParticipants = useCallback(async () => {
    try {
      const result = await listParticipants()
      setParticipants(Array.isArray(result) ? result : (result as any).items ?? [])
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to fetch participants')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchParticipants()
  }, [fetchParticipants])

  const form = useForm<ParticipantFormValues>({
    resolver: zodResolver(participantSchema),
    defaultValues: {
      name: '',
      category: '',
      platform: '',
      videoUrl: '',
      bio: '',
      status: 'Submitted',
    },
  })

  const filtered = useMemo(() => {
    return participants.filter((p) => {
      if (categoryFilter !== 'All' && p.category !== categoryFilter) return false
      if (statusFilter !== 'All' && p.status !== statusFilter) return false
      return true
    })
  }, [participants, categoryFilter, statusFilter])

  const openCreate = () => {
    setEditingId(null)
    form.reset({
      name: '',
      category: '',
      platform: '',
      videoUrl: '',
      bio: '',
      status: 'Submitted',
    })
    setDialogOpen(true)
  }

  const openEdit = (p: ParticipantApi) => {
    setEditingId(p.id)
    form.reset({
      name: p.name,
      category: p.category,
      platform: p.platform,
      videoUrl: p.videoUrl,
      bio: p.bio ?? '',
      status: p.status,
    })
    setDialogOpen(true)
  }

  const changeStatus = async (id: string, status: string) => {
    try {
      await updateParticipantStatus(id, status)
      toast.success(`Status changed to ${status}`)
      await fetchParticipants()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update status')
    }
  }

  const onSubmit = async (values: ParticipantFormValues) => {
    setSaving(true)
    try {
      if (editingId) {
        await updateParticipantStatus(editingId, values.status)
        toast.success('Contestant updated')
      } else {
        await createParticipant({
          name: values.name,
          category: values.category,
          platform: values.platform,
          videoUrl: values.videoUrl,
          bio: values.bio || null,
          status: values.status,
        })
        toast.success('Contestant added')
      }
      setDialogOpen(false)
      await fetchParticipants()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Operation failed')
    } finally {
      setSaving(false)
    }
  }

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
          <h1 className="text-2xl font-bold tracking-tight">Participants</h1>
          <Button onClick={openCreate} className="rounded-full">
            <Plus className="size-4" />
            Add Contestant
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Category pills */}
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
                  categoryFilter === cat
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background text-muted-foreground border-border hover:bg-muted'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Status dropdown */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Statuses</SelectItem>
              {statuses.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="text-muted-foreground text-xs font-medium">
                    Name
                  </TableHead>
                  <TableHead className="text-muted-foreground text-xs font-medium hidden sm:table-cell">
                    Category
                  </TableHead>
                  <TableHead className="text-muted-foreground text-xs font-medium hidden md:table-cell">
                    Platform
                  </TableHead>
                  <TableHead className="text-muted-foreground text-xs font-medium text-right">
                    Votes
                  </TableHead>
                  <TableHead className="text-muted-foreground text-xs font-medium">
                    Status
                  </TableHead>
                  <TableHead className="text-muted-foreground text-xs font-medium text-right">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium text-sm">
                      {p.name}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground hidden sm:table-cell">
                      {p.category}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <PlatformIcon platform={p.platform} />
                    </TableCell>
                    <TableCell className="text-sm text-right font-mono">
                      {p.votes.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColors[p.status] ?? ''}>
                        {p.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          onClick={() => openEdit(p)}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="size-8">
                              <MoreVertical className="size-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() =>
                                changeStatus(p.id, 'Approved')
                              }
                            >
                              Approve
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                changeStatus(p.id, 'Rejected')
                              }
                            >
                              Reject
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() =>
                                changeStatus(p.id, 'Disqualified')
                              }
                            >
                              Disqualify
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center text-sm text-muted-foreground py-8"
                    >
                      No participants match the current filters.
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
              {editingId ? 'Edit Contestant' : 'Add Contestant'}
            </DialogTitle>
            <DialogDescription>
              {editingId
                ? 'Update the contestant details below.'
                : 'Fill in the details to add a new contestant.'}
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
                      <Input placeholder="Contestant name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {categories
                            .filter((c) => c !== 'All')
                            .map((c) => (
                              <SelectItem key={c} value={c}>
                                {c}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="platform"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Platform</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Platform" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {platforms.map((p) => (
                            <SelectItem key={p} value={p}>
                              {p}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="videoUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Video URL</FormLabel>
                    <FormControl>
                      <Input placeholder="https://..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="bio"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bio</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Short biography..."
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

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
                          <SelectValue placeholder="Status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {statuses.map((s) => (
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
                  {editingId ? 'Save Changes' : 'Add Contestant'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  )
}