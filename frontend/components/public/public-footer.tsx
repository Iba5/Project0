'use client'

import { useState, useEffect, useRef } from 'react'
import { useAppStore } from '@/lib/store'
import { useRouter } from 'next/navigation'
import {
  Sparkles,
  Mail,
  ArrowRight,
  Heart,
  ArrowUp,
  MessageCircle,
  Phone,
  MapPin,
  Send,
  Globe,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { apiFetch } from '@/lib/api-client'

// Quick Links for navigation
const quickLinks = [
  { label: 'Home', view: 'landing' as const },
  { label: 'Contestants', view: 'contestants' as const },
  { label: 'Leaderboard', view: 'leaderboard' as const },
  { label: 'Events', view: 'events' as const },
  { label: 'Admin Portal', view: 'admin-login' as const },
]

// Section fade-in animation variants
const sectionVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' as const } },
}

function FooterSection({
  children,
  delay = 0,
}: {
  children: React.ReactNode
  delay?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.1 }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={isVisible ? 'visible' : 'hidden'}
      variants={sectionVariants}
      transition={{ delay }}
    >
      {children}
    </motion.div>
  )
}

// Social link type
interface SocialLink {
  name: string
  url: string
  platform: 'twitter' | 'facebook' | 'instagram' | 'whatsapp' | 'tiktok' | 'youtube' | 'other'
}

// Settings type from the API
interface FooterSettings {
  companyName: string
  supportEmail: string
  supportPhone: string
  supportAddress: string
  socialLinks: SocialLink[]
  website: string
}

function SocialIcon({ platform }: { platform: SocialLink['platform'] }) {
  switch (platform) {
    case 'twitter':
      return <span className="size-4 flex items-center justify-center text-sm">𝕏</span>
    case 'facebook':
      return <span className="size-4 flex items-center justify-center text-sm">f</span>
    case 'instagram':
      return <span className="size-4 flex items-center justify-center text-sm">📷</span>
    case 'whatsapp':
      return <MessageCircle className="size-4" />
    case 'tiktok':
      return <span className="size-4 flex items-center justify-center text-sm">♪</span>
    case 'youtube':
      return <span className="size-4 flex items-center justify-center text-sm">▶</span>
    default:
      return <Globe className="size-4" />
  }
}

