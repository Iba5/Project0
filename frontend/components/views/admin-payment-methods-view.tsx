'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Plus,
  Pencil,
  Trash2,
  X,
  CreditCard,
  Smartphone,
  Ticket,
  Loader2,
  Search,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { apiUrl } from '@/lib/api-client'
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
import { toast } from 'sonner'

const paymentMethodSchema = z.object({
  method: z.string().min(1, 'Method identifier is required'),
  methodType: z.string().min(1, 'Method type is required'),
  displayName: z.string().min(1, 'Display name is required'),
  description: z.string().optional(),
  isEnabled: z.boolean().default(true),
  sortOrder: z.coerce.number().min(0, 'Sort order must be >= 0'),
  iconName: z.string().optional(),
})

type PaymentMethodFormValues = z.infer<typeof paymentMethodSchema>

interface PaymentMethod {
  id: string
  method: string
  methodType: string
  displayName: string
  description?: string
  isEnabled: boolean
  sortOrder: number
  iconName?: string
  configData?: any
  createdAt: string
  updatedAt: string
}

const METHOD_TYPES = [
  { label: 'Web (Card)', value: 'web' },
  { label: 'Mobile Money', value: 'mobile' },
  { label: 'Offline/Voucher', value: 'offline' },
]

const ICON_OPTIONS = [
  { label: 'Credit Card', value: 'credit-card' },
  { label: 'Smartphone', value: 'smartphone' },
  { label: 'PayPal', value: 'paypal' },
  { label: 'Ticket/Voucher', value: 'ticket' },
  { label: 'Bank', value: 'building-2' },
]

