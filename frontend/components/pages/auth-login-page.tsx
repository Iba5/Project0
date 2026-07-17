"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, type FormEvent } from "react"
import { useMutation } from "@tanstack/react-query"
import { LockKeyhole, Mail, Sparkles } from "lucide-react"

import { AuthShell } from "@/components/auth-shell"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { api, getApiError } from "@/lib/api"
import { setAuth } from "@/lib/auth"
import type { AuthResult } from "@/lib/types"
import { toast } from "sonner"

type LoginForm = {
  email: string
  password: string
  rememberMe: boolean
}

// Handles sign in, remembers the admin preference, and routes into the dashboard.
export function AuthLoginPage() {
  const router = useRouter()
  const [form, setForm] = useState<LoginForm>({
    email: "",
    password: "",
    rememberMe: true,
  })
  const [googleLoading, setGoogleLoading] = useState(false)

  const login = useMutation({
    mutationFn: async () =>
      (await api.post<AuthResult>("/auth/login", form)).data,
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

  // Sends the login payload to the backend-facing API route.
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    login.mutate()
  }

  // Starts the Google sign-in handshake through the backend API route.
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
      description="Use your backend-issued JWT to manage events, participants, votes, and payments."
      asideTitle="Fast route wiring"
      asideText="The login form already talks to `/api/auth/login`, so your FastAPI backend can drop in later."
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
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@company.com"
                  className="pl-9"
                  value={form.email}
                  onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <LockKeyhole className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  className="pl-9"
                  value={form.password}
                  onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                />
              </div>
            </div>
            <div className="flex items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={form.rememberMe}
                  onChange={(event) => setForm((current) => ({ ...current, rememberMe: event.target.checked }))}
                  className="size-4 rounded border-border bg-background"
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
