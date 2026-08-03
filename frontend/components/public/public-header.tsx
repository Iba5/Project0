'use client'

import { useAppStore } from '@/lib/store'
import { Sparkles, Menu, X, Vote, Users, Trophy, Shield, Calendar, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/theme-toggle'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { GlobalSearch } from '@/components/shared/global-search'
import { NotificationCenter } from '@/components/shared/notification-center'
import { useIsMobile } from '@/hooks/use-mobile'
import { useRouter, usePathname } from 'next/navigation'

export function PublicHeader() {
  const { setSearchOpen } = useAppStore()
  const router = useRouter()
  const pathname = usePathname() ?? '/'
  const currentView = pathname === '/' ? 'landing' : pathname.replace(/^\//, '')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const isMobile = useIsMobile()

  // Cmd/Ctrl+K shortcut to open the global search dialog
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [setSearchOpen])

  // Scroll state for backdrop blur intensity
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const navItems = [
    { label: 'Home', view: 'landing' as const, icon: Vote },
    { label: 'Contestants', view: 'contestants' as const, icon: Users },
    { label: 'Leaderboard', view: 'leaderboard' as const, icon: Trophy },
    { label: 'Events', view: 'events' as const, icon: Calendar },
  ]

  return (
    <>
      <header
        className={`sticky top-0 z-50 border-b border-border/40 transition-all duration-300 ${scrolled ? 'header-glass-scrolled' : ''}`}
        style={!scrolled ? {
          background: 'var(--glass-bg)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderBottomColor: 'var(--glass-border)',
        } : undefined}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            {/* Logo with gold gradient + Live badge */}
            <button
              onClick={() => router.push('/')}
              className="flex items-center gap-2.5 hover:opacity-80 transition-opacity"
            >
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center"
                style={{
                  background: 'linear-gradient(135deg, #F59E0B, #D97706)',
                  boxShadow: '0 0 12px rgba(245,158,11,0.3)',
                }}
              >
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <span
                className="font-bold text-lg"
                style={{
                  background: 'linear-gradient(135deg, #FBBF24, #F59E0B, #D97706)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                Vibe Hub
              </span>
              {/* Live indicator badge */}
              <span className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium"
                style={{
                  background: 'rgba(34,197,94,0.1)',
                  border: '1px solid rgba(34,197,94,0.2)',
                  color: '#22C55E',
                }}
              >
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping-slow absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500" />
                </span>
                LIVE
              </span>
            </button>

            {/* Desktop Nav — with animated underline on hover */}
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
                const isActive = currentView === item.view
                return (
                  <button
                    key={item.view}
                    onClick={() => router.push(item.view === 'landing' ? '/' : `/${item.view}`)}
                    className={`relative px-4 py-2 rounded-lg text-sm font-medium transition-all inline-flex items-center gap-1.5 ${isActive ? 'nav-active-underline' : ''}`}
                    style={{
                      background: isActive ? 'rgba(245, 158, 11, 0.15)' : 'transparent',
                      color: isActive ? '#F59E0B' : 'var(--text-muted)',
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) e.currentTarget.style.background = 'var(--surface-3)'
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) e.currentTarget.style.background = 'transparent'
                    }}
                  >
                    {item.label}
                  </button>
                )
              })}

              {/* Search trigger button with ⌘K hint */}
              <button
                onClick={() => setSearchOpen(true)}
                aria-label="Open global search"
                className="ml-2 inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-medium transition-all duration-200 hover:bg-accent"
                style={{
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-muted)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(245, 158, 11, 0.4)'
                  e.currentTarget.style.color = '#F59E0B'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-subtle)'
                  e.currentTarget.style.color = 'var(--text-muted)'
                }}
              >
                <Search className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">Search</span>
                <kbd
                  className="hidden lg:inline-flex items-center justify-center rounded px-1.5 py-0.5 text-[10px] font-semibold leading-none"
                  style={{
                    background: 'var(--surface-3)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-muted)',
                  }}
                >
                  ⌘K
                </kbd>
              </button>
            </nav>

            {/* Desktop CTA */}
            <div className="hidden md:flex items-center gap-3">
              <NotificationCenter />
              <ThemeToggle />
              <Button
                onClick={() => router.push('/admin/login')}
                variant="ghost"
                className="rounded-full text-sm"
                style={{ color: 'var(--text-muted)' }}
              >
                <Shield className="w-4 h-4 mr-1.5" />
                Admin
              </Button>
              <div className="relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-gold-500 via-gold-400 to-gold-600 rounded-full blur-sm opacity-50 group-hover:opacity-100 transition-opacity duration-300" />
                <Button
                  onClick={() => router.push('/contestants')}
                  className="relative rounded-full text-sm font-semibold hover-glow-gold transition-transform duration-200 active:scale-95 hover:scale-105"
                  style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)', color: '#0B0F17' }}
                >
                  Vote Now
                </Button>
              </div>
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg transition-colors hover:bg-accent"
              style={{ color: 'var(--text-muted)' }}
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            {/* Mobile search button */}
            <button
              onClick={() => setSearchOpen(true)}
              className="md:hidden p-2 rounded-lg transition-colors hover:bg-accent"
              style={{ color: 'var(--text-muted)' }}
              aria-label="Search"
            >
              <Search className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Mobile Menu — with slide-down animation */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              key="mobile-menu"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="md:hidden overflow-hidden border-t border-border/40"
              style={{
                background: 'var(--glass-strong-bg)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
              }}
            >
              <div className="px-4 py-4 space-y-2">
                {navItems.map((item, i) => {
                  const isActive = currentView === item.view
                  return (
                    <motion.button
                      key={item.view}
                      onClick={() => {
                        router.push(item.view === 'landing' ? '/' : `/${item.view}`)
                        setMobileMenuOpen(false)
                      }}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05, duration: 0.25 }}
                      className="w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-all flex items-center gap-2"
                      style={{
                        background: isActive ? 'rgba(245, 158, 11, 0.15)' : 'transparent',
                        color: isActive ? '#F59E0B' : 'var(--text-muted)',
                      }}
                    >
                      <span className="flex-1">{item.label}</span>
                    </motion.button>
                  )
                })}
                <div className="flex flex-col gap-2 pt-2">
                  <div className="flex items-center gap-2">
                    <NotificationCenter />
                    <ThemeToggle />
                    <Button
                      onClick={() => {
                        router.push('/admin/login')
                        setMobileMenuOpen(false)
                      }}
                      variant="outline"
                      className="flex-1 rounded-full text-sm border-border"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      Admin
                    </Button>
                  </div>
                  <Button
                    onClick={() => {
                      router.push('/contestants')
                      setMobileMenuOpen(false)
                    }}
                    className="w-full rounded-full text-sm font-semibold transition-transform duration-200 active:scale-95"
                    style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)', color: '#0B0F17' }}
                  >
                    Vote Now
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Global Search Dialog (Cmd/Ctrl+K) */}
      <GlobalSearch />

      {/* Mobile Bottom Tab Bar */}
      {isMobile && <MobileTabBar currentView={currentView} navigate={(v) => router.push(v === 'landing' ? '/' : `/${v}`)} setSearchOpen={setSearchOpen} />}
    </>
  )
}

