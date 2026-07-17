"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, type FormEvent } from "react"
import { useMutation } from "@tanstack/react-query"
import { KeyRound, Mail, ShieldCheck, UserPlus } from "lucide-react"
import { toast } from "sonner"

import { AuthShell } from "@/components/auth-shell"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { api, getApiError } from "@/lib/api"
import { setAuth } from "@/lib/auth"
import type { AuthResult } from "@/lib/types"

type SignupForm = {
  name: string
  email: string
  password: string
}

// Creates a new admin profile and sends the user into the dashboard flow.
export function AuthSignupPage() {
  const router = useRouter()
  const [form, setForm] = useState<SignupForm>({
    name: "",
    email: "",
    password: "",
  })

  const signup = useMutation({
    mutationFn: async () =>
      (await api.post<AuthResult>("/auth/signup", form)).data,
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

  // Submits the registration request to the backend-facing auth route.
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    signup.mutate()
  }

  return (
    <AuthShell
      title="Create the first trusted admin account"
      description="Register once and immediately manage the competition dashboard, events, and payments."
      asideTitle="JWT-ready setup"
      asideText="This sign-up form already sends a structured payload to `/api/auth/signup`."
    >
      <Card className="glass-panel border-border/60">
        <CardHeader className="space-y-2">
          <div className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            <ShieldCheck className="size-3.5" />
            New account
          </div>
          <CardTitle className="text-2xl">Register admin access</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="name">Full name</Label>
              <div className="relative">
                <UserPlus className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="name"
                  placeholder="Alex Morgan"
                  className="pl-9"
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                />
              </div>
            </div>
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
                <KeyRound className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="Create a strong password"
                  className="pl-9"
                  value={form.password}
                  onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                />
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={signup.isPending}>
              {signup.isPending ? "Creating account..." : "Create account"}
            </Button>
          </form>
          <p className="text-center text-sm text-muted-foreground">
            Already registered?{" "}
            <Link href="/login" className="font-medium text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </AuthShell>
  )
}
