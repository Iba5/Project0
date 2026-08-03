'use client'

import { useState, useRef, useCallback } from 'react'
import { nameToGradient } from '@/lib/utils'

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'full'

const sizeMap: Record<AvatarSize, string> = {
  xs: 'w-8 h-8',
  sm: 'w-10 h-10',
  md: 'w-14 h-14',
  lg: 'w-20 h-20',
  xl: 'w-28 h-28',
  full: 'w-full h-full',
}

const textSizeMap: Record<AvatarSize, string> = {
  xs: 'text-xs',
  sm: 'text-sm',
  md: 'text-xl',
  lg: 'text-3xl',
  xl: 'text-4xl',
  full: 'text-6xl',
}

/**
 * ParticipantAvatar — Progressive image loading component.
 *
 * - If `thumbnailUrl` exists, shows a tiny preview immediately (blur-up)
 * - If `imageUrl` exists, lazily loads the full-quality portrait
 * - Falls back to gradient + initial letter if no image
 *
 * The "full" image is only loaded when the user interacts (hover/click)
 * or when `eager` is true (e.g. detail view).
 */
export function ParticipantAvatar({
  name,
  imageUrl,
  thumbnailUrl,
  size = 'md',
  eager = false,
  className = '',
  style,
  onClick,
}: {
  name: string
  imageUrl?: string | null
  thumbnailUrl?: string | null
  size?: AvatarSize
  eager?: boolean
  className?: string
  style?: React.CSSProperties
  onClick?: () => void
}) {
  const [showFull, setShowFull] = useState(eager)
  const [fullLoaded, setFullLoaded] = useState(false)
  const [thumbLoaded, setThumbLoaded] = useState(false)
  const [fullError, setFullError] = useState(false)
  const [thumbError, setThumbError] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const handleHover = useCallback(() => {
    if (!showFull && imageUrl) {
      setShowFull(true)
    }
  }, [showFull, imageUrl])

  const hasImage = (imageUrl || thumbnailUrl) && !fullError
  const hasThumb = thumbnailUrl && !thumbError

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden ${sizeMap[size]} ${className}`}
      onMouseEnter={handleHover}
      onClick={onClick}
      style={style || (onClick ? { cursor: 'pointer' } : undefined)}
    >
      {/* Gradient fallback — always rendered as base layer */}
      <div
        className={`absolute inset-0 bg-gradient-to-br ${nameToGradient(
          name || '?'
        )} flex items-center justify-center`}
      >
        <span
          className={`${textSizeMap[size]} font-black text-white/30 drop-shadow-lg select-none`}
        >
          {name?.charAt(0) || '?'}
        </span>
      </div>

      {/* Thumbnail preview — low quality, loads immediately */}
      {hasThumb && !fullLoaded && (
        <img
          src={thumbnailUrl!}
          alt=""
          className="absolute inset-0 w-full h-full object-cover blur-sm scale-105 transition-opacity duration-300"
          style={{ opacity: thumbLoaded ? 1 : 0 }}
          onLoad={() => setThumbLoaded(true)}
          onError={() => setThumbError(true)}
          loading="eager"
          decoding="async"
        />
      )}

      {/* Full quality portrait — loads on demand (hover/click/eager) */}
      {showFull && imageUrl && !fullError && (
        <img
          src={imageUrl}
          alt={name}
          className="absolute inset-0 w-full h-full object-cover transition-opacity duration-500"
          style={{ opacity: fullLoaded ? 1 : 0 }}
          onLoad={() => setFullLoaded(true)}
          onError={() => setFullError(true)}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
        />
      )}

      {/* Subtle inner gradient overlay for depth */}
      {hasImage && (
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent pointer-events-none" />
      )}
    </div>
  )
}
