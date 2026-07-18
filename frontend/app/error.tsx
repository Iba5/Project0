"use client"

import { useEffect } from "react"
import { AlertTriangle, RefreshCw } from "lucide-react"

import { Button } from "@/components/ui/button"

// Catches unhandled errors thrown inside any route segment and renders a
// friendly fallback so the user can recover without a full page reload.
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("Segment error caught by error.tsx:", error)
  }, [error])

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="flex w-full max-w-md flex-col items-center gap-6 rounded-2xl border border-destructive/20 bg-destructive/5 p-8 text-center shadow-sm">
        <div className="flex size-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle className="size-7" />
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-semibold tracking-tight">Something went wrong</h1>
          <p className="text-sm text-muted-foreground">
            {error.message || "An unexpected error occurred. You can try again or refresh the page."}
          </p>
          {error.digest ? (
            <p className="font-mono text-xs text-muted-foreground/60">Error ID: {error.digest}</p>
          ) : null}
        </div>
        <Button type="button" onClick={reset} className="gap-2">
          <RefreshCw className="size-4" />
          Try again
        </Button>
      </div>
    </div>
  )
}
