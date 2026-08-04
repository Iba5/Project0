'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { motion } from 'framer-motion'
import { useForm, type UseFormReturn } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Search,
  Plus,
  CheckCircle,
  XCircle,
  Filter,
  Copy,
  Eye,
  Pencil,
  Trash2,
  Vote,
  Upload,
  Loader2,
  X,
  ImageIcon,
  Inbox,
  Users,
  CheckCheck,
  Download,
  Ghost,
} from 'lucide-react'
import {
  listParticipants,
  createParticipant,
  updateParticipant,
  bulkUpdateParticipants,
  manipulateVotes,
  type ParticipantItem,
  type BulkParticipantAction,
} from '@/lib/api'
import { Checkbox } from '@/components/ui/checkbox'
import { uploadImage } from '@/lib/upload-api'
import { apiUrl, apiFetch } from '@/lib/api-client'
import { useAppStore } from '@/lib/store'
import { useRouter } from 'next/navigation'
import { ParticipantAvatar } from '@/components/shared/participant-avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
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
import { toast } from 'sonner'
import { useIsMobile } from '@/hooks/use-mobile'

const participantSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name must be less than 100 characters'),
  category: z.string().min(2, 'Category must be at least 2 characters').max(50, 'Category must be less than 50 characters'),
  platform: z.string().min(1, 'Platform is required'),
  videoUrl: z.string().url('Video URL must be a valid URL').min(10, 'Video URL must be at least 10 characters'),
  bio: z.string().max(500, 'Bio must be less than 500 characters').optional(),
  status: z.string().default('Draft'),
  imageUrl: z.string().optional(),
})

type ParticipantFormValues = z.infer<typeof participantSchema>

// Quick filter pill definitions
const statusPills: { label: string; value: string }[] = [
  { label: 'All', value: 'all' },
  { label: 'Approved', value: 'Approved' },
  { label: 'Pending', value: 'Pending' },
  { label: 'Submitted', value: 'Submitted' },
  { label: 'Under Review', value: 'Under Review' },
  { label: 'Rejected', value: 'Rejected' },
]

function participantStatusBadge(status: string) {
  const map: Record<string, { bg: string; text: string; border: string; dot: string }> = {
    Approved: { bg: 'rgba(16,185,129,0.15)', text: '#10B981', border: 'rgba(16,185,129,0.3)', dot: '#10B981' },
    Pending: { bg: 'rgba(245,158,11,0.15)', text: '#F59E0B', border: 'rgba(245,158,11,0.3)', dot: '#F59E0B' },
    Submitted: { bg: 'rgba(56,189,248,0.15)', text: '#38BDF8', border: 'rgba(56,189,248,0.3)', dot: '#38BDF8' },
    'Under Review': { bg: 'rgba(139,92,246,0.15)', text: '#8B5CF6', border: 'rgba(139,92,246,0.3)', dot: '#8B5CF6' },
    Rejected: { bg: 'rgba(239,68,68,0.15)', text: '#EF4444', border: 'rgba(239,68,68,0.3)', dot: '#EF4444' },
    Draft: { bg: 'rgba(148,163,184,0.15)', text: 'var(--text-muted)', border: 'rgba(148,163,184,0.3)', dot: 'var(--text-muted)' },
  }
  const s = map[status] || map.Draft
  return (
    <Badge style={{ background: s.bg, color: s.text, borderColor: s.border }} className="border gap-1.5">
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.dot }} />
      {status}
    </Badge>
  )
}

