'use client'

import { useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence, type Variants } from 'framer-motion'
import {
  Twitter,
  Facebook,
  MessageCircle,
  Send,
  Link2,
  Check,
  Share2,
  ExternalLink,
  QrCode,
  Download,
  Trophy,
  Vote,
  Crown,
  TrendingUp,
  X,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/api-client'

// ─── Types ────────────────────────────────────────────────────────

interface ContestantPreview {
  name: string
  category?: string
  votes?: number
  rank?: number
  platform?: string
}

interface ShareModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  url?: string
  contestant?: ContestantPreview
  participantId?: string
}

// ─── Share platform config ───────────────────────────────────────

interface SharePlatform {
  key: string
  label: string
  icon: React.ReactNode
  color: string
  hoverBg: string
  getShareUrl: (text: string, url: string) => string
}

const SHARE_PLATFORMS: SharePlatform[] = [
  {
    key: 'twitter',
    label: 'Twitter / X',
    icon: <Twitter className="size-5" />,
    color: '#1DA1F2',
    hoverBg: 'rgba(29, 161, 242, 0.15)',
    getShareUrl: (text, url) =>
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
  },
  {
    key: 'facebook',
    label: 'Facebook',
    icon: <Facebook className="size-5" />,
    color: '#1877F2',
    hoverBg: 'rgba(24, 119, 242, 0.15)',
    getShareUrl: (_text, url) =>
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
  },
  {
    key: 'whatsapp',
    label: 'WhatsApp',
    icon: <MessageCircle className="size-5" />,
    color: '#25D366',
    hoverBg: 'rgba(37, 211, 102, 0.15)',
    getShareUrl: (text, url) =>
      `https://wa.me/?text=${encodeURIComponent(text + ' ' + url)}`,
  },
  {
    key: 'telegram',
    label: 'Telegram',
    icon: <Send className="size-5" />,
    color: '#26A5E4',
    hoverBg: 'rgba(38, 165, 228, 0.15)',
    getShareUrl: (text, url) =>
      `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
  },
]

// ─── LocalStorage helpers for share count ─────────────────────────

const SHARE_COUNT_KEY = 'vibe-hub-share-counts'

function getShareCounts(): Record<string, number> {
  if (typeof window === 'undefined') return {}
  try {
    const stored = window.localStorage.getItem(SHARE_COUNT_KEY)
    if (!stored) return {}
    return JSON.parse(stored)
  } catch {
    return {}
  }
}

function incrementShareCount(participantId: string): number {
  try {
    const counts = getShareCounts()
    const newCount = (counts[participantId] || 0) + 1
    counts[participantId] = newCount
    window.localStorage.setItem(SHARE_COUNT_KEY, JSON.stringify(counts))
    return newCount
  } catch {
    return 0
  }
}

// ─── QR Code Generator (canvas-based) ────────────────────────────

function generateQRCodeDataUrl(text: string, size = 180): Promise<string> {
  return new Promise((resolve, reject) => {
    // Dynamic import to avoid SSR issues
    import('qrcode').then((QRCode) => {
      QRCode.toDataURL(text, {
        width: size,
        margin: 2,
        color: {
          dark: '#F59E0B',
          light: '#0B0F17',
        },
        errorCorrectionLevel: 'M',
      }, (err: Error | null | undefined, url: string | undefined) => {
        if (err || !url) {
          // Fallback: generate a simple placeholder
          resolve(generateFallbackQR(size))
          return
        }
        resolve(url)
      })
    }).catch(() => {
      resolve(generateFallbackQR(size))
    })
  })
}

function generateFallbackQR(size: number): string {
  // Simple canvas-based pattern as fallback
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''

  // Background
  ctx.fillStyle = '#0B0F17'
  ctx.fillRect(0, 0, size, size)

  // Grid pattern
  const cellSize = 6
  const padding = 20
  const gridSize = Math.floor((size - padding * 2) / cellSize)

  ctx.fillStyle = '#F59E0B'

  // Corner markers (like QR code)
  function drawCornerMarker(c: CanvasRenderingContext2D, x: number, y: number) {
    // Outer square
    c.fillRect(x, y, cellSize * 7, cellSize * 7)
    c.fillStyle = '#0B0F17'
    c.fillRect(x + cellSize, y + cellSize, cellSize * 5, cellSize * 5)
    c.fillStyle = '#F59E0B'
    c.fillRect(x + cellSize * 2, y + cellSize * 2, cellSize * 3, cellSize * 3)
  }

  // Top-left
  drawCornerMarker(ctx, padding, padding)
  // Top-right
  drawCornerMarker(ctx, padding + (gridSize - 7) * cellSize, padding)
  // Bottom-left
  drawCornerMarker(ctx, padding, padding + (gridSize - 7) * cellSize)

  // Random data pattern
  ctx.fillStyle = '#F59E0B'
  for (let i = 0; i < gridSize; i++) {
    for (let j = 0; j < gridSize; j++) {
      // Skip corners
      if ((i < 8 && j < 8) || (i < 8 && j > gridSize - 9) || (i > gridSize - 9 && j < 8)) continue
      if (Math.random() > 0.5) {
        ctx.fillRect(padding + i * cellSize, padding + j * cellSize, cellSize - 1, cellSize - 1)
      }
    }
  }

  return canvas.toDataURL('image/png')
}

// ─── Rank badge helper ───────────────────────────────────────────

function getRankBadge(rank: number): { icon: React.ReactNode; color: string; label: string } {
  if (rank === 1) return { icon: <Crown className="size-3.5" />, color: '#FBBF24', label: '#1' }
  if (rank === 2) return { icon: <Trophy className="size-3.5" />, color: '#94A3B8', label: '#2' }
  if (rank === 3) return { icon: <Trophy className="size-3.5" />, color: '#D97706', label: '#3' }
  return { icon: <TrendingUp className="size-3.5" />, color: '#64748B', label: `#${rank}` }
}

// ─── Component ────────────────────────────────────────────────────

export function ShareModal({
  open,
  onOpenChange,
  title,
  description,
  url,
  contestant,
  participantId,
}: ShareModalProps) {
  const [copied, setCopied] = useState(false)
  const [showQR, setShowQR] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [shareCount, setShareCount] = useState(() => {
    if (typeof window === 'undefined' || !participantId) return 0
    try {
      const counts = getShareCounts()
      return counts[participantId] || 0
    } catch {
      return 0
    }
  })
  const [copyAnimating, setCopyAnimating] = useState(false)

  const shareUrl = url || (typeof window !== 'undefined' ? window.location.href : '')
  const shareText = `${title} — ${description}`

  // Generate QR code when toggled
  useEffect(() => {
    if (showQR && open && !qrDataUrl) {
      generateQRCodeDataUrl(shareUrl, 180).then((dataUrl) => {
        setQrDataUrl(dataUrl)
      })
    }
  }, [showQR, open, shareUrl, qrDataUrl])

  // Reset QR when modal closes — managed via onOpenChange wrapper
  const handleOpenChange = useCallback((nextOpen: boolean) => {
    if (!nextOpen) {
      setShowQR(false)
      setQrDataUrl(null)
      setCopied(false)
      // Refresh share count from localStorage on close
      if (participantId) {
        const counts = getShareCounts()
        setShareCount(counts[participantId] || 0)
      }
    }
    onOpenChange(nextOpen)
  }, [onOpenChange, participantId])

  const handlePlatformShare = useCallback(
    (platform: SharePlatform) => {
      const targetUrl = platform.getShareUrl(shareText, shareUrl)
      window.open(targetUrl, '_blank', 'noopener,noreferrer,width=600,height=500')

      // Track share event
      if (participantId) {
        const newCount = incrementShareCount(participantId)
        setShareCount(newCount)

        // Track in API
        apiFetch('/share', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ participantId, platform: platform.key }),
        }).catch(() => {
          // Non-critical — silently fail
        })
      }
    },
    [shareText, shareUrl, participantId],
  )

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setCopyAnimating(true)
      toast.success('Link copied to clipboard!')

      // Track share event
      if (participantId) {
        const newCount = incrementShareCount(participantId)
        setShareCount(newCount)

        apiFetch('/share', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ participantId, platform: 'link' }),
        }).catch(() => {})
      }

      setTimeout(() => {
        setCopied(false)
        setCopyAnimating(false)
      }, 2000)
    } catch {
      toast.error('Failed to copy link')
    }
  }, [shareUrl, participantId])

  const handleNativeShare = useCallback(async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title,
          text: description,
          url: shareUrl,
        })

        // Track share event
        if (participantId) {
          const newCount = incrementShareCount(participantId)
          setShareCount(newCount)

          apiFetch('/share', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ participantId, platform: 'native' }),
          }).catch(() => {})
        }
      } catch {
        // User cancelled
      }
    } else {
      await handleCopyLink()
    }
  }, [title, description, shareUrl, handleCopyLink, participantId])

  const handleDownloadQR = useCallback(() => {
    if (!qrDataUrl) return
    const link = document.createElement('a')
    link.download = `vibehub-share-${participantId || 'qr'}.png`
    link.href = qrDataUrl
    link.click()
    toast.success('QR code downloaded!')
  }, [qrDataUrl, participantId])

  // Animation variants
  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.05 },
    },
  }

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 10, scale: 0.95 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: { duration: 0.3, ease: 'easeOut' as const },
    },
  }

  const rankBadge = contestant?.rank ? getRankBadge(contestant.rank) : null

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="sm:max-w-md"
        style={{
          background: 'rgba(15, 20, 30, 0.95)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(245, 158, 11, 0.15)',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.5), 0 0 40px rgba(245, 158, 11, 0.05)',
        }}
      >
        <DialogHeader>
          <DialogTitle
            className="flex items-center gap-2 text-left"
            style={{ color: 'var(--text-primary)' }}
          >
            <Share2 className="size-5" style={{ color: '#F59E0B' }} />
            Share
          </DialogTitle>
          <DialogDescription style={{ color: 'var(--text-muted)' }}>
            Spread the word — every share helps!
          </DialogDescription>
        </DialogHeader>

        <AnimatePresence>
          {open && (
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="space-y-4"
            >
              {/* ─── Contestant Preview Card ────────────────────────── */}
              {contestant && (
                <motion.div
                  variants={itemVariants}
                  className="rounded-xl overflow-hidden relative"
                  style={{
                    background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.12), rgba(217, 119, 6, 0.06), rgba(251, 191, 36, 0.08))',
                    border: '1px solid rgba(245, 158, 11, 0.2)',
                  }}
                >
                  {/* Decorative shimmer */}
                  <div
                    className="absolute inset-0 opacity-30"
                    style={{
                      background: 'radial-gradient(ellipse at 20% 50%, rgba(245, 158, 11, 0.15) 0%, transparent 60%)',
                    }}
                  />

                  <div className="relative p-4">
                    <div className="flex items-start gap-3">
                      {/* Avatar */}
                      <div
                        className="shrink-0 rounded-xl flex items-center justify-center text-white font-bold text-lg"
                        style={{
                          width: 52,
                          height: 52,
                          background: 'linear-gradient(135deg, #F59E0B, #D97706)',
                          boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)',
                        }}
                      >
                        {contestant.name.charAt(0)}
                      </div>

                      {/* Info */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p
                            className="text-sm font-bold truncate"
                            style={{ color: 'var(--text-primary)' }}
                          >
                            {contestant.name}
                          </p>
                          {rankBadge && (
                            <span
                              className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                              style={{
                                backgroundColor: `${rankBadge.color}20`,
                                color: rankBadge.color,
                              }}
                            >
                              {rankBadge.icon}
                              {rankBadge.label}
                            </span>
                          )}
                        </div>

                        {/* Category & Platform badges */}
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          {contestant.category && (
                            <span
                              className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                              style={{
                                backgroundColor: 'rgba(245, 158, 11, 0.15)',
                                color: '#FBBF24',
                              }}
                            >
                              {contestant.category}
                            </span>
                          )}
                          {contestant.platform && (
                            <span
                              className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                              style={{
                                backgroundColor: 'rgba(100, 116, 139, 0.15)',
                                color: '#94A3B8',
                              }}
                            >
                              {contestant.platform}
                            </span>
                          )}
                        </div>

                        {/* Votes */}
                        {contestant.votes !== undefined && (
                          <div className="flex items-center gap-1 mt-1.5">
                            <Vote className="size-3" style={{ color: '#F59E0B' }} />
                            <span
                              className="text-xs font-bold"
                              style={{ color: '#FBBF24' }}
                            >
                              {contestant.votes.toLocaleString()}
                            </span>
                            <span
                              className="text-[10px]"
                              style={{ color: 'var(--text-muted)' }}
                            >
                              votes
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Share count badge */}
                    {shareCount > 0 && (
                      <div
                        className="mt-3 flex items-center gap-1.5 text-[10px] px-2 py-1 rounded-full w-fit"
                        style={{
                          backgroundColor: 'rgba(245, 158, 11, 0.08)',
                          color: '#D97706',
                        }}
                      >
                        <Share2 className="size-3" />
                        Shared {shareCount} {shareCount === 1 ? 'time' : 'times'}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {/* ─── Non-contestant preview (fallback) ───────────────── */}
              {!contestant && (
                <motion.div
                  variants={itemVariants}
                  className="rounded-xl p-4"
                  style={{
                    background: 'rgba(245, 158, 11, 0.06)',
                    border: '1px solid rgba(245, 158, 11, 0.12)',
                  }}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="shrink-0 rounded-lg flex items-center justify-center"
                      style={{
                        width: 40,
                        height: 40,
                        background: 'linear-gradient(135deg, #F59E0B, #D97706)',
                      }}
                    >
                      <Share2 className="size-5 text-white" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p
                        className="text-sm font-semibold truncate"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {title}
                      </p>
                      <p
                        className="text-xs mt-0.5 line-clamp-2"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        {description}
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ─── QR Code Section ─────────────────────────────────── */}
              <motion.div variants={itemVariants}>
                <button
                  onClick={() => setShowQR(!showQR)}
                  className="w-full flex items-center justify-between rounded-xl px-4 py-3 text-sm font-medium transition-colors duration-200"
                  style={{
                    background: showQR
                      ? 'rgba(245, 158, 11, 0.1)'
                      : 'rgba(255, 255, 255, 0.04)',
                    border: `1px solid ${showQR ? 'rgba(245, 158, 11, 0.25)' : 'var(--border-subtle)'}`,
                    color: 'var(--text-primary)',
                  }}
                >
                  <span className="flex items-center gap-2">
                    <QrCode className="size-4" style={{ color: '#F59E0B' }} />
                    QR Code
                  </span>
                  <motion.span
                    animate={{ rotate: showQR ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                    style={{ color: 'var(--text-muted)' }}
                  >
                    <svg
                      className="size-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </motion.span>
                </button>

                <AnimatePresence>
                  {showQR && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: 'easeOut' }}
                      className="overflow-hidden"
                    >
                      <div
                        className="mt-2 rounded-xl p-4 flex flex-col items-center gap-3"
                        style={{
                          background: 'rgba(245, 158, 11, 0.04)',
                          border: '1px solid rgba(245, 158, 11, 0.1)',
                        }}
                      >
                        {qrDataUrl ? (
                          <>
                            <div
                              className="rounded-lg p-2"
                              style={{
                                background: '#0B0F17',
                                boxShadow: '0 0 20px rgba(245, 158, 11, 0.1)',
                              }}
                            >
                              <img
                                src={qrDataUrl}
                                alt="QR Code"
                                width={160}
                                height={160}
                                className="rounded"
                              />
                            </div>
                            <p
                              className="text-[10px] text-center max-w-[200px]"
                              style={{ color: 'var(--text-muted)' }}
                            >
                              Scan to open this page on another device
                            </p>
                            <button
                              onClick={handleDownloadQR}
                              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors duration-200"
                              style={{
                                background: 'rgba(245, 158, 11, 0.1)',
                                color: '#F59E0B',
                                border: '1px solid rgba(245, 158, 11, 0.2)',
                              }}
                            >
                              <Download className="size-3.5" />
                              Download QR
                            </button>
                          </>
                        ) : (
                          <div
                            className="w-40 h-40 rounded-lg flex items-center justify-center"
                            style={{ background: '#0B0F17' }}
                          >
                            <QrCode
                              className="size-8 animate-pulse"
                              style={{ color: 'rgba(245, 158, 11, 0.3)' }}
                            />
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>

              {/* ─── Share buttons grid ───────────────────────────────── */}
              <motion.div
                variants={itemVariants}
                className="grid grid-cols-2 gap-2"
              >
                {SHARE_PLATFORMS.map((platform) => (
                  <motion.button
                    key={platform.key}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handlePlatformShare(platform)}
                    className="flex items-center gap-2.5 rounded-xl px-4 py-3 text-sm font-medium transition-colors duration-200"
                    style={{
                      background: 'rgba(255, 255, 255, 0.04)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-primary)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = platform.hoverBg
                      e.currentTarget.style.borderColor = platform.color + '40'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)'
                      e.currentTarget.style.borderColor = 'var(--border-subtle)'
                    }}
                  >
                    <span style={{ color: platform.color }}>{platform.icon}</span>
                    {platform.label}
                    <ExternalLink className="size-3 ml-auto opacity-40" />
                  </motion.button>
                ))}
              </motion.div>

              {/* ─── Copy link row ────────────────────────────────────── */}
              <motion.div variants={itemVariants}>
                <div
                  className="flex items-center gap-2 rounded-xl px-3 py-2"
                  style={{
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <input
                    type="text"
                    readOnly
                    value={shareUrl}
                    className="flex-1 bg-transparent text-xs outline-none truncate"
                    style={{ color: 'var(--text-muted)' }}
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                  />
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleCopyLink}
                    className="shrink-0 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors duration-200 relative"
                    style={{
                      background: copied
                        ? 'rgba(34, 197, 94, 0.15)'
                        : 'linear-gradient(135deg, #F59E0B, #D97706)',
                      color: copied ? '#22C55E' : '#0B0F17',
                      border: copied ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid transparent',
                    }}
                  >
                    {copyAnimating && (
                      <motion.div
                        className="absolute inset-0 rounded-lg"
                        initial={{ scale: 1, opacity: 0.5 }}
                        animate={{ scale: 1.5, opacity: 0 }}
                        transition={{ duration: 0.6 }}
                        style={{
                          background: 'rgba(245, 158, 11, 0.3)',
                        }}
                      />
                    )}
                    {copied ? (
                      <>
                        <Check className="size-3.5" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Link2 className="size-3.5" />
                        Copy
                      </>
                    )}
                  </motion.button>
                </div>
              </motion.div>

              {/* ─── Native share (mobile) ────────────────────────────── */}
              {typeof navigator !== 'undefined' && 'share' in navigator && (
                <motion.div variants={itemVariants}>
                  <motion.button
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={handleNativeShare}
                    className="w-full flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium transition-colors duration-200"
                    style={{
                      background: 'rgba(255, 255, 255, 0.06)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    <Share2 className="size-4" style={{ color: '#F59E0B' }} />
                    More sharing options…
                  </motion.button>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  )
}
