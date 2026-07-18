"use client"

import { useEffect, type ReactNode } from "react"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { api, getApiError } from "@/lib/api"
import { settingsSchema, type SettingsFormValues } from "@/lib/schemas"
import type { SettingsProfile } from "@/lib/types"

const timezones = ["Asia/Kolkata", "UTC", "Africa/Lagos", "America/New_York", "Europe/London"]

// Lets the admin edit shared preferences and platform settings.
export function SettingsPage() {
  const query = useQuery({
    queryKey: ["settings"],
    queryFn: async () => (await api.get<SettingsProfile>("/settings")).data,
  })

  const save = useMutation({
    mutationFn: async (updatedForm: SettingsFormValues) => {
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
  onSave: (data: SettingsFormValues) => void
  isSaving: boolean
}) {
  const {
    register,
    handleSubmit,
    reset,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: initialData,
  })

  // Sync form if the query re-fetches with fresh data
  useEffect(() => {
    reset(initialData)
  }, [initialData, reset])

  const notifications = watch("notifications")

  return (
    <Card className="glass-panel">
      <CardContent className="grid gap-5 p-5">
        <form className="grid gap-5" onSubmit={handleSubmit(onSave)}>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Company name">
              <Input id="settings-company" {...register("companyName")} />
              {errors.companyName ? <p className="text-xs text-destructive">{errors.companyName.message}</p> : null}
            </Field>
            <Field label="Support email">
              <Input id="settings-email" type="email" {...register("supportEmail")} />
              {errors.supportEmail ? <p className="text-xs text-destructive">{errors.supportEmail.message}</p> : null}
            </Field>
            <Field label="Timezone">
              <Controller
                control={control}
                name="timezone"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger className="w-full" aria-label="Timezone">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {timezones.map((tz) => (
                              <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                )}
              />
              {errors.timezone ? <p className="text-xs text-destructive">{errors.timezone.message}</p> : null}
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
                active={notifications.email}
                onClick={() => setValue("notifications.email", !notifications.email)}
              />
              <ToggleButton
                label="SMS"
                active={notifications.sms}
                onClick={() => setValue("notifications.sms", !notifications.sms)}
              />
              <ToggleButton
                label="Marketing"
                active={notifications.marketing}
                onClick={() => setValue("notifications.marketing", !notifications.marketing)}
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
