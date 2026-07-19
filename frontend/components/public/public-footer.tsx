'use client'

import { Separator } from '@/components/ui/separator'

export function PublicFooter() {
  return (
    <footer className="mt-auto">
      <Separator />
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <p className="text-center text-xs text-muted-foreground leading-relaxed">
          &copy; {new Date().getFullYear()} VibeWave. All rights reserved.
        </p>
        <p className="mt-1 text-center text-xs text-muted-foreground/70">
          Powered by Paynow Zimbabwe
        </p>
      </div>
    </footer>
  )
}