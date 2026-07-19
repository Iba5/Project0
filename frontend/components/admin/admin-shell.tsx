'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  CreditCard,
  Shield,
  Settings,
  Share2,
  Menu,
  Bell,
  LogOut,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { useSession } from '@/lib/use-session'
import { logout } from '@/lib/api'

type NavItem = {
  label: string
  path: string
  icon: React.ElementType
}

const navItems: NavItem[] = [
  { label: 'Dashboard', path: '/admin/dashboard', icon: LayoutDashboard },
  { label: 'Events', path: '/admin/events', icon: CalendarDays },
  { label: 'Participants', path: '/admin/participants', icon: Users },
  { label: 'Payments', path: '/admin/payments', icon: CreditCard },
  { label: 'Social Platforms', path: '/admin/social-router', icon: Share2 },
  { label: 'Admins', path: '/admin/admins', icon: Shield },
  { label: 'Settings', path: '/admin/settings', icon: Settings },
]

const pageTitles: Record<string, string> = {
  '/admin/dashboard': 'Dashboard',
  '/admin/events': 'Events',
  '/admin/participants': 'Participants',
  '/admin/payments': 'Payments',
  '/admin/social-router': 'Social Platforms',
  '/admin/admins': 'Admin Users',
  '/admin/settings': 'Settings',
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  const router = useRouter()
  const { user: adminUser } = useSession()

  const handleLogout = async () => {
    try {
      await logout()
    } catch {
      // ignore
    }
    router.push('/admin/login')
  }

  return (
    <div className="flex h-full flex-col bg-primary text-primary-foreground">
      {/* Logo */}
      <div className="px-6 pt-6 pb-2">
        <h1 className="text-xl font-bold tracking-tight">VibeWave</h1>
        <p className="text-xs text-primary-foreground/50">Admin Panel</p>
      </div>

      <Separator className="bg-sidebar-border" />

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.path
          const Icon = item.icon
          return (
            <Link
              key={item.path}
              href={item.path}
              onClick={() => onNavigate?.()}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-sidebar-accent text-accent-brand'
                  : 'text-primary-foreground/60 hover:bg-sidebar-accent hover:text-primary-foreground'
              }`}
            >
              <Icon className="size-4 shrink-0" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* User info + sign out */}
      <Separator className="bg-sidebar-border" />
      <div className="p-4">
        <div className="mb-3">
          <p className="text-sm font-medium truncate">{adminUser?.name ?? 'Admin'}</p>
          <p className="text-xs text-primary-foreground/50 truncate">{adminUser?.role ?? ''}</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          className="w-full justify-start gap-2 text-primary-foreground/60 hover:bg-sidebar-accent hover:text-primary-foreground rounded-full px-3"
        >
          <LogOut className="size-4" />
          Sign Out
        </Button>
      </div>
    </div>
  )
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = React.useState(false)

  const title = pageTitles[pathname] ?? 'Admin'

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 shrink-0 border-r border-sidebar-border">
        <div className="w-full">
          <SidebarContent />
        </div>
      </aside>

      {/* Main area */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Top bar */}
        <header className="flex h-14 items-center gap-4 border-b border-border px-4 lg:px-6 shrink-0">
          {/* Mobile hamburger */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden">
                <Menu className="size-5" />
                <span className="sr-only">Menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
              <SheetHeader className="sr-only">
                <SheetTitle>Navigation</SheetTitle>
              </SheetHeader>
              <SidebarContent onNavigate={() => setMobileOpen(false)} />
            </SheetContent>
          </Sheet>

          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>

          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
              <Bell className="size-4" />
              <span className="sr-only">Notifications</span>
            </Button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</main>
      </div>
    </div>
  )
}

export function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>
}