export function PublicFooter() {
  const router = useRouter()
  const footerViewToPath = (view: string) => {
    if (view === 'landing') return '/'
    if (view === 'admin-login') return '/admin/login'
    return `/${view}`
  }
  const [email, setEmail] = useState('')
  const [subscribed, setSubscribed] = useState(false)
  const [subscribing, setSubscribing] = useState(false)
  const [showBackToTop, setShowBackToTop] = useState(false)
  const [settings, setSettings] = useState<FooterSettings | null>(null)

  // Footer visibility observer
  const footerRef = useRef<HTMLElement>(null)
  const [isVisible, setIsVisible] = useState(false)

  // Gradient animation state
  const [gradientOffset, setGradientOffset] = useState(0)

  // Fetch settings on mount
  useEffect(() => {
    async function loadSettings() {
      try {
        const data = await apiFetch<{ settings: FooterSettings }>('/settings')
        const s = data.settings
        setSettings({
          companyName: s.companyName || '',
          supportEmail: s.supportEmail || '',
          supportPhone: s.supportPhone || '',
          supportAddress: s.supportAddress || '',
          socialLinks: s.socialLinks || [],
          website: s.website || '',
        })
      } catch {
        // Settings not available, will show "not available" messages
      }
    }
    loadSettings()
  }, [])

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.05 }
    )
    if (footerRef.current) observer.observe(footerRef.current)
    return () => observer.disconnect()
  }, [])

  // Scroll listener for "Back to top" button
  useEffect(() => {
    const onScroll = () => {
      setShowBackToTop(window.scrollY > 400)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Animated gradient animation
  useEffect(() => {
    let frame: number
    const animate = () => {
      setGradientOffset((prev) => (prev + 0.3) % 360)
      frame = requestAnimationFrame(animate)
    }
    frame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frame)
  }, [])

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || subscribing) return

    setSubscribing(true)
    try {
      const data = await apiFetch<{ error?: string; alreadySubscribed?: boolean }>('/newsletter/subscribe', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim() }),
      })

      setSubscribed(true)
      toast.success('Subscribed!', {
        description: data.alreadySubscribed
          ? "You're already on our list!"
          : "You'll get updates on new contests and voting events.",
      })
      setEmail('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Subscription failed')
    } finally {
      setSubscribing(false)
    }
  }

  const handleBackToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const companyName = settings?.companyName || 'Vibe Hub'

  return (
    <footer
      ref={footerRef}
      className="relative overflow-hidden"
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translateY(0)' : 'translateY(16px)',
        transition: 'opacity 0.7s ease, transform 0.7s ease',
      }}
    >
      {/* Animated gradient border at top */}
      <div
        className="h-[2px] w-full"
        style={{
          backgroundImage: `linear-gradient(${90 + gradientOffset}deg, #F59E0B, #D97706, #FBBF24, #F59E0B, #D97706)`,
          backgroundSize: '200% 100%',
          animation: 'gradientShift 3s ease infinite',
        }}
      />

      {/* Darker background footer */}
      <div
        className="relative"
        style={{
          background: 'linear-gradient(180deg, #070A12 0%, #050810 100%)',
        }}
      >
        {/* Subtle radial glow backgrounds */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(ellipse at 20% 50%, rgba(245,158,11,0.03) 0%, transparent 50%),
                         radial-gradient(ellipse at 80% 40%, rgba(217,119,6,0.02) 0%, transparent 50%)`,
          }}
        />

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6">
          {/* Newsletter Section */}
          <FooterSection delay={0}>
            <div className="py-10 border-b" style={{ borderColor: 'rgba(245,158,11,0.1)' }}>
              <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="text-center md:text-left">
                  <h3 className="text-lg font-bold mb-1">
                    Stay in the{' '}
                    <span
                      style={{
                        background: 'linear-gradient(135deg, #FBBF24, #F59E0B, #D97706)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        backgroundClip: 'text',
                      }}
                    >
                      Loop
                    </span>
                  </h3>
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    Get notified about new contests, voting events, and exclusive content.
                  </p>
                </div>
                {subscribed ? (
                  <div
                    className="flex items-center gap-2 text-sm px-4 py-2 rounded-full"
                    style={{
                      color: '#22C55E',
                      background: 'rgba(34,197,94,0.1)',
                      border: '1px solid rgba(34,197,94,0.25)',
                    }}
                  >
                    <Mail className="size-4" />
                    You&apos;re subscribed!
                  </div>
                ) : (
                  <form onSubmit={handleSubscribe} className="flex gap-2 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                      <Mail
                        className="absolute left-3 top-1/2 -translate-y-1/2 size-4"
                        style={{ color: 'var(--text-muted)' }}
                      />
                      <Input
                        type="email"
                        placeholder="Enter your email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-9 rounded-full text-sm h-10 transition-all duration-300"
                        style={{
                          background: 'var(--surface-1)',
                          borderColor: 'var(--border-subtle)',
                          color: 'var(--text-primary)',
                        }}
                        required
                      />
                    </div>
                    <Button
                      type="submit"
                      disabled={subscribing}
                      className="rounded-full h-10 px-5 font-semibold text-sm transition-transform duration-200 active:scale-95 hover:scale-105"
                      style={{
                        background: 'linear-gradient(135deg, #F59E0B, #D97706)',
                        color: '#0B0F17',
                      }}
                    >
                      {subscribing ? (
                        <span className="flex items-center gap-1">
                          <span className="size-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                          Subscribing...
                        </span>
                      ) : (
                        <>
                          Subscribe
                          <ArrowRight className="size-3.5 ml-1" />
                        </>
                      )}
                    </Button>
                  </form>
                )}
              </div>
            </div>
          </FooterSection>

          {/* Main Footer Grid: 4 columns on desktop, 2 on tablet, 1 on mobile */}
          <div className="py-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-6">
            {/* Brand Column */}
            <FooterSection delay={0.1}>
              <div>
                <div className="flex items-center gap-2.5 mb-4">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center"
                    style={{
                      background: 'linear-gradient(135deg, #F59E0B, #D97706)',
                      boxShadow: '0 0 12px rgba(245,158,11,0.2)',
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
                    {companyName}
                  </span>
                </div>
                <p
                  className="text-sm leading-relaxed mb-4"
                  style={{ color: 'var(--text-muted)' }}
                >
                  The ultimate digital entertainment voting platform. Support your favorite
                  performers and help shape the stage.
                </p>
                {/* Social icons */}
                <div className="flex items-center gap-2">
                  {settings?.socialLinks && settings.socialLinks.length > 0 ? (
                    settings.socialLinks.map((social, idx) => (
                      <motion.a
                        key={idx}
                        href={social.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        whileHover={{ scale: 1.15, y: -2 }}
                        whileTap={{ scale: 0.95 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                        className="w-9 h-9 rounded-full flex items-center justify-center transition-colors duration-200"
                        style={{
                          color: 'var(--text-muted)',
                          background: 'var(--surface-2)',
                        }}
                        title={social.name}
                        aria-label={social.name}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = '#F59E0B'
                          e.currentTarget.style.background = 'rgba(245,158,11,0.1)'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = 'var(--text-muted)'
                          e.currentTarget.style.background = 'var(--surface-2)'
                        }}
                      >
                        <SocialIcon platform={social.platform} />
                      </motion.a>
                    ))
                  ) : (
                    <span className="text-xs italic" style={{ color: 'var(--text-muted)' }}>
                      Social links not configured yet
                    </span>
                  )}
                </div>
              </div>
            </FooterSection>

            {/* Quick Links Column */}
            <FooterSection delay={0.2}>
              <div>
                <h4
                  className="font-semibold text-sm mb-4 flex items-center gap-2"
                  style={{ color: 'var(--text-primary)' }}
                >
                  <ArrowRight className="size-3.5" style={{ color: '#F59E0B' }} />
                  Quick Links
                </h4>
                <ul className="space-y-2.5">
                  {quickLinks.map((link) => (
                    <li key={link.view}>
                      <button
                        onClick={() => {
                          router.push(footerViewToPath(link.view))
                          window.scrollTo({ top: 0, behavior: 'smooth' })
                        }}
                        className="text-sm transition-colors duration-200 hover:translate-x-1 inline-block"
                        style={{ color: 'var(--text-muted)' }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = '#F59E0B'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = 'var(--text-muted)'
                        }}
                      >
                        {link.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </FooterSection>

            {/* Contact Us Column */}
            <FooterSection delay={0.3}>
              <div>
                <h4
                  className="font-semibold text-sm mb-4 flex items-center gap-2"
                  style={{ color: 'var(--text-primary)' }}
                >
                  <Send className="size-3.5" style={{ color: '#F59E0B' }} />
                  Contact Us
                </h4>
                <div className="space-y-3">
                  <div className="flex items-center gap-2.5">
                    <Mail className="size-3.5 shrink-0" style={{ color: '#F59E0B' }} />
                    <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                      {settings?.supportEmail || 'Not available yet'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Phone className="size-3.5 shrink-0" style={{ color: '#F59E0B' }} />
                    <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                      {settings?.supportPhone || 'Not available yet'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <MapPin className="size-3.5 shrink-0" style={{ color: '#F59E0B' }} />
                    <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                      {settings?.supportAddress || 'Not available yet'}
                    </span>
                  </div>
                </div>
              </div>
            </FooterSection>

            {/* Support Column */}
            <FooterSection delay={0.4}>
              <div>
                <h4
                  className="font-semibold text-sm mb-4 flex items-center gap-2"
                  style={{ color: 'var(--text-primary)' }}
                >
                  <Heart className="size-3.5" style={{ color: '#F59E0B' }} />
                  Support
                </h4>
                <ul className="space-y-2.5">
                  {[
                    { label: 'FAQ', view: 'landing' as const },
                    { label: 'Terms of Service', view: 'landing' as const },
                    { label: 'Privacy Policy', view: 'landing' as const },
                    { label: 'How It Works', view: 'landing' as const },
                  ].map((link) => (
                    <li key={link.label}>
                      <button
                        onClick={() => {
                          router.push(footerViewToPath(link.view))
                          window.scrollTo({ top: 0, behavior: 'smooth' })
                        }}
                        className="text-sm transition-colors duration-200"
                        style={{ color: 'var(--text-muted)' }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = '#F59E0B'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = 'var(--text-muted)'
                        }}
                      >
                        {link.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </FooterSection>
          </div>

          {/* Bottom Bar */}
          <div
            className="py-6 flex flex-col sm:flex-row items-center justify-between gap-4"
            style={{ borderTop: '1px solid rgba(245,158,11,0.1)' }}
          >
            <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4">
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                &copy; {new Date().getFullYear()} {companyName}. All rights reserved.
              </p>
              <p
                className="text-xs flex items-center gap-1"
                style={{ color: 'var(--text-muted)' }}
              >
                Made with <Heart className="size-3 fill-gold-500" style={{ color: '#F59E0B' }} /> by VibeWave
              </p>
            </div>
            <div className="flex items-center gap-4">
              <p
                className="text-xs font-medium"
                style={{ color: 'rgba(245,158,11,0.5)' }}
              >
                Powered by Vibe Hub
              </p>
              {/* Back to Top button */}
              <AnimatePresence>
                {showBackToTop && (
                  <motion.button
                    key="footer-back-to-top"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={handleBackToTop}
                    aria-label="Back to top"
                    className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full transition-colors"
                    style={{
                      color: '#F59E0B',
                      background: 'rgba(245, 158, 11, 0.1)',
                      border: '1px solid rgba(245, 158, 11, 0.25)',
                    }}
                  >
                    <ArrowUp className="size-3" />
                    Back to top
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
