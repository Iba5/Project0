'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
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
import { resetPassword } from '@/lib/api'
const schema = z
  .object({
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  })

type FormValues = z.infer<typeof schema>

export default function ResetPasswordClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (values: FormValues) => {
    if (!token) {
      toast.error('Invalid or missing reset token.')
      return
    }

    setLoading(true)

    try {
      
      await resetPassword(token, values.password)
      setSuccess(true)

      toast.success('Password updated successfully')

      setTimeout(() => {
        router.push('/admin/login')
      }, 2000)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="w-full max-w-md"
      >
        <div className="rounded-lg border border-border p-8">

          <Link
            href="/admin/login"
            className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Back to login
          </Link>

          {success ? (
            <div className="py-4 text-center">
              <CheckCircle2 className="mx-auto mb-3 size-10 text-green-600" />
              <h2 className="text-xl font-semibold">
                Password Updated
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Your password has been reset successfully.
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Redirecting to login...
              </p>
            </div>
          ) : (
            <>
              <div className="mb-8">
                <h1 className="text-2xl font-bold">
                  Reset Password
                </h1>

                <p className="mt-2 text-sm text-muted-foreground">
                  Enter your new password below.
                </p>
              </div>

              <form
                onSubmit={handleSubmit(onSubmit)}
                className="space-y-5"
              >
                <div className="space-y-2">
                  <Label htmlFor="password">
                    New Password
                  </Label>

                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    {...register('password')}
                  />

                  {errors.password && (
                    <p className="text-sm text-destructive">
                      {errors.password.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">
                    Confirm Password
                  </Label>

                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="••••••••"
                    {...register('confirmPassword')}
                  />

                  {errors.confirmPassword && (
                    <p className="text-sm text-destructive">
                      {errors.confirmPassword.message}
                    </p>
                  )}
                </div>

                <Button
                  className="h-10 w-full rounded-full"
                  disabled={loading}
                  type="submit"
                >
                  {loading && (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  )}

                  Reset Password
                </Button>
              </form>
            </>
          )}
        </div>
      </motion.div>
    </div>
  )
}