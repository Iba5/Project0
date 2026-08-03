'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * Reusable empty state component with a gold-bordered circular icon,
 * title, description, and optional action button.
 *
 * Usage:
 *   <EmptyState
 *     icon={SearchX}
 *     title="No contestants found"
 *     description="Try adjusting your filters or search query."
 *     actionLabel="Clear filters"
 *     onAction={() => clearFilters()}
 *   />
 */
export interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  actionLabel?: string
  onAction?: () => void
  /** Optional secondary action */
  secondaryLabel?: string
  onSecondary?: () => void
  className?: string
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondary,
  className,
}: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className={`flex flex-col items-center justify-center py-16 px-6 text-center ${className ?? ''}`}
    >
      {/* Gold-bordered circular icon */}
      <motion.div
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.05, ease: 'easeOut' }}
        className="relative mb-5"
      >
        <div
          className="absolute -inset-3 rounded-full blur-2xl pointer-events-none"
          style={{ background: 'rgba(245, 158, 11, 0.10)' }}
        />
        <div
          className="relative w-20 h-20 rounded-full flex items-center justify-center"
          style={{
            background: 'rgba(245, 158, 11, 0.06)',
            border: '1.5px solid rgba(245, 158, 11, 0.35)',
            boxShadow: '0 0 24px rgba(245, 158, 11, 0.10), inset 0 0 12px rgba(245, 158, 11, 0.04)',
          }}
        >
          <Icon
            className="size-9"
            style={{ color: '#F59E0B' }}
            strokeWidth={1.5}
          />
        </div>
      </motion.div>

      {/* Title */}
      <h3
        className="text-lg font-semibold mb-1.5"
        style={{ color: 'var(--text-primary)' }}
      >
        {title}
      </h3>

      {/* Description */}
      {description && (
        <p
          className="text-sm max-w-sm leading-relaxed mb-6"
          style={{ color: 'var(--text-muted)' }}
        >
          {description}
        </p>
      )}

      {/* Actions */}
      {(actionLabel || secondaryLabel) && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          {actionLabel && onAction && (
            <Button
              onClick={onAction}
              className="rounded-full gap-2 font-semibold button-press"
              style={{
                background: 'linear-gradient(135deg, #F59E0B, #D97706)',
                color: '#0B0F17',
              }}
            >
              {actionLabel}
            </Button>
          )}
          {secondaryLabel && onSecondary && (
            <Button
              onClick={onSecondary}
              variant="outline"
              className="rounded-full gap-2 button-press"
              style={{
                color: 'var(--text-muted)',
                borderColor: 'var(--border-subtle)',
              }}
            >
              {secondaryLabel}
            </Button>
          )}
        </div>
      )}
    </motion.div>
  )
}
