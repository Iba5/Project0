'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
} from '@/components/ui/sheet'
import { Separator } from '@/components/ui/separator'

const navLinks = [
  { label: 'Vote Now', href: '/contestants' as const },
  { label: 'Leaderboard', href: '/leaderboard' as const },
]

export function PublicHeader() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const { setTheme, resolvedTheme } = useTheme()

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        {/* Wordmark */}
        <Link
          href="/"
          className="text-lg font-bold tracking-tight text-foreground transition-opacity hover:opacity-70"
        >
          VibeWave
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 sm:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
            >
              <Button
                variant="ghost"
                size="sm"
                className={`rounded-full px-4 text-sm transition-colors ${
                  pathname === link.href
                    ? 'bg-foreground text-background hover:bg-foreground/90 hover:text-background'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                {link.label}
              </Button>
            </Link>
          ))}
          <Separator orientation="vertical" className="mx-2 h-4" />
          {/* Theme toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
            className="rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Toggle theme"
          >
            <Sun className="size-4 rotate-0 scale-100 transition-transform dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute size-4 rotate-90 scale-0 transition-transform dark:rotate-0 dark:scale-100" />
          </Button>
          <Link href="/admin/login">
            <Button
              variant="ghost"
              size="sm"
              className="rounded-full px-4 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              Admin
            </Button>
          </Link>
        </nav>

        {/* Mobile hamburger */}
        <div className="flex items-center gap-1 sm:hidden">
          {/* Mobile theme toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
            className="rounded-full text-muted-foreground"
            aria-label="Toggle theme"
          >
            <Sun className="size-4 rotate-0 scale-100 transition-transform dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute size-4 rotate-90 scale-0 transition-transform dark:rotate-0 dark:scale-100" />
          </Button>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Open menu">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <SheetHeader>
                <SheetTitle className="text-lg font-bold tracking-tight">
                  VibeWave
                </SheetTitle>
              </SheetHeader>
              <nav className="mt-2 flex flex-col gap-1 px-4">
                {navLinks.map((link) => (
                  <SheetClose asChild key={link.href}>
                    <Link
                      href={link.href}
                      className={`rounded-lg px-3 py-2.5 text-sm font-medium text-left transition-colors ${
                        pathname === link.href
                          ? 'bg-foreground text-background'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      }`}
                    >
                      {link.label}
                    </Link>
                  </SheetClose>
                ))}
                <Separator className="my-2" />
                <SheetClose asChild>
                  <Link
                    href="/admin/login"
                    className="rounded-lg px-3 py-2.5 text-sm text-left text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    Admin
                  </Link>
                </SheetClose>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}