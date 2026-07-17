import { AlertTriangle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

type ErrorStateProps = {
  title?: string
  message: string
  hint?: string
  actionLabel?: string
  onRetry?: () => void
}

// Displays a readable error message with a clear retry action for users.
export function ErrorState({
  title = "Unable to load content",
  message,
  hint,
  actionLabel = "Try again",
  onRetry,
}: ErrorStateProps) {
  return (
    <Card className="border-destructive/20 bg-destructive/5">
      <CardContent className="flex flex-col gap-4 p-5">
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-destructive/10 p-2 text-destructive">
            <AlertTriangle className="size-4" />
          </div>
          <div className="space-y-1">
            <h2 className="text-sm font-semibold">{title}</h2>
            <p className="text-sm text-muted-foreground">{message}</p>
            {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
          </div>
        </div>
        {onRetry ? (
          <div>
            <Button type="button" variant="outline" onClick={onRetry}>
              {actionLabel}
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