export default function AdminPaymentMethodsView() {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<PaymentMethodFormValues>({
    resolver: zodResolver(paymentMethodSchema),
  })

  const fetchPaymentMethods = async () => {
    try {
      const response = await fetch(apiUrl('/payment-methods'), {
        credentials: 'include',
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error?.detail || 'Failed to fetch payment methods')
      }
      const data = await response.json()
      setPaymentMethods(data)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load payment methods')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPaymentMethods()
  }, [])

  const handleCreate = async (values: PaymentMethodFormValues) => {
    try {
      const response = await fetch(apiUrl('/payment-methods'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(values),
      })
      if (!response.ok) throw new Error('Failed to create payment method')
      toast.success('Payment method created successfully')
      setIsCreateDialogOpen(false)
      reset()
      fetchPaymentMethods()
    } catch (error) {
      toast.error('Failed to create payment method')
      console.error(error)
    }
  }

  const handleUpdate = async (values: PaymentMethodFormValues) => {
    if (!selectedMethod) return
    try {
      const response = await fetch(apiUrl(`/payment-methods/${selectedMethod.id}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(values),
      })
      if (!response.ok) throw new Error('Failed to update payment method')
      toast.success('Payment method updated successfully')
      setIsEditDialogOpen(false)
      setSelectedMethod(null)
      reset()
      fetchPaymentMethods()
    } catch (error) {
      toast.error('Failed to update payment method')
      console.error(error)
    }
  }

  const handleDelete = async () => {
    if (!selectedMethod) return
    try {
      const response = await fetch(apiUrl(`/payment-methods/${selectedMethod.id}`), {
        method: 'DELETE',
        credentials: 'include',
      })
      if (!response.ok) throw new Error('Failed to delete payment method')
      toast.success('Payment method deleted successfully')
      setIsDeleteDialogOpen(false)
      setSelectedMethod(null)
      fetchPaymentMethods()
    } catch (error) {
      toast.error('Failed to delete payment method')
      console.error(error)
    }
  }

  const handleToggle = async (method: PaymentMethod, enabled: boolean) => {
    try {
      const response = await fetch(apiUrl(`/payment-methods/${method.id}/toggle?enabled=${enabled}`), {
        method: 'PATCH',
        credentials: 'include',
      })
      if (!response.ok) throw new Error('Failed to toggle payment method')
      toast.success(`Payment method ${enabled ? 'enabled' : 'disabled'}`)
      fetchPaymentMethods()
    } catch (error) {
      toast.error('Failed to toggle payment method')
      console.error(error)
    }
  }

  const openEditDialog = (method: PaymentMethod) => {
    setSelectedMethod(method)
    reset({
      method: method.method,
      methodType: method.methodType,
      displayName: method.displayName,
      description: method.description,
      isEnabled: method.isEnabled,
      sortOrder: method.sortOrder,
      iconName: method.iconName,
    })
    setIsEditDialogOpen(true)
  }

  const openDeleteDialog = (method: PaymentMethod) => {
    setSelectedMethod(method)
    setIsDeleteDialogOpen(true)
  }

  const getIcon = (iconName?: string) => {
    if (!iconName) return <CreditCard className="w-5 h-5" />
    switch (iconName) {
      case 'smartphone':
        return <Smartphone className="w-5 h-5" />
      case 'paypal':
        return <CreditCard className="w-5 h-5" />
      case 'ticket':
        return <Ticket className="w-5 h-5" />
      default:
        return <CreditCard className="w-5 h-5" />
    }
  }

  const filteredMethods = paymentMethods.filter(
    (method) =>
      method.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      method.method.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Payment Methods</h1>
          <p className="text-gray-500">Manage available payment methods for voting</p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Payment Method
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search payment methods..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Payment Method</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Sort Order</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredMethods.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-gray-500 py-8">
                  No payment methods found
                </TableCell>
              </TableRow>
            ) : (
              filteredMethods.map((method) => (
                <TableRow key={method.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-gray-100 rounded-lg">
                        {getIcon(method.iconName)}
                      </div>
                      <div>
                        <div className="font-medium">{method.displayName}</div>
                        <div className="text-sm text-gray-500">{method.method}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {method.methodType}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <button
                      onClick={() => handleToggle(method, !method.isEnabled)}
                      className="focus:outline-none"
                    >
                      {method.isEnabled ? (
                        <ToggleRight className="w-6 h-6 text-green-600" />
                      ) : (
                        <ToggleLeft className="w-6 h-6 text-gray-400" />
                      )}
                    </button>
                  </TableCell>
                  <TableCell>{method.sortOrder}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDialog(method)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openDeleteDialog(method)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Payment Method</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(handleCreate)} className="space-y-4">
            <div>
              <Label htmlFor="method">Method Identifier</Label>
              <Input
                id="method"
                placeholder="e.g., visa, ecocash"
                {...register('method')}
              />
              {errors.method && (
                <p className="text-sm text-red-500 mt-1">{errors.method.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="methodType">Method Type</Label>
              <Select onValueChange={(value) => register('methodType').onChange({ target: { value } })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {METHOD_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.methodType && (
                <p className="text-sm text-red-500 mt-1">{errors.methodType.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="displayName">Display Name</Label>
              <Input
                id="displayName"
                placeholder="e.g., Visa, EcoCash"
                {...register('displayName')}
              />
              {errors.displayName && (
                <p className="text-sm text-red-500 mt-1">{errors.displayName.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Optional description"
                {...register('description')}
              />
            </div>
            <div>
              <Label htmlFor="sortOrder">Sort Order</Label>
              <Input
                id="sortOrder"
                type="number"
                placeholder="0"
                {...register('sortOrder')}
              />
              {errors.sortOrder && (
                <p className="text-sm text-red-500 mt-1">{errors.sortOrder.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="iconName">Icon</Label>
              <Select onValueChange={(value) => register('iconName').onChange({ target: { value } })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select icon" />
                </SelectTrigger>
                <SelectContent>
                  {ICON_OPTIONS.map((icon) => (
                    <SelectItem key={icon.value} value={icon.value}>
                      {icon.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="isEnabled"
                checked={watch('isEnabled')}
                onCheckedChange={(checked) => setValue('isEnabled', checked)}
              />
              <Label htmlFor="isEnabled">Enabled</Label>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Create
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Payment Method</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(handleUpdate)} className="space-y-4">
            <div>
              <Label htmlFor="edit-displayName">Display Name</Label>
              <Input
                id="edit-displayName"
                {...register('displayName')}
              />
              {errors.displayName && (
                <p className="text-sm text-red-500 mt-1">{errors.displayName.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                {...register('description')}
              />
            </div>
            <div>
              <Label htmlFor="edit-sortOrder">Sort Order</Label>
              <Input
                id="edit-sortOrder"
                type="number"
                {...register('sortOrder')}
              />
              {errors.sortOrder && (
                <p className="text-sm text-red-500 mt-1">{errors.sortOrder.message}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="edit-isEnabled"
                checked={watch('isEnabled')}
                onCheckedChange={(checked) => setValue('isEnabled', checked)}
              />
              <Label htmlFor="edit-isEnabled">Enabled</Label>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Update
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Payment Method</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedMethod?.displayName}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
