"use client"

import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation } from "@tanstack/react-query"
import { ArrowLeft, Mail, ShieldAlert } from "lucide-react"
import { toast } from "sonner"

import { AuthShell } from "@/components/auth-shell"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { api, getApiError } from "@/lib/api"
import { forgotPasswordSchema, type ForgotPasswordFormValues } from "@/lib/schemas"

// Starts the password reset flow.
export function ForgotPasswordPage() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  })

  const reset = useMutation({
    mutationFn: async (values: ForgotPasswordFormValues) =>
      (await api.post("/auth/forgot-password", values)).data,
    onSuccess: (data: { message: string }) => {
      toast.success(data.message)
    },
    onError: (error) => {
      const apiError = getApiError(error)
      toast.error(apiError.message, apiError.hint ? { description: apiError.hint } : undefined)
    },
  })

  return (
    <AuthShell
      title="Reset the admin password"
      description="We will send a password reset link to your email address."
      asideTitle="Clear recovery path"
      asideText="Secure password recovery for your administrative account."
    >
      <Card className="glass-panel border-border/60">
        <CardHeader className="space-y-2">
          <div className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            <ShieldAlert className="size-3.5" />
            Password recovery
          </div>
          <CardTitle className="text-2xl">Forgot your password?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <form className="space-y-4" onSubmit={handleSubmit((values) => reset.mutate(values))}>
            <div className="space-y-2">
              <Label htmlFor="forgot-email">Email</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="forgot-email"
                  type="email"
                  placeholder="admin@company.com"
                  className="pl-9"
                  {...register("email")}
                />
              </div>
              {errors.email ? <p className="text-xs text-destructive">{errors.email.message}</p> : null}
            </div>
            <Button type="submit" className="w-full" disabled={reset.isPending}>
              {reset.isPending ? "Sending request..." : "Send reset link"}
            </Button>
          </form>
          <div className="flex items-center justify-between text-sm">
            <Link href="/login" className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
              <ArrowLeft className="size-4" />
              Back to sign in
            </Link>
          </div>
        </CardContent>
      </Card>
    </AuthShell>
  )
}
