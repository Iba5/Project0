"use client"

import { useEffect, useState } from "react"
import { MoonStar, SunMedium } from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"

// Switches the interface between light and dark presentation modes.
export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // Wait until mounted on the client before rendering the theme-dependent icon.
  useEffect(() => {
    setMounted(true)
  }, [])

  const isDark = theme === "dark"

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      aria-label="Toggle theme"
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      {mounted ? (
        isDark ? <SunMedium className="size-4" /> : <MoonStar className="size-4" />
      ) : (
        <span className="size-4" />
      )}
    </Button>
  )
}
