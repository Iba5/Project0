'use client'

import * as React from 'react'
import { useTheme } from 'next-themes'
import { motion, AnimatePresence } from 'framer-motion'
import { Sun, Moon, Monitor } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

type ThemeOption = 'light' | 'dark' | 'system'

const THEME_OPTIONS: Array<{
  value: ThemeOption
  label: string
  icon: React.ComponentType<{ className?: string }>
}> = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
]

/**
 * ThemeToggle — polished icon button that toggles between Light / Dark / System.
 *
 * - Renders a placeholder until mounted to avoid hydration mismatch.
 * - Animated Sun/Moon swap on the trigger (framer-motion AnimatePresence).
 * - Gold accent on hover, rounded-full button, matches Vibe Hub aesthetic.
 * - Importable from `@/components/theme-toggle` by other agents (admin-shell,
 *   public-header, etc).
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  // Use resolvedTheme (the actual applied theme) for the trigger icon so it
  // reflects what the user sees (especially when theme === 'system').
  const activeIconTheme = mounted ? (resolvedTheme ?? theme) : undefined
  const isDark = activeIconTheme === 'dark'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Toggle theme"
          title={mounted ? `Theme: ${theme}` : 'Toggle theme'}
          className={cn(
            'relative size-9 overflow-hidden rounded-full border border-border/60',
            'bg-background/40 backdrop-blur-sm transition-colors',
            'hover:border-primary/50 hover:bg-primary/10 hover:text-primary',
            'focus-visible:ring-primary/40 focus-visible:ring-2',
            'text-foreground/80',
            className
          )}
        >
          {/* Placeholder rendered pre-mount to avoid hydration mismatch. */}
          {!mounted ? (
            <span className="size-4 rounded-full bg-foreground/30" aria-hidden />
          ) : (
            <AnimatePresence mode="wait" initial={false}>
              {isDark ? (
                <motion.span
                  key="moon"
                  initial={{ rotate: -90, opacity: 0, scale: 0.5 }}
                  animate={{ rotate: 0, opacity: 1, scale: 1 }}
                  exit={{ rotate: 90, opacity: 0, scale: 0.5 }}
                  transition={{ duration: 0.2, ease: 'easeInOut' }}
                  className="flex items-center justify-center"
                >
                  <Moon className="size-4" />
                </motion.span>
              ) : (
                <motion.span
                  key="sun"
                  initial={{ rotate: 90, opacity: 0, scale: 0.5 }}
                  animate={{ rotate: 0, opacity: 1, scale: 1 }}
                  exit={{ rotate: -90, opacity: 0, scale: 0.5 }}
                  transition={{ duration: 0.2, ease: 'easeInOut' }}
                  className="flex items-center justify-center"
                >
                  <Sun className="size-4" />
                </motion.span>
              )}
            </AnimatePresence>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="min-w-[10rem] overflow-hidden rounded-lg border-border/60 bg-popover/95 p-1 shadow-xl backdrop-blur-md"
      >
        {THEME_OPTIONS.map((option) => {
          const Icon = option.icon
          const isActive = mounted && theme === option.value
          return (
            <DropdownMenuItem
              key={option.value}
              onSelect={() => setTheme(option.value)}
              className={cn(
                'flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-sm',
                'transition-colors outline-none',
                'hover:bg-primary/10 hover:text-primary',
                'focus:bg-primary/10 focus:text-primary',
                isActive && 'bg-primary/10 text-primary'
              )}
            >
              <Icon className="size-4 shrink-0" />
              <span className="flex-1">{option.label}</span>
              {isActive && (
                <span
                  className="size-1.5 rounded-full bg-primary"
                  aria-hidden
                />
              )}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default ThemeToggle
