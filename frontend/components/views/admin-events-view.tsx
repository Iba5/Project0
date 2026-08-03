'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { motion } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Plus,
  Pencil,
  Trash2,
  X,
  Copy,
  Eye,
  Upload,
  Loader2,
  ImageIcon,
  Search,
  Download,
  Calendar,
  Inbox,
} from 'lucide-react'
import { listEvents, createEvent, updateEvent, deleteEvent, type EventItem } from '@/lib/api'
import { uploadImage } from '@/lib/upload-api'
import { apiUrl } from '@/lib/api-client'
import { nameToSolidGradient } from '@/lib/utils'
import { useAppStore } from '@/lib/store'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'

const eventSchema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters').max(100, 'Name must be less than 100 characters'),
  description: z.string().max(500, 'Description must be less than 500 characters').optional(),
  banner: z.string().optional(),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().min(1, 'End date is required'),
  status: z.string().min(1, 'Status is required'),
  votePrice: z.coerce.number().min(0.5, 'Vote price must be at least $0.50'),
  votesPerPayment: z.coerce.number().min(1, 'Votes per payment must be at least 1'),
  currency: z.string().min(1, 'Currency is required'),
  votingOpens: z.string().optional(),
  votingCloses: z.string().optional(),
  publicLeaderboard: z.boolean().default(true),
  allowedCategories: z.string().optional(),
  allowedPlatforms: z.string().optional(),
})

type EventFormValues = z.infer<typeof eventSchema>

const ONGOING_STATUSES = ['Ongoing', 'Voting Open', 'Registration Open']

const statusPills: { label: string; value: string }[] = [
  { label: 'All Events', value: 'all' },
  { label: 'Draft', value: 'Draft' },
  { label: 'Ongoing', value: 'Ongoing' },
  { label: 'Upcoming', value: 'Upcoming' },
  { label: 'Completed', value: 'Completed' },
]

function statusBadge(status: string) {
  const map: Record<string, { bg: string; text: string; border: string; dot: string }> = {
    Draft: { bg: 'rgba(148,163,184,0.15)', text: 'var(--text-muted)', border: 'rgba(148,163,184,0.3)', dot: 'var(--text-muted)' },
    Upcoming: { bg: 'rgba(56,189,248,0.15)', text: '#38BDF8', border: 'rgba(56,189,248,0.3)', dot: '#38BDF8' },
    'Voting Open': { bg: 'rgba(245,158,11,0.15)', text: '#F59E0B', border: 'rgba(245,158,11,0.3)', dot: '#F59E0B' },
    'Registration Open': { bg: 'rgba(16,185,129,0.15)', text: '#10B981', border: 'rgba(16,185,129,0.3)', dot: '#10B981' },
    Completed: { bg: 'rgba(148,163,184,0.15)', text: 'var(--text-muted)', border: 'rgba(148,163,184,0.3)', dot: 'var(--text-muted)' },
    Cancelled: { bg: 'rgba(239,68,68,0.15)', text: '#EF4444', border: 'rgba(239,68,68,0.3)', dot: '#EF4444' },
    Ongoing: { bg: 'rgba(245,158,11,0.15)', text: '#F59E0B', border: 'rgba(245,158,11,0.3)', dot: '#F59E0B' },
  }
  const s = map[status] || map.Draft
  return (
    <Badge
      style={{
        background: s.bg,
        color: s.text,
        borderColor: s.border,
      }}
      className="border gap-1.5"
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ background: s.dot }}
      />
      {status}
    </Badge>
  )
}

function EventBannerThumb({ event }: { event: EventItem }) {
  const initial = event.name?.slice(0, 1).toUpperCase() || '?'
  if (event.banner) {
    return (
      <div
        className="rounded-md overflow-hidden shrink-0"
        style={{ width: 56, height: 32 }}
      >
        <img
          src={event.banner}
          alt=""
          className="w-full h-full object-cover"
          loading="lazy"
        />
      </div>
    )
  }
  return (
    <div
      className={`rounded-md shrink-0 flex items-center justify-center bg-gradient-to-br ${nameToSolidGradient(event.name || '?')}`}
      style={{ width: 56, height: 32 }}
    >
      <span className="text-xs font-bold text-white">{initial}</span>
    </div>
  )
}

