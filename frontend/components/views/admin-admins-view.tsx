'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { UserPlus, Shield, ShieldCheck, ShieldAlert, Download } from 'lucide-react'
import { listAdmins, inviteAdmin, type AdminItem } from '@/lib/api'
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
import { toast } from 'sonner'
import { apiUrl, apiFetch } from '@/lib/api-client'

const inviteSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Valid email is required'),
  role: z.string().min(1, 'Role is required'),
})

type InviteFormValues = z.infer<typeof inviteSchema>

function roleBadge(role: string) {
  switch (role) {
    case 'Super Admin':
      return (
        <Badge className="gap-1" style={{ background: 'rgba(245,158,11,0.15)', color: '#F59E0B', borderColor: 'rgba(245,158,11,0.3)' }}>
          <ShieldAlert className="w-3 h-3" /> Super Admin
        </Badge>
      )
    case 'Admin':
      return (
        <Badge className="gap-1" style={{ background: 'rgba(56,189,248,0.15)', color: '#38BDF8', borderColor: 'rgba(56,189,248,0.3)' }}>
          <ShieldCheck className="w-3 h-3" /> Admin
        </Badge>
      )
    case 'Moderator':
      return (
        <Badge className="gap-1" style={{ background: 'rgba(168,85,247,0.15)', color: '#A855F7', borderColor: 'rgba(168,85,247,0.3)' }}>
          <Shield className="w-3 h-3" /> Moderator
        </Badge>
      )
    default:
      return (
        <Badge className="gap-1" style={{ background: 'rgba(148,163,184,0.15)', color: 'var(--text-muted)', borderColor: 'rgba(148,163,184,0.3)' }}>
          <Shield className="w-3 h-3" /> {role}
        </Badge>
      )
  }
}

export function AdminAdminsView() {
  const [admins, setAdmins] = useState<AdminItem[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const fetchAdmins = async () => {
    try {
      const { admins: a } = await listAdmins()
      setAdmins(a)
    } catch {
      toast.error('Failed to fetch admins')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAdmins()
  }, [])

  const form = useForm<InviteFormValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { name: '', email: '', role: 'Admin' },
  })

  const onSubmit = async (values: InviteFormValues) => {
    setSubmitting(true)
    try {
      await inviteAdmin(values)
      toast.success('Admin invited successfully')
      setFormOpen(false)
      form.reset()
      fetchAdmins()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to invite admin')
    } finally {
      setSubmitting(false)
    }
  }

  const handleExportCsv = async () => {
    try {
      const res = await fetch(apiUrl('/admins?format=csv'), { credentials: 'include' })
      if (!res.ok) throw new Error('Export failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `admins-${Date.now()}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success('CSV exported')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Export failed')
    }
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Admin Users</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Manage team members and permissions</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={handleExportCsv}
            disabled={admins.length === 0}
            className="rounded-full gap-2 focus-ring-gold"
            style={{
              background: 'var(--surface-2)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <Download className="w-4 h-4" /> Export CSV
          </Button>
          <Button
            onClick={() => {
              form.reset()
              setFormOpen(true)
            }}
            className="rounded-full gap-2 focus-ring-gold"
            style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)', color: 'var(--surface-3)' }}
          >
            <UserPlus className="w-4 h-4" /> Invite Admin
          </Button>
        </div>
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
                <TableHead style={{ color: 'var(--text-muted)' }}>Name</TableHead>
                <TableHead style={{ color: 'var(--text-muted)' }}>Email</TableHead>
                <TableHead style={{ color: 'var(--text-muted)' }}>Role</TableHead>
                <TableHead style={{ color: 'var(--text-muted)' }}>Status</TableHead>
                <TableHead style={{ color: 'var(--text-muted)' }}>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
                    Loading...
                  </TableCell>
                </TableRow>
              ) : admins.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
                    No admin users found
                  </TableCell>
                </TableRow>
              ) : (
                admins.map((admin) => (
                  <TableRow
                    key={admin.id}
                    style={{ borderBottomColor: 'var(--surface-3)' }}
                  >
                    <TableCell className="font-medium" style={{ color: 'var(--text-primary)' }}>
                      {admin.name}
                    </TableCell>
                    <TableCell className="text-sm" style={{ color: 'var(--text-muted)' }}>
                      {admin.email}
                    </TableCell>
                    <TableCell>{roleBadge(admin.role)}</TableCell>
                    <TableCell>
                      {admin.isActive ? (
                        <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30 status-dot status-dot-approved">
                          Active
                        </Badge>
                      ) : (
                        <Badge className="bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/30 status-dot status-dot-rejected">
                          Inactive
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="rounded-full text-xs"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </motion.div>

      {/* Invite Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="glass-premium"
          style={{
            background: 'var(--surface-1)',
            borderColor: 'var(--border-subtle)',
            color: 'var(--text-primary)',
          }}
        >
          <DialogHeader>
            <DialogTitle style={{ color: 'var(--text-primary)' }}>Invite Admin</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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

            <div className="space-y-2">
              <Label style={{ color: 'var(--text-muted)' }}>Email</Label>
              <Input
                type="email"
                {...form.register('email')}
                className="rounded-xl border-none"
                style={{ background: 'var(--surface-3)', color: 'var(--text-primary)' }}
              />
              {form.formState.errors.email && (
                <p className="text-xs text-red-400">{form.formState.errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label style={{ color: 'var(--text-muted)' }}>Role</Label>
              <Select
                value={form.watch('role')}
                onValueChange={(val) => form.setValue('role', val)}
              >
                <SelectTrigger
                  className="rounded-xl border-none"
                  style={{ background: 'var(--surface-3)', color: 'var(--text-primary)' }}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent style={{ background: 'var(--surface-elevated)', color: 'var(--text-primary)' }}>
                  <SelectItem value="Admin">Admin</SelectItem>
                  <SelectItem value="Super Admin">Super Admin</SelectItem>
                  <SelectItem value="Moderator">Moderator</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <DialogFooter>
              <Button
                type="submit"
                disabled={submitting}
                className="rounded-full focus-ring-gold"
          style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)', color: 'var(--surface-3)' }}
              >
                {submitting ? 'Inviting…' : 'Send Invitation'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