// Shared form fields used by both Create and Edit dialogs
function ParticipantFormFields({
  form,
}: {
  form: UseFormReturn<ParticipantFormValues>
}) {
  const [uploading, setUploading] = useState(false)
  // imagePreview takes precedence (local data URL during upload), otherwise falls back to form imageUrl
  const [imagePreview, setImagePreview] = useState<string | null>(
    form.getValues('imageUrl') || null,
  )
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imageUrl = form.watch('imageUrl') || ''
  const displayUrl = imagePreview || imageUrl

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
    // Show local preview immediately via FileReader
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setImagePreview(reader.result)
      }
    }
    reader.onerror = () => {
      toast.error('Failed to read image file')
    }
    reader.readAsDataURL(file)

    setUploading(true)
    try {
      const { url } = await uploadImage(file)
      form.setValue('imageUrl', url)
      setImagePreview(url)
      toast.success('Image uploaded')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to upload image')
      // Revert preview to whatever is currently in the form
      setImagePreview(form.getValues('imageUrl') || null)
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleRemoveImage = () => {
    form.setValue('imageUrl', '')
    setImagePreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <>
      {/* Profile Image — placed at top because it's the most visual */}
      <div className="space-y-2">
        <Label style={{ color: 'var(--text-muted)' }}>Profile Image</Label>
        <div className="flex items-center gap-4">
          <div
            className="relative w-20 h-20 rounded-full overflow-hidden flex items-center justify-center shrink-0"
            style={{
              background: displayUrl ? 'transparent' : 'var(--surface-3)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            {uploading ? (
              <Loader2 className="w-6 h-6 animate-spin" style={{ color: '#F59E0B' }} />
            ) : displayUrl ? (
              <img
                src={displayUrl}
                alt="Profile preview"
                className="w-full h-full object-cover"
              />
            ) : (
              <ImageIcon className="w-6 h-6" style={{ color: 'var(--text-muted)' }} />
            )}
          </div>
          <div className="flex flex-col gap-2">
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
              className="rounded-full w-fit h-8"
              style={{
                borderColor: 'rgba(245,158,11,0.4)',
                color: '#F59E0B',
                background: 'rgba(245,158,11,0.06)',
              }}
            >
              <Upload className="w-3.5 h-3.5 mr-1.5" />
              {uploading ? 'Uploading…' : displayUrl ? 'Change Image' : 'Upload Image'}
            </Button>
            {displayUrl && !uploading && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleRemoveImage}
                className="rounded-full w-fit h-7 text-xs"
                style={{ color: '#EF4444' }}
              >
                <X className="w-3 h-3 mr-1.5" />
                Remove
              </Button>
            )}
            <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
              PNG, JPEG, WebP, or GIF · max 2 MB
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-2">
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

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label style={{ color: 'var(--text-muted)' }}>Category</Label>
          <Select
            value={form.watch('category')}
            onValueChange={(val) => form.setValue('category', val)}
          >
            <SelectTrigger
              className="rounded-xl border-none"
              style={{ background: 'var(--surface-3)', color: 'var(--text-primary)' }}
            >
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent style={{ background: 'var(--surface-elevated)', color: 'var(--text-primary)' }}>
              <SelectItem value="Singing">Singing</SelectItem>
              <SelectItem value="Dancing">Dancing</SelectItem>
              <SelectItem value="Comedy">Comedy</SelectItem>
              <SelectItem value="Other">Other</SelectItem>
            </SelectContent>
          </Select>
          {form.formState.errors.category && (
            <p className="text-xs text-red-400">{form.formState.errors.category.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label style={{ color: 'var(--text-muted)' }}>Platform</Label>
          <Select
            value={form.watch('platform')}
            onValueChange={(val) => form.setValue('platform', val)}
          >
            <SelectTrigger
              className="rounded-xl border-none"
              style={{ background: 'var(--surface-3)', color: 'var(--text-primary)' }}
            >
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent style={{ background: 'var(--surface-elevated)', color: 'var(--text-primary)' }}>
              <SelectItem value="TikTok">TikTok</SelectItem>
              <SelectItem value="Facebook">Facebook</SelectItem>
              <SelectItem value="Instagram">Instagram</SelectItem>
              <SelectItem value="YouTube">YouTube</SelectItem>
            </SelectContent>
          </Select>
          {form.formState.errors.platform && (
            <p className="text-xs text-red-400">{form.formState.errors.platform.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label style={{ color: 'var(--text-muted)' }}>Video URL</Label>
        <Input
          {...form.register('videoUrl')}
          className="rounded-xl border-none"
          style={{ background: 'var(--surface-3)', color: 'var(--text-primary)' }}
          placeholder="https://"
        />
        {form.formState.errors.videoUrl && (
          <p className="text-xs text-red-400">{form.formState.errors.videoUrl.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label style={{ color: 'var(--text-muted)' }}>Bio</Label>
        <Input
          {...form.register('bio')}
          className="rounded-xl border-none"
          style={{ background: 'var(--surface-3)', color: 'var(--text-primary)' }}
        />
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
            <SelectValue placeholder="Select" />
          </SelectTrigger>
          <SelectContent style={{ background: 'var(--surface-elevated)', color: 'var(--text-primary)' }}>
            <SelectItem value="Draft">Draft</SelectItem>
            <SelectItem value="Pending">Pending</SelectItem>
            <SelectItem value="Submitted">Submitted</SelectItem>
            <SelectItem value="Under Review">Under Review</SelectItem>
            <SelectItem value="Approved">Approved</SelectItem>
            <SelectItem value="Rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </>
  )
}

// Tooltip wrapper helper for icon-only action buttons
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

// ─── Mobile Participant Card ────────────────────────────────────────
function MobileParticipantCard({
  participant,
  index,
  onApprove,
  onEdit,
  onDelete,
  onCopyLink,
  onViewPublic,
  onStatusChange,
  onCheatMode,
  isSuperAdmin,
}: {
  participant: ParticipantItem
  index: number
  onApprove: (id: string) => void
  onEdit: (p: ParticipantItem) => void
  onDelete: (p: ParticipantItem) => void
  onCopyLink: (p: ParticipantItem) => void
  onViewPublic: (p: ParticipantItem) => void
  onStatusChange: (id: string, status: string) => void
  onCheatMode: (p: ParticipantItem) => void
  isSuperAdmin: boolean
}) {
  const p = participant

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.04 }}
      className="relative overflow-hidden rounded-xl border"
      style={{
        background: 'var(--surface-1)',
        borderColor: 'var(--border-subtle)',
      }}
    >
      {/* Main card content */}
      <div className="p-4">
        <div className="flex items-start gap-3">
          <ParticipantAvatar name={p.name} imageUrl={p.imageUrl} thumbnailUrl={p.thumbnailUrl} size="sm" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                {p.name}
              </span>
              {participantStatusBadge(p.status)}
            </div>
            <div className="flex items-center gap-3 mt-1.5">
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {p.category}
              </span>
              <span className="text-xs" style={{ color: 'var(--border-subtle)' }}>·</span>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {p.platform}
              </span>
              <span className="text-xs" style={{ color: 'var(--border-subtle)' }}>·</span>
              <div className="flex items-center gap-1">
                <Vote className="w-3 h-3" style={{ color: '#F59E0B' }} />
                <span className="text-xs font-medium tabular-nums" style={{ color: '#F59E0B' }}>
                  {p.votes.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Action buttons row */}
        <div className="flex items-center gap-2 mt-3 pt-3 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
          {(p.status === 'Submitted' || p.status === 'Under Review' || p.status === 'Pending') && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2.5 text-xs gap-1.5 hover:bg-emerald-500/10"
              onClick={() => onApprove(p.id)}
            >
              <CheckCircle className="w-3.5 h-3.5" style={{ color: '#10B981' }} />
              Approve
            </Button>
          )}
          {p.status !== 'Rejected' && p.status !== 'Approved' && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2.5 text-xs gap-1.5 hover:bg-red-500/10"
              onClick={() => onStatusChange(p.id, 'Rejected')}
            >
              <XCircle className="w-3.5 h-3.5" style={{ color: '#EF4444' }} />
              Reject
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2.5 text-xs gap-1.5 hover:bg-amber-500/10"
            onClick={() => onEdit(p)}
          >
            <Pencil className="w-3.5 h-3.5" style={{ color: '#F59E0B' }} />
            Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2.5 text-xs gap-1.5 hover:bg-red-500/10"
            onClick={() => onDelete(p)}
          >
            <Trash2 className="w-3.5 h-3.5" style={{ color: '#EF4444' }} />
            Delete
          </Button>
          {isSuperAdmin && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2.5 text-xs gap-1.5 hover:bg-purple-500/10"
              onClick={() => onCheatMode(p)}
            >
              <Ghost className="w-3.5 h-3.5" style={{ color: '#8B5CF6' }} />
              Cheat Mode
            </Button>
          )}
          <div className="flex-1" />
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2.5 text-xs gap-1.5 hover:bg-sky-500/10"
            onClick={() => onViewPublic(p)}
          >
            <Eye className="w-3.5 h-3.5" style={{ color: '#38BDF8' }} />
          </Button>
        </div>
      </div>
    </motion.div>
  )
}

export function AdminParticipantsView() {
  const router = useRouter()
  const isMobile = useIsMobile()
  const { adminUser } = useAppStore()
  const isSuperAdmin = adminUser?.role === 'Super Admin'
  const [participants, setParticipants] = useState<ParticipantItem[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<ParticipantItem | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  // Bulk-selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkLoading, setBulkLoading] = useState<BulkParticipantAction | null>(null)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)

  // Clear selection whenever the filters change so the selection
  // never silently references rows that are no longer visible.
  useEffect(() => {
    setSelectedIds(new Set())
  }, [search, statusFilter])

  const fetchParticipants = useCallback(async () => {
    try {
      const params: Record<string, string> = {}
      if (search) params.search = search
      if (statusFilter && statusFilter !== 'all') params.status = statusFilter

      const { participants: pts } = await listParticipants(params)
      setParticipants(pts)
    } catch {
      toast.error('Failed to fetch participants')
    } finally {
      setLoading(false)
    }
  }, [search, statusFilter])

  // Fetch the unfiltered total once on mount so we can show "X of Y"
  useEffect(() => {
    let cancelled = false
    listParticipants()
      .then(({ participants: all }) => {
        if (!cancelled) setTotalCount(all.length)
      })
      .catch(() => {
        /* best-effort */
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    fetchParticipants()
  }, [fetchParticipants])

  // Create form
  const createForm = useForm<ParticipantFormValues>({
    resolver: zodResolver(participantSchema) as any,
    defaultValues: {
      name: '',
      category: '',
      platform: '',
      videoUrl: '',
      bio: '',
      status: 'Draft',
      imageUrl: '',
    },
  })

  // Edit form
  const editForm = useForm<ParticipantFormValues>({
    resolver: zodResolver(participantSchema) as any,
    defaultValues: {
      name: '',
      category: '',
      platform: '',
      videoUrl: '',
      bio: '',
      status: 'Draft',
      imageUrl: '',
    },
  })

  const [editingParticipant, setEditingParticipant] = useState<ParticipantItem | null>(null)

  const onCreateSubmit = async (values: ParticipantFormValues) => {
    setSubmitting(true)
    try {
      const result = await createParticipant(values)
      toast.success('Participant created')
      
      // Generate filtered link for the new contestant
      const contestantLink = `${window.location.origin}/contestants?participant=${result.participant.id}`
      navigator.clipboard.writeText(contestantLink)
      toast.success('Contestant link copied to clipboard!', {
        description: contestantLink
      })
      
      setFormOpen(false)
      createForm.reset()
      fetchParticipants()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create participant')
    } finally {
      setSubmitting(false)
    }
  }

  const onEditSubmit = async (values: ParticipantFormValues) => {
    if (!editingParticipant) return
    setSubmitting(true)
    try {
      await updateParticipant(editingParticipant.id, values)
      toast.success('Participant updated')
      setEditOpen(false)
      setEditingParticipant(null)
      fetchParticipants()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update participant')
    } finally {
      setSubmitting(false)
    }
  }

  const handleEditClick = (p: ParticipantItem) => {
    setEditingParticipant(p)
    editForm.reset({
      name: p.name,
      category: p.category,
      platform: p.platform,
      videoUrl: p.videoUrl,
      bio: p.bio || '',
      status: p.status,
      imageUrl: p.imageUrl || '',
    })
    setEditOpen(true)
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(apiUrl(`/participants/${deleteTarget.id}`), { 
        method: 'DELETE',
        credentials: 'include'
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Failed to delete participant')
      toast.success(`${deleteTarget.name} deleted`)
      setDeleteTarget(null)
      fetchParticipants()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete participant')
    } finally {
      setDeleting(false)
    }
  }

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      await updateParticipant(id, { status: newStatus })
      toast.success(`Participant ${newStatus.toLowerCase()}`)
      fetchParticipants()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update status')
    }
  }

  const handleApprove = async (id: string) => {
    await handleStatusChange(id, 'Approved')
  }

  const handleCheatMode = (p: ParticipantItem) => {
    const newVoteCount = prompt(`Cheat Mode: Enter new vote count for ${p.name}\nCurrent votes: ${p.votes}`)
    if (newVoteCount === null) return // User cancelled
    
    const voteCount = parseInt(newVoteCount)
    if (isNaN(voteCount) || voteCount < 0) {
      toast.error('Invalid vote count. Please enter a non-negative number.')
      return
    }
    
    if (confirm(`Are you sure you want to change ${p.name}'s votes from ${p.votes} to ${voteCount}?`)) {
      manipulateVotes(p.id, voteCount)
        .then((result) => {
          toast.success(result.message)
          fetchParticipants() // Refresh to show updated votes
        })
        .catch((err) => {
          toast.error(err instanceof Error ? err.message : 'Failed to manipulate votes')
        })
    }
  }

  // ─── CSV export ───────────────────────────────────────────────
  // Trigger a server-side CSV download from /api/participants?format=csv.
  // Use fetch with credentials to ensure cookies are sent, then create download link.
  const handleExportCsv = async () => {
    try {
      const params = new URLSearchParams()
      params.set('format', 'csv')
      if (search.trim()) params.set('search', search.trim())
      if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter)
      
      const res = await fetch(apiUrl(`/participants?${params.toString()}`), {
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
      link.setAttribute('download', `vibehub-participants-${new Date().toISOString().slice(0, 10)}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      toast.success('CSV exported')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to export CSV')
    }
  }

  // ─── Bulk actions ────────────────────────────────────────────
  const toggleRowSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const allVisibleSelected =
  (participants?.length ?? 0) > 0 &&
  participants.every((p) => selectedIds.has(p.id))
  const someVisibleSelected =
    participants.some((p) => selectedIds.has(p.id)) && !allVisibleSelected

  const toggleSelectAllVisible = () => {
    setSelectedIds((prev) => {
      if (allVisibleSelected) {
        // Clear only the visible rows; preserve selection of any
        // rows that are NOT currently displayed (defensive — there
        // shouldn't be any since filters clear selection).
        const next = new Set(prev)
        participants.forEach((p) => next.delete(p.id))
        return next
      }
      const next = new Set(prev)
      participants.forEach((p) => next.add(p.id))
      return next
    })
  }

  const clearSelection = () => setSelectedIds(new Set())

  const runBulkAction = async (
    action: BulkParticipantAction,
    verb: string
  ) => {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return
    setBulkLoading(action)
    try {
      const { affected } = await bulkUpdateParticipants(ids, action)
      toast.success(
        `${verb.charAt(0).toUpperCase() + verb.slice(1)} ${affected} participant${
          affected === 1 ? '' : 's'
        }`
      )
      clearSelection()
      await fetchParticipants()
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : `Failed to ${action} participants`
      )
    } finally {
      setBulkLoading(null)
    }
  }

  const handleBulkApprove = () => runBulkAction('approve', 'approved')
  const handleBulkReject = () => runBulkAction('reject', 'rejected')

  const handleBulkDelete = async () => {
    setBulkDeleteOpen(false)
    await runBulkAction('delete', 'deleted')
  }

  const handleCopyParticipantLink = (p: ParticipantItem) => {
    const link = `${window.location.origin}/contestants/${p.id}`
    navigator.clipboard.writeText(link).then(() => {
      toast.success('Participant link copied to clipboard!')
    }).catch(() => {
      toast.error('Failed to copy link')
    })
  }

  const handleViewPublic = (p: ParticipantItem) => {
    router.push(`/contestants/${p.id}`)
  }

  // Active filters (for empty-state copy)
  const hasActiveFilters =
    statusFilter !== 'all' || search.trim() !== ''

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex items-center justify-between flex-wrap gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Participants</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Manage contestants and their status</p>
        </div>
        <Button
          onClick={() => {
            createForm.reset()
            setFormOpen(true)
          }}
          className="rounded-full gap-2 focus-ring-gold button-press fade-in-up"
          style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)', color: 'var(--surface-3)' }}
        >
          <Plus className="w-4 h-4" /> Add Participant
        </Button>
      </motion.div>

      {/* Status Quick Filter Pills (consolidated — no dropdown) */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.03 }}
        className="flex flex-wrap gap-2 items-center"
      >
        {statusPills.map((pill) => {
          const active = statusFilter === pill.value
          const count =
            pill.value === 'all'
              ? totalCount
              : participants.filter((p) => p.status === pill.value).length
          return (
            <button
              key={pill.value}
              onClick={() => setStatusFilter(pill.value)}
              className="px-4 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-2"
              style={{
                background: active
                  ? 'linear-gradient(135deg, #F59E0B, #D97706)'
                  : 'var(--surface-3)',
                color: active ? 'var(--surface-3)' : 'var(--text-muted)',
                border: `1px solid ${active ? 'rgba(245,158,11,0.4)' : 'var(--border-subtle)'}`,
              }}
            >
              {pill.label}
              {pill.value !== 'all' && count > 0 && (
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded-full"
                  style={{
                    background: active ? 'var(--surface-3)' : 'var(--border-subtle)',
                    color: active ? 'var(--surface-3)' : 'var(--text-muted)',
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
      <div className="flex items-center gap-2 -mt-2 text-xs flex-wrap" style={{ color: 'var(--text-muted)' }}>
        <Users className="w-3.5 h-3.5" />
        <span>
          Showing <span style={{ color: 'var(--text-muted)' }}>{loading ? '…' : participants.length}</span> of{' '}
          <span style={{ color: 'var(--text-muted)' }}>{totalCount}</span> participants
        </span>
        {selectedIds.size > 0 && (
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium"
            style={{
              background: 'rgba(245,158,11,0.12)',
              color: '#F59E0B',
              border: '1px solid rgba(245,158,11,0.3)',
            }}
          >
            <CheckCheck className="w-3 h-3" />
            {selectedIds.size} selected
          </span>
        )}
      </div>

      {/* Search + Platform Filter (status filter is handled by pills above) */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05 }}
        className="flex flex-wrap gap-3"
      >
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
          <Input
            placeholder="Search participants…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 rounded-xl border-none input-focus-gold"
            style={{ background: 'var(--surface-3)', color: 'var(--text-primary)' }}
          />
        </div>
        <div className="flex gap-2 items-center">
          <Button
            onClick={handleExportCsv}
            disabled={loading || participants.length === 0}
            className="rounded-full shrink-0 button-press"
            style={{
              background: '#F59E0B',
              color: 'var(--surface-3)',
              fontWeight: 600,
            }}
          >
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </motion.div>

      {/* Table / Mobile Cards */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        {/* Desktop: Table */}
        {!isMobile && (
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
                <TableHead className="w-[44px] pr-0">
                  <Checkbox
                    aria-label="Select all visible participants"
                    checked={
                      allVisibleSelected
                        ? true
                        : someVisibleSelected
                          ? 'indeterminate'
                          : false
                    }
                    onCheckedChange={toggleSelectAllVisible}
                    disabled={!participants.length}
                    className="border-border data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500 data-[state=checked]:text-[#0B0F17]"
                  />
                </TableHead>
                <TableHead style={{ color: 'var(--text-muted)' }} className="w-[280px]">Name</TableHead>
                <TableHead style={{ color: 'var(--text-muted)' }} className="w-[120px]">Category</TableHead>
                <TableHead style={{ color: 'var(--text-muted)' }} className="w-[120px]">Platform</TableHead>
                <TableHead style={{ color: 'var(--text-muted)' }} className="w-[140px]">Status</TableHead>
                <TableHead style={{ color: 'var(--text-muted)' }} className="w-[110px]">Votes</TableHead>
                <TableHead style={{ color: 'var(--text-muted)' }} className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12" style={{ color: 'var(--text-muted)' }}>
                    <Loader2 className="w-5 h-5 animate-spin inline-block mr-2" style={{ color: '#F59E0B' }} />
                    Loading participants…
                  </TableCell>
                </TableRow>
              ) : participants.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-16">
                    <div className="flex flex-col items-center gap-3">
                      <div
                        className="w-14 h-14 rounded-full flex items-center justify-center"
                        style={{
                          background: 'rgba(245,158,11,0.1)',
                          border: '1px solid rgba(245,158,11,0.2)',
                        }}
                      >
                        <Inbox className="w-7 h-7" style={{ color: '#F59E0B' }} />
                      </div>
                      <div>
                        <p className="font-medium" style={{ color: 'var(--text-primary)' }}>
                          {hasActiveFilters ? 'No participants match your filters' : 'No participants yet'}
                        </p>
                        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                          {hasActiveFilters
                            ? 'Try adjusting your search or filters.'
                            : 'Click "Add Participant" to create your first contestant.'}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                participants.map((p) => {
                  const isSelected = selectedIds.has(p.id)
                  return (
                    <TableRow
                      key={p.id}
                      data-state={isSelected ? 'selected' : undefined}
                      className="transition-colors glass-card-hover"
                      style={{
                        borderBottomColor: 'var(--surface-3)',
                        background: isSelected ? 'rgba(245,158,11,0.07)' : undefined,
                      }}
                    >
                      <TableCell className="pr-0">
                        <Checkbox
                          aria-label={`Select ${p.name}`}
                          checked={isSelected}
                          onCheckedChange={() => toggleRowSelection(p.id)}
                          className="border-border data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500 data-[state=checked]:text-[#0B0F17]"
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <ParticipantAvatar name={p.name} imageUrl={p.imageUrl} thumbnailUrl={p.thumbnailUrl} size="xs" />
                          <div className="flex flex-col min-w-0">
                            <span className="font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                              {p.name}
                            </span>
                            {p.bio && (
                              <span className="text-[11px] truncate max-w-[180px]" style={{ color: 'var(--text-muted)' }}>
                                {p.bio}
                              </span>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell style={{ color: 'var(--text-muted)' }}>{p.category}</TableCell>
                      <TableCell style={{ color: 'var(--text-muted)' }}>{p.platform}</TableCell>
                      <TableCell>{participantStatusBadge(p.status)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
                          <Vote className="w-3.5 h-3.5" style={{ color: '#F59E0B' }} />
                          <span className="tabular-nums">{p.votes.toLocaleString()}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 justify-end">
                          {/* Approve button for Submitted/Under Review/Pending */}
                          {(p.status === 'Submitted' || p.status === 'Under Review' || p.status === 'Pending') && (
                            <ActionTooltip label="Approve">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 hover:bg-emerald-500/10"
                                onClick={() => handleApprove(p.id)}
                              >
                                <CheckCircle className="w-4 h-4" style={{ color: '#10B981' }} />
                              </Button>
                            </ActionTooltip>
                          )}
                          {/* Reject button for non-rejected */}
                          {p.status !== 'Rejected' && p.status !== 'Approved' && (
                            <ActionTooltip label="Reject">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 hover:bg-red-500/10"
                                onClick={() => handleStatusChange(p.id, 'Rejected')}
                              >
                                <XCircle className="w-4 h-4" style={{ color: '#EF4444' }} />
                              </Button>
                            </ActionTooltip>
                          )}
                          {/* Edit Participant */}
                          <ActionTooltip label="Edit Participant">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 hover:bg-amber-500/10"
                              onClick={() => handleEditClick(p)}
                            >
                              <Pencil className="w-4 h-4" style={{ color: '#F59E0B' }} />
                            </Button>
                          </ActionTooltip>
                          {/* Delete Participant */}
                          <ActionTooltip label="Delete Participant">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 hover:bg-red-500/10"
                              onClick={() => setDeleteTarget(p)}
                            >
                              <Trash2 className="w-4 h-4" style={{ color: '#EF4444' }} />
                            </Button>
                          </ActionTooltip>
                          {/* Copy Participant Link */}
                          <ActionTooltip label="Copy Link">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 hover:bg-amber-500/10"
                              onClick={() => handleCopyParticipantLink(p)}
                            >
                              <Copy className="w-4 h-4" style={{ color: '#F59E0B' }} />
                            </Button>
                          </ActionTooltip>
                          {/* Go to Public View */}
                          <ActionTooltip label="View Public Profile">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 hover:bg-sky-500/10"
                              onClick={() => handleViewPublic(p)}
                            >
                              <Eye className="w-4 h-4" style={{ color: '#38BDF8' }} />
                            </Button>
                          </ActionTooltip>
                          {/* Cheat Mode - Only for Super Admins */}
                          {isSuperAdmin && (
                            <ActionTooltip label="Cheat Mode">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 hover:bg-purple-500/10"
                                onClick={() => handleCheatMode(p)}
                              >
                                <Ghost className="w-4 h-4" style={{ color: '#8B5CF6' }} />
                              </Button>
                            </ActionTooltip>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
        )}

        {/* Mobile: Card-based layout */}
        {isMobile && (
          <div className="space-y-3">
            {loading ? (
              <div className="text-center py-12" style={{ color: 'var(--text-muted)' }}>
                <Loader2 className="w-5 h-5 animate-spin inline-block mr-2" style={{ color: '#F59E0B' }} />
                Loading participants…
              </div>
            ) : participants.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-16">
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center"
                  style={{
                    background: 'rgba(245,158,11,0.1)',
                    border: '1px solid rgba(245,158,11,0.2)',
                  }}
                >
                  <Inbox className="w-7 h-7" style={{ color: '#F59E0B' }} />
                </div>
                <div>
                  <p className="font-medium text-center" style={{ color: 'var(--text-primary)' }}>
                    {hasActiveFilters ? 'No participants match your filters' : 'No participants yet'}
                  </p>
                  <p className="text-xs mt-1 text-center" style={{ color: 'var(--text-muted)' }}>
                    {hasActiveFilters
                      ? 'Try adjusting your search or filters.'
                      : 'Tap "Add" to create your first contestant.'}
                  </p>
                </div>
              </div>
            ) : (
              participants.map((p, idx) => (
                <MobileParticipantCard
                  key={p.id}
                  participant={p}
                  index={idx}
                  onApprove={handleApprove}
                  onEdit={handleEditClick}
                  onDelete={setDeleteTarget}
                  onCopyLink={handleCopyParticipantLink}
                  onViewPublic={handleViewPublic}
                  onStatusChange={handleStatusChange}
                  onCheatMode={handleCheatMode}
                  isSuperAdmin={isSuperAdmin}
                />
              ))
            )}
          </div>
        )}
      </motion.div>

      {/* Sticky bulk action bar — appears only when rows are selected */}
      {selectedIds.size > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ duration: 0.2 }}
          className="sticky bottom-4 z-30"
        >
          <div
            className="rounded-2xl border backdrop-blur-md shadow-2xl p-3 sm:p-4 flex flex-wrap items-center gap-2 sm:gap-3"
            style={{
              background: 'rgba(18,24,36,0.95)',
              borderColor: 'rgba(245,158,11,0.35)',
            }}
          >
            <div className="flex items-center gap-2 mr-auto">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                style={{
                  background: 'rgba(245,158,11,0.15)',
                  border: '1px solid rgba(245,158,11,0.3)',
                }}
              >
                <CheckCheck className="w-4 h-4" style={{ color: '#F59E0B' }} />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {selectedIds.size} participant{selectedIds.size === 1 ? '' : 's'} selected
                </span>
                <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  Choose an action below
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                onClick={handleBulkApprove}
                disabled={bulkLoading !== null}
                className="rounded-full gap-1.5 h-9"
                style={{
                  background: 'rgba(16,185,129,0.15)',
                  color: '#10B981',
                  border: '1px solid rgba(16,185,129,0.35)',
                }}
              >
                {bulkLoading === 'approve' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <CheckCircle className="w-3.5 h-3.5" />
                )}
                Approve Selected
              </Button>
              <Button
                size="sm"
                onClick={handleBulkReject}
                disabled={bulkLoading !== null}
                className="rounded-full gap-1.5 h-9"
                style={{
                  background: 'rgba(245,158,11,0.15)',
                  color: '#F59E0B',
                  border: '1px solid rgba(245,158,11,0.35)',
                }}
              >
                {bulkLoading === 'reject' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <XCircle className="w-3.5 h-3.5" />
                )}
                Reject Selected
              </Button>
              <Button
                size="sm"
                onClick={() => setBulkDeleteOpen(true)}
                disabled={bulkLoading !== null}
                className="rounded-full gap-1.5 h-9"
                style={{
                  background: 'rgba(239,68,68,0.15)',
                  color: '#EF4444',
                  border: '1px solid rgba(239,68,68,0.35)',
                }}
              >
                {bulkLoading === 'delete' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
                Delete Selected
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={clearSelection}
                disabled={bulkLoading !== null}
                className="rounded-full gap-1.5 h-9"
                style={{ color: 'var(--text-muted)' }}
              >
                <X className="w-3.5 h-3.5" />
                Clear Selection
              </Button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Create Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="glass-premium"
          style={{
            background: 'var(--surface-1)',
            borderColor: 'var(--border-subtle)',
            color: 'var(--text-primary)',
          }}
        >
          <DialogHeader>
            <DialogTitle style={{ color: 'var(--text-primary)' }}>Add Participant</DialogTitle>
          </DialogHeader>
          <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
            <ParticipantFormFields form={createForm} />
            <DialogFooter>
              <Button
                type="submit"
                disabled={submitting}
                className="rounded-full focus-ring-gold"
          style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)', color: 'var(--surface-3)' }}
              >
                {submitting ? 'Adding…' : 'Add Participant'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={(open) => {
        setEditOpen(open)
        if (!open) setEditingParticipant(null)
      }}>
        <DialogContent className="glass-premium"
          style={{
            background: 'var(--surface-1)',
            borderColor: 'var(--border-subtle)',
            color: 'var(--text-primary)',
          }}
        >
          <DialogHeader>
            <DialogTitle style={{ color: 'var(--text-primary)' }}>Edit Participant</DialogTitle>
          </DialogHeader>
          <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
            <ParticipantFormFields form={editForm} />
            <DialogFooter>
              <Button
                type="submit"
                disabled={submitting}
                className="rounded-full focus-ring-gold"
          style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)', color: 'var(--surface-3)' }}
              >
                {submitting ? 'Saving…' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => {
        if (!open) setDeleteTarget(null)
      }}>
        <AlertDialogContent
          className="glass-premium"
          style={{
            background: 'var(--surface-1)',
            borderColor: 'var(--border-subtle)',
            color: 'var(--text-primary)',
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle style={{ color: 'var(--text-primary)' }}>Delete Participant</AlertDialogTitle>
            <AlertDialogDescription style={{ color: 'var(--text-muted)' }}>
              Are you sure you want to delete{' '}
              <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                {deleteTarget?.name}
              </span>
              ? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              className="rounded-xl"
              style={{ background: 'var(--surface-3)', color: 'var(--text-primary)', borderColor: 'var(--border-subtle)' }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleDelete()
              }}
              disabled={deleting}
              className="rounded-xl"
              style={{ background: '#EF4444', color: '#FFFFFF' }}
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Confirmation Dialog */}
      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent
          className="glass-premium"
          style={{
            background: 'var(--surface-1)',
            borderColor: 'var(--border-subtle)',
            color: 'var(--text-primary)',
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle style={{ color: 'var(--text-primary)' }}>
              Delete {selectedIds.size} Participant{selectedIds.size === 1 ? '' : 's'}
            </AlertDialogTitle>
            <AlertDialogDescription style={{ color: 'var(--text-muted)' }}>
              Are you sure you want to delete{' '}
              <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                {selectedIds.size} participant{selectedIds.size === 1 ? '' : 's'}
              </span>
              ? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              className="rounded-xl"
              style={{ background: 'var(--surface-3)', color: 'var(--text-primary)', borderColor: 'var(--border-subtle)' }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleBulkDelete()
              }}
              disabled={bulkLoading === 'delete'}
              className="rounded-xl"
              style={{ background: '#EF4444', color: '#FFFFFF' }}
            >
              {bulkLoading === 'delete' ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
