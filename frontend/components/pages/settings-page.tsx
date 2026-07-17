"use client"

import { useState, type FormEvent, type ReactNode } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { BellRing, Clock3, Save } from "lucide-react"
import { toast } from "sonner"

import { AppShell } from "@/components/app-shell"
import { ErrorState } from "@/components/error-state"
import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { api, getApiError } from "@/lib/api"
import type { SettingsProfile } from "@/lib/types"

const timezones = ["Asia/Kolkata", "UTC", "Africa/Lagos", "America/New_York", "Europe/London"]

// Lets the admin edit shared preferences that the backend should own.
export function SettingsPage() {
  const query = useQuery({
    queryKey: ["settings"],
    queryFn: async () => (await api.get<SettingsProfile>("/settings")).data,
  })

  const save = useMutation({
    mutationFn: async (updatedForm: SettingsProfile) => {
      return (await api.put("/settings", updatedForm)).data
    },
    onSuccess: (data: { message: string }) => {
      toast.success(data.message || "Settings saved.")
      query.refetch()
    },
    onError: (error) => {
      const apiError = getApiError(error)
      toast.error(apiError.message, apiError.hint ? { description: apiError.hint } : undefined)
    },
  })

  return (
    <AppShell>
      <div className="admin-grid">
        <PageHeader
          eyebrow="Preferences"
          title="Settings"
          description="Manage company details, timezone, and notification preferences from the admin panel."
          actions={<Badge variant="outline" className="gap-1.5"><Clock3 className="size-3.5" />Timezone aware</Badge>}
        />
        {query.isLoading ? <SettingsSkeleton /> : null}
        {query.error ? <ErrorState {...getApiError(query.error)} onRetry={() => query.refetch()} /> : null}
        {query.data ? (
          <SettingsForm
            initialData={query.data}
            onSave={(updatedForm) => save.mutate(updatedForm)}
            isSaving={save.isPending}
          />
        ) : null}
      </div>
    </AppShell>
  )
}

function SettingsForm({
  initialData,
  onSave,
  isSaving,
}: {
  initialData: SettingsProfile
  onSave: (data: SettingsProfile) => void
  isSaving: boolean
}) {
  const [form, setForm] = useState<SettingsProfile>(initialData)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onSave(form)
  }

  return (
    <Card className="glass-panel">
      <CardContent className="grid gap-5 p-5">
        <form className="grid gap-5" onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Company name">
              <Input value={form.companyName} onChange={(event) => setForm({ ...form, companyName: event.target.value })} />
            </Field>
            <Field label="Support email">
              <Input type="email" value={form.supportEmail} onChange={(event) => setForm({ ...form, supportEmail: event.target.value })} />
            </Field>
            <Field label="Timezone">
              <select
                aria-label="Timezone"
                className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
                value={form.timezone}
                onChange={(event) => setForm({ ...form, timezone: event.target.value })}
              >
                {timezones.map((timezone) => (
                  <option key={timezone}>{timezone}</option>
                ))}
              </select>
            </Field>
          </div>
          <div className="grid gap-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <BellRing className="size-4 text-muted-foreground" />
              Notifications
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <ToggleButton
                label="Email"
                active={form.notifications.email}
                onClick={() =>
                  setForm({
                    ...form,
                    notifications: { ...form.notifications, email: !form.notifications.email },
                  })
                }
              />
              <ToggleButton
                label="SMS"
                active={form.notifications.sms}
                onClick={() =>
                  setForm({
                    ...form,
                    notifications: { ...form.notifications, sms: !form.notifications.sms },
                  })
                }
              />
              <ToggleButton
                label="Marketing"
                active={form.notifications.marketing}
                onClick={() =>
                  setForm({
                    ...form,
                    notifications: { ...form.notifications, marketing: !form.notifications.marketing },
                  })
                }
              />
            </div>
          </div>
          <div>
            <Button type="submit" disabled={isSaving}>
              <Save className="size-4" />
              {isSaving ? "Saving..." : "Save changes"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

// Wraps a labeled input block to keep the settings form compact and readable.
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  )
}

// Renders a toggle-style button for boolean notification preferences.
function ToggleButton({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <Button
      type="button"
      variant={active ? "default" : "outline"}
      className="justify-start"
      onClick={onClick}
    >
      {label}
    </Button>
  )
}

// Shows the settings skeleton until the query resolves.
function SettingsSkeleton() {
  return (
    <Card className="glass-panel">
      <CardContent className="space-y-3 p-5">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </CardContent>
    </Card>
  )
}