function ActionTooltip({
  label,
  children,
}: {
  label: string
  children: React.ReactElement
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent
        side="top"
        style={{
          background: 'var(--surface-elevated)',
          color: 'var(--text-primary)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        {label}
      </TooltipContent>
    </Tooltip>
  )
}

function EventBannerUpload({
  form,
}: {
  form: ReturnType<typeof useForm<EventFormValues>>
}) {
  const [uploading, setUploading] = useState(false)
  const [bannerPreview, setBannerPreview] = useState<string | null>(
    form.getValues('banner') || null,
  )
  const fileInputRef = useRef<HTMLInputElement>(null)
  const bannerValue = form.watch('banner') || ''
  const displayUrl = bannerPreview || bannerValue

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type)) {
      toast.error('Please select a PNG, JPEG, WebP, or GIF image')
      e.target.value = ''
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be 2 MB or smaller')
      e.target.value = ''
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setBannerPreview(reader.result)
      }
    }
    reader.onerror = () => {
      toast.error('Failed to read image file')
    }
    reader.readAsDataURL(file)

    setUploading(true)
    try {
      const { url } = await uploadImage(file)
      form.setValue('banner', url)
      setBannerPreview(url)
      toast.success('Banner uploaded')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to upload banner')
      setBannerPreview(form.getValues('banner') || null)
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleRemoveBanner = () => {
    form.setValue('banner', '')
    setBannerPreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="space-y-2">
      <Label style={{ color: 'var(--text-muted)' }}>Banner Image</Label>
      <div
        className="relative w-full h-32 sm:h-40 max-h-[160px] rounded-xl overflow-hidden flex items-center justify-center"
        style={{
          background: displayUrl
            ? 'transparent'
            : 'linear-gradient(135deg, rgba(245,158,11,0.12), rgba(217,119,6,0.06))',
          border: '1px solid var(--border-subtle)',
        }}
      >
        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-7 h-7 animate-spin" style={{ color: '#F59E0B' }} />
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Uploading…</span>
          </div>
        ) : displayUrl ? (
          <>
            <img
              src={displayUrl}
              alt="Banner preview"
              className="w-full h-full object-cover"
            />
            <button
              type="button"
              onClick={handleRemoveBanner}
              aria-label="Remove banner"
              className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center transition-colors"
              style={{
                background: 'rgba(11,15,23,0.7)',
                color: 'var(--text-primary)',
                backdropFilter: 'blur(4px)',
              }}
            >
              <X className="w-4 h-4" />
            </button>
          </>
        ) : (
          <div className="flex flex-col items-center gap-2 pointer-events-none">
            <ImageIcon className="w-8 h-8" style={{ color: 'var(--text-muted)' }} />
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>No banner yet</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          onChange={handleFileChange}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
          className="rounded-full h-8"
          style={{
            borderColor: 'rgba(245,158,11,0.4)',
            color: '#F59E0B',
            background: 'rgba(245,158,11,0.06)',
          }}
        >
          <Upload className="w-3.5 h-3.5 mr-1.5" />
          {uploading
            ? 'Uploading…'
            : displayUrl
              ? 'Change Banner'
              : 'Upload Banner'}
        </Button>
        <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
          PNG, JPEG, WebP, or GIF · max 2 MB · 16:9 recommended
        </span>
      </div>
    </div>
  )
}

