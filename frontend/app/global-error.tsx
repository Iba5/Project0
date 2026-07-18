"use client"

import { useEffect } from "react"
import { AlertTriangle, RefreshCw } from "lucide-react"

// Root-level error boundary that wraps the entire application including the
// RootLayout. Must be self-contained (no imports from the layout/design system)
// because the layout itself may have failed.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("Root error caught by global-error.tsx:", error)
  }, [error])

  return (
    <html lang="en">
      <body
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "hsl(222.2 84% 4.9%)",
          color: "hsl(210 40% 98%)",
          fontFamily: "system-ui, sans-serif",
          padding: "1.5rem",
          margin: 0,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "1.5rem",
            maxWidth: "28rem",
            width: "100%",
            textAlign: "center",
            padding: "2rem",
            borderRadius: "1rem",
            border: "1px solid rgba(239, 68, 68, 0.2)",
            background: "rgba(239, 68, 68, 0.05)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "3.5rem",
              height: "3.5rem",
              borderRadius: "9999px",
              background: "rgba(239, 68, 68, 0.15)",
              color: "rgb(239, 68, 68)",
            }}
          >
            <AlertTriangle size={28} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <h1 style={{ fontSize: "1.25rem", fontWeight: 600, margin: 0 }}>
              Application error
            </h1>
            <p style={{ fontSize: "0.875rem", color: "rgba(255,255,255,0.6)", margin: 0 }}>
              {error.message ||
                "A critical error occurred. Please try again or contact support if the problem persists."}
            </p>
            {error.digest ? (
              <p style={{ fontSize: "0.75rem", fontFamily: "monospace", color: "rgba(255,255,255,0.35)", margin: 0 }}>
                Error ID: {error.digest}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={reset}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.5rem 1.25rem",
              borderRadius: "0.5rem",
              border: "1px solid rgba(255,255,255,0.2)",
              background: "transparent",
              color: "inherit",
              fontSize: "0.875rem",
              cursor: "pointer",
            }}
          >
            <RefreshCw size={16} />
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}
