"use client"

import { useQuery } from "@tanstack/react-query"
import { RefreshCw, PlugZap } from "lucide-react"
import { toast } from "sonner"

import { AppShell } from "@/components/app-shell"
import { EmptyState } from "@/components/empty-state"
import { ErrorState } from "@/components/error-state"
import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { api, getApiError } from "@/lib/api"
import type { SocialPlatformRecord } from "@/lib/types"

// Shows the backend-managed sync status of each social media connector.
export function SocialRouterPage() {
  const query = useQuery({
    queryKey: ["social-router"],
    queryFn: async () => (await api.get<{ items: SocialPlatformRecord[] }>("/social-router")).data.items,
  })

  return (
    <AppShell>
      <div className="admin-grid">
        <PageHeader
          eyebrow="Synchronization"
          title="Social Router"
          description="Review the sync state for TikTok, Facebook, Instagram, and YouTube without exposing backend internals."
          actions={
            <Button type="button" variant="outline" onClick={() => {
              query.refetch()
              toast.info("Refreshing social sync status.")
            }}>
              <RefreshCw className="size-4" />
              Refresh
            </Button>
          }
        />
        {query.isLoading ? <SocialSkeleton /> : null}
        {query.error ? <ErrorState {...getApiError(query.error)} onRetry={() => query.refetch()} /> : null}
        {query.data?.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {query.data.map((platform) => (
              <Card key={platform.id} className="glass-panel">
                <CardHeader className="space-y-2">
                  <CardTitle>{platform.platform}</CardTitle>
                  <Badge variant={platform.status === "Connected" ? "default" : platform.status === "Syncing" ? "secondary" : platform.status === "Failed" ? "destructive" : "outline"}>
                    {platform.status}
                  </Badge>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                  <p>{platform.detail}</p>
                  <p>Last sync: {platform.lastSync}</p>
                  <div className="inline-flex items-center gap-1.5 rounded-full border border-border/60 px-3 py-1 text-xs text-foreground">
                    <PlugZap className="size-3.5" />
                    Backend owned
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState title="No social router records" message="The backend will populate platform connection details once it is wired up." />
        )}
      </div>
    </AppShell>
  )
}

// Displays placeholder cards while the router status request is loading.
function SocialSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <Card className="glass-panel" key={index}>
          <CardHeader className="space-y-3">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-5 w-20" />
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-4 w-32" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
