import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

type EmptyStateProps = {
  title: string
  message: string
  actionLabel?: string
  onAction?: () => void
}

// Gives users a clear next step when a list has no records yet.
export function EmptyState({
  title,
  message,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <Card className="border-dashed bg-muted/30">
      <CardContent className="flex flex-col gap-3 p-6 text-center">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold">{title}</h2>
          <p className="text-sm text-muted-foreground">{message}</p>
        </div>
        {actionLabel && onAction ? (
          <div>
            <Button type="button" onClick={onAction}>
              {actionLabel}
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
