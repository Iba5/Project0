'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { motion } from 'framer-motion'
import { ArrowLeft, Loader2, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { forgotPassword } from '@/lib/api'

const forgotSchema = z.object({
  email: z.string().email('Enter a valid email address'),
})

type ForgotValues = z.infer<typeof forgotSchema>

export function AdminForgotPasswordPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotValues>({
    resolver: zodResolver(forgotSchema),
    defaultValues: { email: '' },
  })

  const onSubmit = async (values: ForgotValues) => {
    setLoading(true)
    try {
      await forgotPassword(values.email)
      setSent(true)
      setTimeout(() => {
        router.push('/admin/login')
      }, 2000)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to send reset link')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="w-full max-w-md"
      >
        <div className="border border-border rounded-lg p-8">
          {/* Back link */}
          <Link
            href="/admin/login"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
          >
            <ArrowLeft className="size-4" />
            Back to login
          </Link>

          {sent ? (
            <div className="text-center py-4">
              <CheckCircle2 className="size-10 text-[#C8A24D] mx-auto mb-3" />
              <h2 className="text-lg font-semibold">Reset link sent</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Check your inbox for the password reset link. Redirecting to
                login...
              </p>
            </div>
          ) : (
            <>
              <div className="mb-8">
                <h2 className="text-xl font-bold tracking-tight">
                  Reset your password
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Enter your email and we&apos;ll send you a reset link.
                </p>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="admin@vibewave.co.zw"
                    {...register('email')}
                  />
                  {errors.email && (
                    <p className="text-sm text-destructive">
                      {errors.email.message}
                    </p>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full rounded-full h-10"
                  disabled={loading}
                >
                  {loading && <Loader2 className="size-4 animate-spin" />}
                  Send reset link
                </Button>
              </form>
            </>
          )}
        </div>
      </motion.div>
    </div>
  )
}