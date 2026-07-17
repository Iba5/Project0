"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import type { ComponentType, ReactNode } from "react"
import { useMemo, useState } from "react"
import {
  ArrowRight,
  Bell,
  ChevronDown,
  LayoutDashboard,
  Menu,
  Search,
  Settings,
  Users,
  CreditCard,
  Film,
  Share2,
  CalendarRange,
} from "lucide-react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { ThemeToggle } from "@/components/theme-toggle"
import { cn } from "@/lib/utils"
import { clearAuth } from "@/lib/auth"

const navigation = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/events", label: "Events", icon: CalendarRange },
  { href: "/participants", label: "Participants", icon: Users },
  { href: "/payments", label: "Payments", icon: CreditCard },
  { href: "/social-router", label: "Social Router", icon: Share2 },
  { href: "/settings", label: "Settings", icon: Settings },
]

type AppShellProps = {
  children: ReactNode
}

const notifications = [
  { id: "n-1", title: "New vote batch synced", detail: "1,250 votes were processed in the active event.", route: "/dashboard" },
  { id: "n-2", title: "Payment review needed", detail: "One settlement is pending manual confirmation.", route: "/payments" },
  { id: "n-3", title: "Instagram sync failed", detail: "The backend should retry the latest social payload.", route: "/social-router" },
]

// Wraps admin pages with responsive navigation, top controls, and user actions.
export function AppShell({ children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.12),transparent_30%),radial-gradient(circle_at_top_right,rgba(14,165,233,0.10),transparent_28%),linear-gradient(to_bottom,var(--background),color-mix(in_oklch,var(--background),var(--muted)_8%))]">
      <div className="mx-auto flex min-h-screen w-full max-w-[1600px]">
        <aside className="hidden w-72 shrink-0 border-r border-border/60 bg-background/80 backdrop-blur xl:flex xl:flex-col">
          <SidebarContent />
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar />
          <main className="min-w-0 flex-1 px-4 py-5 sm:px-6 lg:px-8">{children}</main>
        </div>
      </div>
    </div>
  )
}

// Renders the desktop and mobile navigation links in a single place.
function SidebarContent() {
  return (
    <div className="flex h-full flex-col gap-6 p-6">
      <Link href="/dashboard" className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
          <Film className="size-5" />
        </div>
        <div>
          <p className="text-sm font-semibold">VibeWave Admin</p>
          <p className="text-xs text-muted-foreground">Competition control center</p>
        </div>
      </Link>
      <nav className="flex flex-1 flex-col gap-1">
        {navigation.map((item) => (
          <NavLink key={item.href} {...item} />
        ))}
      </nav>
      <div className="rounded-2xl border border-border/60 bg-muted/40 p-4">
        <p className="text-sm font-medium">Backend bridge</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Frontend requests hit `/api/*` first, so the backend can be swapped in without changing the UI.
        </p>
      </div>
    </div>
  )
}

// Highlights the active route and keeps navigation consistent across layouts.
function NavLink({
  href,
  label,
  icon: Icon,
}: {
  href: string
  label: string
  icon: ComponentType<{ className?: string }>
}) {
  const pathname = usePathname()
  const active = pathname === href || pathname.startsWith(`${href}/`)

  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-primary text-primary-foreground shadow-sm"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      <Icon className="size-4" />
      {label}
      {active ? <Badge className="ml-auto bg-background/15 text-current hover:bg-background/15">Live</Badge> : null}
    </Link>
  )
}

// Provides top-level controls for search, notifications, theme, and account actions.
function TopBar() {
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [query, setQuery] = useState("")
  const router = useRouter()
  const quickResults = useMemo(() => {
    const needle = query.trim().toLowerCase()

    if (!needle) {
      return navigation
    }

    return navigation.filter((item) => item.label.toLowerCase().includes(needle))
  }, [query])

  function handleQuickSearch() {
    const value = query.trim().toLowerCase()

    if (!value) {
      return
    }

    const exact = navigation.find((item) => item.label.toLowerCase().includes(value))
    router.push(exact?.href ?? "/dashboard")
    setIsSearchOpen(false)
  }

  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="flex items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
          <SheetTrigger asChild>
            <Button type="button" variant="outline" size="icon" className="xl:hidden">
              <Menu className="size-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[18rem] p-0">
            <SheetHeader className="border-b border-border/60 p-4">
              <SheetTitle>Navigation</SheetTitle>
            </SheetHeader>
            <SidebarContent />
          </SheetContent>
        </Sheet>
        <button
          type="button"
          className="hidden max-w-md flex-1 items-center gap-2 rounded-xl border border-border/60 bg-muted/30 px-3 py-2 text-left md:flex"
          onClick={() => setIsSearchOpen(true)}
        >
          <Search className="size-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Search events, participants, payments...</span>
          <span className="ml-auto rounded-md border border-border/60 px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            /
          </span>
        </button>
        <Button type="button" variant="outline" size="icon" className="md:hidden" aria-label="Search" onClick={() => setIsSearchOpen(true)}>
          <Search className="size-4" />
        </Button>
        <div className="ml-auto flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" size="icon" aria-label="Notifications">
                <Bell className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <DropdownMenuSeparator />
              {notifications.map((item) => (
                <DropdownMenuItem key={item.id} onSelect={() => router.push(item.route)}>
                  <div className="grid gap-1 py-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{item.title}</span>
                      <ArrowRight className="ml-auto size-3.5 text-muted-foreground" />
                    </div>
                    <span className="text-xs text-muted-foreground">{item.detail}</span>
                  </div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <ThemeToggle />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" className="gap-2">
                <Avatar className="size-6">
                  <AvatarFallback>AD</AvatarFallback>
                </Avatar>
                <span className="hidden sm:inline">Admin</span>
                <ChevronDown className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => router.push("/settings")}>Profile settings</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => router.push("/login")}>Switch account</DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => {
                  clearAuth()
                  window.location.href = "/login"
                }}
              >
                Sign out
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => router.push("/forgot-password")}>Reset password</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <Sheet open={isSearchOpen} onOpenChange={setIsSearchOpen}>
        <SheetContent side="top" className="h-auto rounded-b-3xl border-b border-border/60">
          <SheetHeader className="px-1 pt-1">
            <SheetTitle>Search workspace</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 p-1">
            <div className="flex items-center gap-2 rounded-2xl border border-border/60 bg-muted/30 px-3 py-2">
              <Search className="size-4 text-muted-foreground" />
              <Input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    handleQuickSearch()
                  }
                }}
                placeholder="Type a route name..."
                className="border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
              />
              <Button type="button" size="sm" onClick={handleQuickSearch}>
                Open
              </Button>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {quickResults.map((item) => (
                <button
                  key={item.href}
                  type="button"
                  className="flex items-center gap-3 rounded-2xl border border-border/60 bg-background/70 p-3 text-left hover:bg-muted"
                  onClick={() => {
                    router.push(item.href)
                    setIsSearchOpen(false)
                  }}
                >
                  <item.icon className="size-4 text-primary" />
                  <span className="text-sm font-medium">{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </header>
  )
}
