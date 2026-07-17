"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation } from "@tanstack/react-query"
import { LockKeyhole, Mail, Sparkles } from "lucide-react"
import { toast } from "sonner"

import { AuthShell } from "@/components/auth-shell"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { api, getApiError } from "@/lib/api"
import { setAuth } from "@/lib/auth"
import { loginSchema, type LoginFormValues } from "@/lib/schemas"
import type { AuthResult } from "@/lib/types"

// Handles sign in with zod-validated form and routes into the dashboard.
export function AuthLoginPage() {
  const router = useRouter()
  const [googleLoading, setGoogleLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "", rememberMe: true },
  })

  const login = useMutation({
    mutationFn: async (values: LoginFormValues) =>
      (await api.post<AuthResult>("/auth/login", values)).data,
    onSuccess: (data) => {
      setAuth(data)
      toast.success(data.message)
      router.push("/dashboard")
    },
    onError: (error) => {
      const apiError = getApiError(error)
      toast.error(apiError.message, apiError.hint ? { description: apiError.hint } : undefined)
    },
  })

  // Starts the Google sign-in process.
  async function handleGoogleSignIn() {
    setGoogleLoading(true)
    try {
      const response = await api.get<{ authorizationUrl: string; message?: string }>("/auth/google")
      toast.info(response.data.message || "Redirecting to Google sign-in.")
      window.location.assign(response.data.authorizationUrl)
    } catch (error) {
      const apiError = getApiError(error)
      toast.error(apiError.message, apiError.hint ? { description: apiError.hint } : undefined)
    } finally {
      setGoogleLoading(false)
    }
  }

  return (
    <AuthShell
      title="Sign in to the admin workspace"
      description="Manage events, participants, votes, and payments from your dashboard."
      asideTitle="Secure access"
      asideText="Your administrative workspace for managing the competition platform."
    >
      <Card className="glass-panel border-border/60">
        <CardHeader className="space-y-2">
          <div className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            <Sparkles className="size-3.5" />
            Admin access
          </div>
          <CardTitle className="text-2xl">Welcome back</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <Button type="button" variant="outline" className="w-full" onClick={handleGoogleSignIn} disabled={googleLoading}>
            <Sparkles className="size-4" />
            {googleLoading ? "Connecting..." : "Continue with Google"}
          </Button>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            or use your admin email
            <span className="h-px flex-1 bg-border" />
          </div>
          <form className="space-y-4" onSubmit={handleSubmit((values) => login.mutate(values))}>
            <div className="space-y-2">
              <Label htmlFor="login-email">Email</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="login-email"
                  type="email"
                  placeholder="admin@company.com"
                  className="pl-9"
                  {...register("email")}
                />
              </div>
              {errors.email ? <p className="text-xs text-destructive">{errors.email.message}</p> : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="login-password">Password</Label>
              <div className="relative">
                <LockKeyhole className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="login-password"
                  type="password"
                  placeholder="••••••••"
                  className="pl-9"
                  {...register("password")}
                />
              </div>
              {errors.password ? <p className="text-xs text-destructive">{errors.password.message}</p> : null}
            </div>
            <div className="flex items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  className="size-4 rounded border-border bg-background"
                  {...register("rememberMe")}
                />
                Remember me
              </label>
              <Link href="/forgot-password" className="text-sm font-medium text-primary hover:underline">
                Forgot password?
              </Link>
            </div>
            <Button type="submit" className="w-full" disabled={login.isPending}>
              {login.isPending ? "Signing in..." : "Sign in"}
            </Button>
          </form>
          <p className="text-center text-sm text-muted-foreground">
            New admin?{" "}
            <Link href="/signup" className="font-medium text-primary hover:underline">
              Create an account
            </Link>
          </p>
        </CardContent>
      </Card>
    </AuthShell>
  )
}
