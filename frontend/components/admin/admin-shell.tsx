'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard,
  Calendar,
  Users,
  CreditCard,
  Settings,
  UserCog,
  Share2,
  ScrollText,
  LogOut,
  Menu,
  X,
  Sparkles,
  ChevronRight,
  ArrowLeft,
  Bell,
  Home,
  Wallet,
} from 'lucide-react'
import { useAppStore, type ViewName, viewToPath } from '@/lib/store'
import { logout } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ThemeToggle } from '@/components/theme-toggle'
import { toast } from 'sonner'
import { useRouter, usePathname } from 'next/navigation'

interface NavItem {
  label: string
  view: ViewName
  icon: React.ComponentType<{ className?: string }>
  section: 'main' | 'management' | 'settings'
}

const navItems: NavItem[] = [
  { label: 'Dashboard', view: 'admin-dashboard', icon: LayoutDashboard, section: 'main' },
  { label: 'Events', view: 'admin-events', icon: Calendar, section: 'main' },
  { label: 'Participants', view: 'admin-participants', icon: Users, section: 'management' },
  { label: 'Payments', view: 'admin-payments', icon: CreditCard, section: 'management' },
  { label: 'Payment Methods', view: 'admin-payment-methods', icon: Wallet, section: 'management' },
  { label: 'Settings', view: 'admin-settings', icon: Settings, section: 'settings' },
  { label: 'Admins', view: 'admin-admins', icon: UserCog, section: 'settings' },
  { label: 'Audit Log', view: 'admin-audit', icon: ScrollText, section: 'settings' },
  { label: 'Social Router', view: 'admin-social-router', icon: Share2, section: 'settings' },
]

