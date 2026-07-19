'use client'

import { useState, useEffect, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { motion } from 'framer-motion'
import { Plus, UserX, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { listAdmins, inviteAdmin, invalidateAdmin, type AdminUserApi } from '@/lib/api'
import { useSession } from '@/lib/use-session'

const inviteSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  role: z.string().min(1, 'Role is required'),
})

type InviteValues = z.infer<typeof inviteSchema>

export function AdminAdminsPage() {
  const { user: adminUser } = useSession()
  const [admins, setAdmins] = useState<AdminUserApi[]>([])
  const [loading, setLoading] = useState(true)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [invalidateOpen, setInvalidateOpen] = useState(false)
  const [invalidatingId, setInvalidatingId] = useState<string | null>(null)
  const [inviting, setInviting] = useState(false)

  const fetchAdmins = useCallback(async () => {
    try {
      const result = await listAdmins()
      setAdmins(result)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to fetch admins')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAdmins()
  }, [fetchAdmins])

  const form = useForm<InviteValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { email: '', role: 'Admin' },
  })

  const openInvite = () => {
    form.reset({ email: '', role: 'Admin' })
    setInviteOpen(true)
  }

  const onInvite = async (values: InviteValues) => {
    setInviting(true)
    try {
      await inviteAdmin(values.email, values.role)
      toast.success('Invitation sent')
      setInviteOpen(false)
      await fetchAdmins()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to send invitation')
    } finally {
      setInviting(false)
    }
  }

  const openInvalidate = (id: string) => {
    setInvalidatingId(id)
    setInvalidateOpen(true)
  }

  const onInvalidate = async () => {
    if (invalidatingId) {
      try {
        await invalidateAdmin(invalidatingId)
        toast.success('Admin invalidated')
        await fetchAdmins()
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : 'Failed to invalidate admin')
      }
    }
    setInvalidateOpen(false)
    setInvalidatingId(null)
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
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Admin Users</h1>
            <p className="text-xs text-muted-foreground mt-1">
              Only Super Admins can manage admin accounts
            </p>
          </div>
          <Button onClick={openInvite} className="rounded-full">
            <Plus className="size-4" />
            Invite Admin
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
                  <TableHead className="text-muted-foreground text-xs font-medium hidden sm:table-cell">
                    Email
                  </TableHead>
                  <TableHead className="text-muted-foreground text-xs font-medium">
                    Role
                  </TableHead>
                  <TableHead className="text-muted-foreground text-xs font-medium">
                    Status
                  </TableHead>
                  <TableHead className="text-muted-foreground text-xs font-medium hidden md:table-cell">
                    Created
                  </TableHead>
                  <TableHead className="text-muted-foreground text-xs font-medium text-right">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {admins.map((a) => {
                  const canInvalidate =
                    a.role !== 'Super Admin' && a.id !== adminUser?.id
                  return (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium text-sm">
                        {a.name}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground hidden sm:table-cell">
                        {a.email}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{a.role}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50">
                          Active
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground hidden md:table-cell">
                        —
                      </TableCell>
                      <TableCell className="text-right">
                        {canInvalidate && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive rounded-full"
                            onClick={() => openInvalidate(a.id)}
                          >
                            <UserX className="size-3.5" />
                            <span className="hidden sm:inline ml-1">
                              Invalidate
                            </span>
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      </motion.div>

      {/* Invite Dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invite Admin</DialogTitle>
            <DialogDescription>
              Send an invitation email to add a new admin or moderator.
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onInvite)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="newadmin@vibewave.co.zw"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Admin">Admin</SelectItem>
                        <SelectItem value="Moderator">Moderator</SelectItem>
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
                  onClick={() => setInviteOpen(false)}
                  className="rounded-full"
                >
                  Cancel
                </Button>
                <Button type="submit" className="rounded-full" disabled={inviting}>
                  {inviting && <Loader2 className="size-4 animate-spin" />}
                  Send Invitation
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Invalidate Confirmation */}
      <AlertDialog open={invalidateOpen} onOpenChange={setInvalidateOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Invalidate Admin</AlertDialogTitle>
            <AlertDialogDescription>
              This will immediately deactivate the admin account. They will no
              longer be able to access the admin panel. This action can be
              reversed by re-inviting them.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={onInvalidate}
              className="rounded-full bg-destructive text-white hover:bg-destructive/90"
            >
              Invalidate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}