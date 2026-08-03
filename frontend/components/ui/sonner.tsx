"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      // Phase 9 — cap concurrent visible toasts at 3 so milestone/vote
      // bursts don't flood the corner. Older toasts are dismissed first.
      // (In sonner v2 this prop is called `visibleToasts`; the old `limit`
      // prop was removed.)
      visibleToasts={3}
      toastOptions={{
        classNames: {
          toast: 'toast-enter',
        },
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
