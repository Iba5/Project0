import type { ReactNode } from "react"
import { ShieldCheck, Sparkles } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"

// Frames auth screens with a branded panel and a compact form surface.
export function AuthShell({
  title,
  description,
  children,
  asideTitle,
  asideText,
}: {
  title: string
  description: string
  children: ReactNode
  asideTitle: string
  asideText: string
}) {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.18),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(14,165,233,0.14),transparent_28%),linear-gradient(135deg,color-mix(in_oklch,var(--background),var(--muted)_12%),var(--background))] p-4 sm:p-6">
      <div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-6xl items-stretch gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="glass-panel flex flex-col justify-between rounded-3xl p-6 text-foreground sm:p-8 lg:p-10">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/60 px-3 py-1 text-xs font-medium text-muted-foreground">
              <Sparkles className="size-3.5" />
              Voting platform admin
            </div>
            <div className="space-y-3">
              <h1 className="max-w-xl text-3xl font-semibold tracking-tight sm:text-4xl">
                {title}
              </h1>
              <p className="max-w-xl text-sm text-muted-foreground sm:text-base">
                {description}
              </p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Card className="glass-panel border-border/60">
              <CardContent className="flex items-start gap-3 p-4">
                <ShieldCheck className="mt-0.5 size-5 text-primary" />
                <div className="space-y-1">
                  <p className="text-sm font-medium">{asideTitle}</p>
                  <p className="text-sm text-muted-foreground">{asideText}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="glass-panel border-border/60">
              <CardContent className="p-4">
                <p className="text-sm font-medium">Secure authentication</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Your account is protected with enterprise-grade security.
                </p>
              </CardContent>
            </Card>
          </div>
        </section>
        <section className="flex items-center justify-center">
          <div className="w-full max-w-md">{children}</div>
        </section>
      </div>
    </main>
  )
}