export function AdminEventsView() {
  const { setSelectedEventId } = useAppStore()
  const router = useRouter()
  const [events, setEvents] = useState<EventItem[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [formOpen, setFormOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [editingEvent, setEditingEvent] = useState<EventItem | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [exporting, setExporting] = useState(false)

  const fetchEvents = useCallback(async () => {
    try {
      const params: { search?: string; status?: string } = {}
      if (search.trim()) params.search = search.trim()
      if (statusFilter && statusFilter !== 'all') params.status = statusFilter
      const { events: evts } = await listEvents(params)
      setEvents(evts || [])
    } catch {
      toast.error('Failed to fetch events')
      setEvents([])
    } finally {
      setLoading(false)
    }
  }, [search, statusFilter])

  useEffect(() => {
    let cancelled = false
    listEvents()
      .then(({ events: all }) => {
        if (!cancelled) setTotalCount(all?.length ?? 0)
      })
      .catch(() => {
        /* best-effort */
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    fetchEvents()
  }, [fetchEvents])

  const form = useForm<EventFormValues>({
    resolver: zodResolver(eventSchema) as any,
    defaultValues: {
      name: '',
      description: '',
      banner: '',
      startDate: '',
      endDate: '',
      status: 'Draft',
      votePrice: 1,
      votesPerPayment: 1,
      currency: 'USD',
      votingOpens: '',
      votingCloses: '',
      publicLeaderboard: true,
      allowedCategories: 'Singing,Dancing,Comedy',
      allowedPlatforms: 'TikTok,Facebook,Instagram,YouTube',
    },
  })

  const openCreate = () => {
    setEditingEvent(null)
    form.reset({
      name: '',
      description: '',
      banner: '',
      startDate: '',
      endDate: '',
      status: 'Draft',
      votePrice: 1,
      votesPerPayment: 1,
      currency: 'USD',
      votingOpens: '',
      votingCloses: '',
      publicLeaderboard: true,
      allowedCategories: 'Singing,Dancing,Comedy',
      allowedPlatforms: 'TikTok,Facebook,Instagram,YouTube',
    })
    setFormOpen(true)
  }

  const openEdit = (event: EventItem) => {
    setEditingEvent(event)
    form.reset({
      name: event.name,
      description: event.description || '',
      banner: event.banner || '',
      startDate: event.startDate ? new Date(event.startDate).toISOString().slice(0, 16) : '',
      endDate: event.endDate ? new Date(event.endDate).toISOString().slice(0, 16) : '',
      status: event.status,
      votePrice: event.votePrice,
      votesPerPayment: event.votesPerPayment,
      currency: event.currency,
      votingOpens: event.votingOpens ? new Date(event.votingOpens).toISOString().slice(0, 16) : '',
      votingCloses: event.votingCloses ? new Date(event.votingCloses).toISOString().slice(0, 16) : '',
      publicLeaderboard: event.publicLeaderboard,
      allowedCategories: event.allowedCategories,
      allowedPlatforms: event.allowedPlatforms,
    })
    setFormOpen(true)
  }

  const onSubmit = async (values: EventFormValues) => {
    setSubmitting(true)
    try {
      const payload: Record<string, unknown> = {
        ...values,
        banner: values.banner || null,
        startDate: values.startDate,
        endDate: values.endDate,
        votingOpens: values.votingOpens || null,
        votingCloses: values.votingCloses || null,
        description: values.description || null,
      }

      if (editingEvent) {
        await updateEvent(editingEvent.id, payload)
        toast.success('Event updated')
      } else {
        const result = await createEvent(payload)
        toast.success('Event created')
        
        // Generate filtered link for the new event
        const eventLink = `${window.location.origin}?event=${result.event.id}`
        navigator.clipboard.writeText(eventLink)
        toast.success('Event link copied to clipboard!', {
          description: eventLink
        })
      }
      setFormOpen(false)
      fetchEvents()
      listEvents()
        .then(({ events: all }) => setTotalCount(all?.length ?? 0))
        .catch(() => {
          /* best-effort */
        })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save event')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingId) return
    try {
      await deleteEvent(deletingId)
      toast.success('Event deleted')
      fetchEvents()
      listEvents()
        .then(({ events: all }) => setTotalCount(all?.length ?? 0))
        .catch(() => {
          /* best-effort */
        })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete event')
    } finally {
      setDeleteOpen(false)
      setDeletingId(null)
    }
  }

  const handleCopyEventLink = (event: EventItem) => {
    const link = `${window.location.origin}?event=${event.id}`
    navigator.clipboard.writeText(link).then(() => {
      toast.success('Event link copied to clipboard!')
    }).catch(() => {
      toast.error('Failed to copy link')
    })
  }

  const handleGoToPublicView = (event: EventItem) => {
    setSelectedEventId(event.id)
    router.push('/contestants')
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const params = new URLSearchParams()
      params.set('format', 'csv')
      if (search.trim()) params.set('search', search.trim())
      if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter)
      const res = await fetch(apiUrl(`/events?${params.toString()}`), {
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
      link.setAttribute('download', `vibehub-events-${new Date().toISOString().slice(0, 10)}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      toast.success('CSV exported')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to export CSV')
    } finally {
      setExporting(false)
    }
  }

  const hasActiveFilters = statusFilter !== 'all' || search.trim() !== ''

  const safeEvents = events || []
  const pillCounts: Record<string, number> = {
    all: totalCount,
    Draft: safeEvents.filter((e) => e.status === 'Draft').length,
    Ongoing: safeEvents.filter((e) => ONGOING_STATUSES.includes(e.status)).length,
    Upcoming: safeEvents.filter((e) => e.status === 'Upcoming').length,
    Completed: safeEvents.filter((e) => e.status === 'Completed').length,
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Status Quick Filter Pills */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.03 }}
        className="flex flex-wrap gap-2 items-center"
      >
        {statusPills.map((pill) => {
          const active = statusFilter === pill.value
          const count = pillCounts[pill.value] ?? 0
          return (
            <button
              key={pill.value}
              onClick={() => setStatusFilter(pill.value)}
              className="px-4 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-2"
              style={{
                background: active
                  ? 'linear-gradient(135deg, #F59E0B, #D97706)'
                  : 'var(--surface-3)',
                color: active ? '#FFFFFF' : 'var(--text-muted)',
                border: `1px solid ${active ? 'rgba(245,158,11,0.4)' : 'var(--border-subtle)'}`,
              }}
            >
              {pill.label}
              {count > 0 && (
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded-full"
                  style={{
                    background: active ? 'rgba(0,0,0,0.2)' : 'var(--border-subtle)',
                    color: active ? '#FFFFFF' : 'var(--text-muted)',
                  }}
                >
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </motion.div>

      {/* Count indicator */}
      <div className="flex items-center gap-2 -mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
        <Calendar className="w-3.5 h-3.5" />
        <span>
          Showing <span style={{ color: 'var(--text-muted)' }}>{loading ? '…' : (events?.length ?? 0)}</span> of{' '}
          <span style={{ color: 'var(--text-muted)' }}>{totalCount ?? 0}</span> events
        </span>
      </div>

      {/* Search + Export CSV toolbar */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05 }}
        className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="relative flex-1 min-w-[200px] sm:max-w-md">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
            style={{ color: 'var(--text-muted)' }}
          />
          <Input
            placeholder="Search events by name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 rounded-xl border-none input-focus-gold"
            style={{ background: 'var(--surface-3)', color: 'var(--text-primary)' }}
          />
        </div>
        <Button
          onClick={handleExport}
          disabled={exporting || (loading ? true : (events?.length ?? 0) === 0)}
          className="rounded-full self-start sm:self-auto shrink-0 button-press"
          style={{
            background: '#F59E0B',
            color: 'var(--surface-3)',
            fontWeight: 600,
          }}
        >
          {exporting ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Download className="w-4 h-4 mr-2" />
          )}
          Export CSV
        </Button>
      </motion.div>

      {/* Table */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <div
          className="rounded-xl border overflow-hidden table-row-hover"
          style={{ background: 'var(--surface-1)', borderColor: 'var(--border-subtle)' }}
        >
          <Table>
            <TableHeader>
              <TableRow
                style={{
                  background: 'var(--surface-3)',
                  borderBottomColor: 'var(--border-subtle)',
                }}
              >
                <TableHead style={{ color: 'var(--text-muted)' }} className="w-[300px]">Name</TableHead>
                <TableHead style={{ color: 'var(--text-muted)' }} className="w-[150px]">Status</TableHead>
                <TableHead style={{ color: 'var(--text-muted)' }} className="w-[120px]">Start Date</TableHead>
                <TableHead style={{ color: 'var(--text-muted)' }} className="w-[120px]">End Date</TableHead>
                <TableHead style={{ color: 'var(--text-muted)' }} className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow
                    key={`skeleton-${i}`}
                    style={{ borderBottomColor: 'var(--surface-3)' }}
                  >
                    <TableCell colSpan={5} className="py-3">
                      <div className="flex items-center gap-4">
                        <Skeleton className="h-8 w-14 rounded-md" />
                        <Skeleton className="h-4 w-40 rounded-md" />
                        <Skeleton className="h-4 w-20 rounded-md ml-auto" />
                        <Skeleton className="h-4 w-24 rounded-md" />
                        <Skeleton className="h-4 w-24 rounded-md" />
                        <Skeleton className="h-8 w-28 rounded-md" />
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (events?.length ?? 0) === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-16">
                    <div className="flex flex-col items-center gap-3">
                      <div
                        className="w-14 h-14 rounded-full flex items-center justify-center"
                        style={{
                          background: 'rgba(245,158,11,0.1)',
                          border: '1px solid rgba(245,158,11,0.2)',
                        }}
                      >
                        {hasActiveFilters ? (
                          <Inbox className="w-7 h-7" style={{ color: '#F59E0B' }} />
                        ) : (
                          <Calendar className="w-7 h-7" style={{ color: '#F59E0B' }} />
                        )}
                      </div>
                      <div>
                        <p className="font-medium" style={{ color: 'var(--text-primary)' }}>
                          {hasActiveFilters ? 'No events match your filters' : 'No events yet'}
                        </p>
                        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                          {hasActiveFilters
                            ? 'Try adjusting your search or status filter.'
                            : 'Click "Create Event" to set up your first competition.'}
                        </p>
                      </div>
                      {!hasActiveFilters && (
                        <Button
                          onClick={openCreate}
                          className="rounded-full gap-2 mt-1 focus-ring-gold"
                          style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)', color: 'var(--surface-3)' }}
                        >
                          <Plus className="w-4 h-4" /> Create Event
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                safeEvents.map((event) => (
                  <TableRow
                    key={event.id}
                    className="transition-colors glass-card-hover"
                    style={{ borderBottomColor: 'var(--surface-3)' }}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <EventBannerThumb event={event} />
                        <div className="flex flex-col min-w-0">
                          <span className="font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                            {event.name}
                          </span>
                          {event.description && (
                            <span
                              className="text-[11px] truncate max-w-[200px]"
                              style={{ color: 'var(--text-muted)' }}
                            >
                              {event.description}
                            </span>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{statusBadge(event.status)}</TableCell>
                    <TableCell className="text-sm" style={{ color: 'var(--text-muted)' }}>
                      {new Date(event.startDate).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </TableCell>
                    <TableCell className="text-sm" style={{ color: 'var(--text-muted)' }}>
                      {new Date(event.endDate).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 justify-end">
                        <ActionTooltip label="Edit Event">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 hover:bg-amber-500/10"
                            onClick={() => openEdit(event)}
                          >
                            <Pencil className="w-4 h-4" style={{ color: '#F59E0B' }} />
                          </Button>
                        </ActionTooltip>
                        <ActionTooltip label="Copy Event Link">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 hover:bg-amber-500/10"
                            onClick={() => handleCopyEventLink(event)}
                          >
                            <Copy className="w-4 h-4" style={{ color: '#F59E0B' }} />
                          </Button>
                        </ActionTooltip>
                        <ActionTooltip label="Go to Public View">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 hover:bg-sky-500/10"
                            onClick={() => handleGoToPublicView(event)}
                          >
                            <Eye className="w-4 h-4" style={{ color: '#38BDF8' }} />
                          </Button>
                        </ActionTooltip>
                        <ActionTooltip label="Delete Event">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 hover:bg-red-500/10"
                            onClick={() => {
                              setDeletingId(event.id)
                              setDeleteOpen(true)
                            }}
                          >
                            <Trash2 className="w-4 h-4" style={{ color: '#EF4444' }} />
                          </Button>
                        </ActionTooltip>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </motion.div>

      {/* Create / Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent
          className="w-[92vw] max-w-2xl max-h-[85vh] p-4 sm:p-6 flex flex-col glass-premium rounded-2xl"
          style={{
            background: 'var(--surface-1)',
            borderColor: 'var(--border-subtle)',
            color: 'var(--text-primary)',
          }}
        >
          <DialogHeader className="shrink-0 pb-2">
            <DialogTitle style={{ color: 'var(--text-primary)' }}>
              {editingEvent ? 'Edit Event' : 'Create Event'}
            </DialogTitle>
          </DialogHeader>

          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col min-h-0 flex-1"
          >
            <div className="overflow-y-auto pr-1 space-y-4 flex-1">
              <EventBannerUpload form={form} />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2 sm:col-span-2">
                  <Label style={{ color: 'var(--text-muted)' }}>Name</Label>
                  <Input
                    {...form.register('name')}
                    className="rounded-xl border-none"
                    style={{ background: 'var(--surface-3)', color: 'var(--text-primary)' }}
                  />
                  {form.formState.errors.name && (
                    <p className="text-xs text-red-400">{form.formState.errors.name.message}</p>
                  )}
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <Label style={{ color: 'var(--text-muted)' }}>Description</Label>
                  <Textarea
                    {...form.register('description')}
                    className="rounded-xl border-none"
                    style={{ background: 'var(--surface-3)', color: 'var(--text-primary)' }}
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label style={{ color: 'var(--text-muted)' }}>Start Date</Label>
                  <Input
                    type="datetime-local"
                    {...form.register('startDate')}
                    className="rounded-xl border-none"
                    style={{ background: 'var(--surface-3)', color: 'var(--text-primary)' }}
                  />
                  {form.formState.errors.startDate && (
                    <p className="text-xs text-red-400">{form.formState.errors.startDate.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label style={{ color: 'var(--text-muted)' }}>End Date</Label>
                  <Input
                    type="datetime-local"
                    {...form.register('endDate')}
                    className="rounded-xl border-none"
                    style={{ background: 'var(--surface-3)', color: 'var(--text-primary)' }}
                  />
                  {form.formState.errors.endDate && (
                    <p className="text-xs text-red-400">{form.formState.errors.endDate.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label style={{ color: 'var(--text-muted)' }}>Status</Label>
                  <Select
                    value={form.watch('status')}
                    onValueChange={(val) => form.setValue('status', val)}
                  >
                    <SelectTrigger
                      className="rounded-xl border-none"
                      style={{ background: 'var(--surface-3)', color: 'var(--text-primary)' }}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent style={{ background: 'var(--surface-elevated)', color: 'var(--text-primary)' }}>
                      <SelectItem value="Draft">Draft</SelectItem>
                      <SelectItem value="Upcoming">Upcoming</SelectItem>
                      <SelectItem value="Registration Open">Registration Open</SelectItem>
                      <SelectItem value="Voting Open">Voting Open</SelectItem>
                      <SelectItem value="Completed">Completed</SelectItem>
                      <SelectItem value="Cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label style={{ color: 'var(--text-muted)' }}>Currency</Label>
                  <Select
                    value={form.watch('currency')}
                    onValueChange={(val) => form.setValue('currency', val)}
                  >
                    <SelectTrigger
                      className="rounded-xl border-none"
                      style={{ background: 'var(--surface-3)', color: 'var(--text-primary)' }}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent style={{ background: 'var(--surface-elevated)', color: 'var(--text-primary)' }}>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="ZWL">ZWL</SelectItem>
                      <SelectItem value="ZAR">ZAR</SelectItem>
                      <SelectItem value="GBP">GBP</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label style={{ color: 'var(--text-muted)' }}>Vote Price</Label>
                  <Input
                    type="number"
                    step="0.01"
                    {...form.register('votePrice')}
                    className="rounded-xl border-none"
                    style={{ background: 'var(--surface-3)', color: 'var(--text-primary)' }}
                  />
                  {form.formState.errors.votePrice && (
                    <p className="text-xs text-red-400">{form.formState.errors.votePrice.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label style={{ color: 'var(--text-muted)' }}>Votes Per Payment</Label>
                  <Input
                    type="number"
                    {...form.register('votesPerPayment')}
                    className="rounded-xl border-none"
                    style={{ background: 'var(--surface-3)', color: 'var(--text-primary)' }}
                  />
                </div>

                <div className="space-y-2">
                  <Label style={{ color: 'var(--text-muted)' }}>Voting Opens</Label>
                  <Input
                    type="datetime-local"
                    {...form.register('votingOpens')}
                    className="rounded-xl border-none"
                    style={{ background: 'var(--surface-3)', color: 'var(--text-primary)' }}
                  />
                </div>

                <div className="space-y-2">
                  <Label style={{ color: 'var(--text-muted)' }}>Voting Closes</Label>
                  <Input
                    type="datetime-local"
                    {...form.register('votingCloses')}
                    className="rounded-xl border-none"
                    style={{ background: 'var(--surface-3)', color: 'var(--text-primary)' }}
                  />
                </div>

                <div className="space-y-2 flex items-center gap-3 sm:col-span-2 pt-1">
                  <Switch
                    checked={form.watch('publicLeaderboard')}
                    onCheckedChange={(val) => form.setValue('publicLeaderboard', val)}
                  />
                  <Label style={{ color: 'var(--text-muted)' }}>Public Leaderboard</Label>
                </div>

                <div className="space-y-2">
                  <Label style={{ color: 'var(--text-muted)' }}>Allowed Categories (comma-separated)</Label>
                  <Input
                    {...form.register('allowedCategories')}
                    className="rounded-xl border-none"
                    style={{ background: 'var(--surface-3)', color: 'var(--text-primary)' }}
                    placeholder="Singing,Dancing,Comedy"
                  />
                </div>

                <div className="space-y-2">
                  <Label style={{ color: 'var(--text-muted)' }}>Allowed Platforms (comma-separated)</Label>
                  <Input
                    {...form.register('allowedPlatforms')}
                    className="rounded-xl border-none"
                    style={{ background: 'var(--surface-3)', color: 'var(--text-primary)' }}
                    placeholder="TikTok,Facebook,Instagram,YouTube"
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="shrink-0 pt-4 border-t border-[var(--border-subtle)] mt-4">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setFormOpen(false)}
                className="rounded-full"
                style={{ color: 'var(--text-muted)' }}
              >
                <X className="w-4 h-4 mr-1" /> Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="rounded-full focus-ring-gold"
                style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)', color: 'var(--surface-3)' }}
              >
                {submitting ? 'Saving…' : editingEvent ? 'Update Event' : 'Create Event'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent
          className="glass-premium"
          style={{
            background: 'var(--surface-1)',
            borderColor: 'var(--border-subtle)',
            color: 'var(--text-primary)',
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle style={{ color: 'var(--text-primary)' }}>Delete Event</AlertDialogTitle>
            <AlertDialogDescription style={{ color: 'var(--text-muted)' }}>
              Are you sure you want to delete this event? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              className="rounded-full"
              style={{ background: 'transparent', color: 'var(--text-muted)', borderColor: 'var(--border-subtle)' }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="rounded-full bg-red-600 hover:bg-red-700 text-white"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}