const sectionLabels: Record<string, string> = {
  main: 'Main',
  management: 'Management',
  settings: 'Settings',
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const { adminUser, setAdminUser } = useAppStore()
  const router = useRouter()
  const pathname = usePathname() ?? ''
  const currentView = (pathname.startsWith('/admin/')
    ? `admin-${pathname.replace('/admin/', '')}`
    : 'admin-dashboard') as ViewName
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [notificationCount] = useState(3)

  const handleLogout = async () => {
    try {
      await logout()
      setAdminUser(null)
      router.push('/admin/login')
      toast.success('Logged out successfully')
    } catch (error) {
      // Even if API call fails, clear local state and redirect
      setAdminUser(null)
      router.push('/admin/login')
      toast.error('Logout completed (may have API errors)')
    }
  }

  const handleNav = (view: ViewName) => {
    router.push(viewToPath(view))
    setSidebarOpen(false)
  }

  const handleBackToPublic = () => {
    router.push('/')
    setSidebarOpen(false)
  }

  // Group nav items by section
  const sections = ['main', 'management', 'settings'] as const

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center shadow-lg"
          style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)', boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)' }}
        >
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>Vibe Hub</h1>
            <span
              className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
              style={{ background: 'rgba(245,158,11,0.15)', color: '#F59E0B' }}
              title="Phase 7"
            >
              P7
            </span>
          </div>
          <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Admin Panel</p>
        </div>
      </div>

      <Separator style={{ background: 'var(--border-subtle)' }} />

      {/* Back to Public Site — wrapped in a subtle bordered card to feel less isolated */}
      <div className="px-3 pt-3 pb-1">
        <button
          onClick={handleBackToPublic}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
          style={{
            color: 'var(--text-muted)',
            background: 'var(--surface-3)',
            border: '1px solid var(--border-subtle)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(245,158,11,0.06)'
            e.currentTarget.style.color = 'var(--text-primary)'
            e.currentTarget.style.borderColor = 'rgba(245,158,11,0.25)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--surface-3)'
            e.currentTarget.style.color = 'var(--text-muted)'
            e.currentTarget.style.borderColor = 'var(--border-subtle)'
          }}
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="flex-1 text-left">Back to Public Site</span>
          <Home className="w-4 h-4 opacity-70" />
        </button>
      </div>

      {/* Nav Items with Section Dividers */}
      <ScrollArea className="flex-1 py-1">
        <nav className="space-y-1 px-3">
          {sections.map((section, sectionIndex) => {
            const sectionItems = navItems.filter((item) => item.section === section)
            return (
              <div key={section}>
                {sectionIndex > 0 && (
                  <div className="pt-3 pb-2 px-3">
                    <p
                      className="text-[10px] font-semibold uppercase tracking-wider"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {sectionLabels[section]}
                    </p>
                  </div>
                )}
                {sectionIndex === 0 && (
                  <div className="pb-2 px-3">
                    <p
                      className="text-[10px] font-semibold uppercase tracking-wider"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {sectionLabels[section]}
                    </p>
                  </div>
                )}
                {sectionItems.map((item) => {
                  const isActive = currentView === item.view
                  return (
                    <button
                      key={item.view}
                      onClick={() => handleNav(item.view)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all relative"
                      style={{
                        background: isActive ? 'rgba(245, 158, 11, 0.15)' : 'transparent',
                        color: isActive ? '#F59E0B' : 'var(--text-muted)',
                        borderLeft: isActive ? '3px solid #F59E0B' : '3px solid transparent',
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive) {
                          e.currentTarget.style.background = 'var(--surface-3)'
                          e.currentTarget.style.color = 'var(--text-primary)'
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive) {
                          e.currentTarget.style.background = 'transparent'
                          e.currentTarget.style.color = 'var(--text-muted)'
                        }
                      }}
                    >
                      <item.icon className="w-4 h-4" />
                      <span className="flex-1 text-left">{item.label}</span>
                      {isActive && <ChevronRight className="w-4 h-4" />}
                    </button>
                  )
                })}
              </div>
            )
          })}
        </nav>
      </ScrollArea>

      <Separator style={{ background: 'var(--border-subtle)' }} />

      {/* User & Logout */}
      <div className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shadow-md"
            style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)', color: '#0B0F17', boxShadow: '0 2px 8px rgba(245, 158, 11, 0.3)' }}
          >
            {adminUser?.name?.charAt(0)?.toUpperCase() || 'A'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
              {adminUser?.name || 'Admin'}
            </p>
            <p className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>
              {adminUser?.role || 'Admin'}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          onClick={handleLogout}
          className="w-full justify-start gap-2 rounded-xl text-sm"
          style={{ color: 'var(--text-muted)' }}
        >
          <LogOut className="w-4 h-4" /> Sign Out
        </Button>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen" style={{ background: 'var(--background)' }}>
      {/* Desktop Sidebar */}
      <aside
        className="hidden md:flex w-64 flex-col border-r"
        style={{
          background: 'var(--surface-3)',
          borderColor: 'var(--border-subtle)',
        }}
      >
        {sidebarContent}
      </aside>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 md:hidden"
              style={{ background: 'rgba(0,0,0,0.6)' }}
              onClick={() => setSidebarOpen(false)}
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed left-0 top-0 bottom-0 z-50 w-64 md:hidden"
              style={{
                background: 'var(--surface-3)',
                borderColor: 'var(--border-subtle)',
              }}
            >
              <button
                onClick={() => setSidebarOpen(false)}
                className="absolute top-4 right-4"
                style={{ color: 'var(--text-muted)' }}
              >
                <X className="w-5 h-5" />
              </button>
              {sidebarContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar (mobile) */}
        <header
          className="md:hidden flex items-center justify-between px-4 py-3 border-b"
          style={{
            background: 'var(--surface-3)',
            borderColor: 'var(--border-subtle)',
          }}
        >
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} style={{ color: 'var(--text-muted)' }}>
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)' }}
              >
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>Vibe Hub</span>
            </div>
          </div>
          {/* Notification Bell + Theme toggle on Mobile */}
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <button
              className="relative"
              onClick={() => toast.info('Notifications coming soon!')}
              style={{ color: 'var(--text-muted)' }}
            >
              <Bell className="w-5 h-5" />
              {notificationCount > 0 && (
                <span
                  className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center"
                  style={{ background: '#EF4444', color: '#FFFFFF' }}
                >
                  {notificationCount}
                </span>
              )}
            </button>
          </div>
        </header>

        {/* Desktop Top Bar with Notification + Theme */}
        <header
          className="hidden md:flex items-center justify-end gap-2 px-6 py-3 border-b"
          style={{
            background: 'var(--surface-3)',
            borderColor: 'var(--border-subtle)',
          }}
        >
          <ThemeToggle />
          <div
            className="w-px h-5 mx-1"
            style={{ background: 'var(--border-subtle)' }}
            aria-hidden
          />
          <button
            className="relative"
            onClick={() => toast.info('Notifications coming soon!')}
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)' }}
          >
            <Bell className="w-5 h-5" />
            {notificationCount > 0 && (
              <span
                className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center"
                style={{ background: '#EF4444', color: '#FFFFFF' }}
              >
                {notificationCount}
              </span>
            )}
          </button>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentView}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  )
}