// ─── Mobile Bottom Tab Bar ─────────────────────────────────────────
function MobileTabBar({
  currentView,
  navigate,
  setSearchOpen,
}: {
  currentView: string
  navigate: (view: string) => void
  setSearchOpen: (open: boolean) => void
}) {
  const tabs = [
    { label: 'Home', view: 'landing', icon: Vote },
    { label: 'Contestants', view: 'contestants', icon: Users },
    { label: 'Leaderboard', view: 'leaderboard', icon: Trophy },
    { label: 'Search', view: '__search__', icon: Search },
  ]

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden border-t safe-area-bottom"
      style={{
        background: 'rgba(11, 15, 23, 0.95)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderColor: 'rgba(245, 158, 11, 0.12)',
      }}
    >
      <div className="flex items-center justify-around h-16 px-2">
        {tabs.map((tab) => {
          const isActive = tab.view === '__search__' ? false : currentView === tab.view
          const Icon = tab.icon
          const isSearchTab = tab.view === '__search__'

          return (
            <button
              key={tab.view}
              onClick={() => {
                if (isSearchTab) {
                  setSearchOpen(true)
                } else {
                  navigate(tab.view)
                }
              }}
              className="relative flex flex-col items-center justify-center gap-1 flex-1 py-1 transition-colors"
              aria-label={tab.label}
              aria-current={isActive ? 'page' : undefined}
            >
              {/* Active gold indicator line */}
              {isActive && (
                <motion.div
                  layoutId="tab-indicator"
                  className="absolute -top-px left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full"
                  style={{ background: 'linear-gradient(90deg, #F59E0B, #D97706)' }}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              <div className="relative">
                <Icon
                  className="w-5 h-5 transition-colors"
                  style={{ color: isActive ? '#F59E0B' : 'var(--text-muted)' }}
                />
              </div>
              <span
                className="text-[10px] font-medium leading-none transition-colors"
                style={{ color: isActive ? '#F59E0B' : 'var(--text-muted)' }}
              >
                {tab.label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
