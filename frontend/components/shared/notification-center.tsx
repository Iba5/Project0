'use client'

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bell,
  Vote,
  Trophy,
  Calendar,
  AlertCircle,
  Star,
  Check,
  Trash2,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import {
  useNotificationStore,
  type Notification,
  type NotificationType,
} from '@/lib/notification-store'

// ─── Helpers ──────────────────────────────────────────────────────

function getRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (seconds < 60) return 'Just now'
  if (minutes < 60) return `${minutes} min ago`
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`
  return new Date(timestamp).toLocaleDateString()
}

function getNotificationIcon(type: NotificationType) {
  switch (type) {
    case 'vote_received':
      return <Vote className="w-4 h-4" />
    case 'milestone_reached':
      return <Trophy className="w-4 h-4" />
    case 'event_starting':
      return <Calendar className="w-4 h-4" />
    case 'event_closing':
      return <AlertCircle className="w-4 h-4" />
    case 'contestant_update':
      return <Star className="w-4 h-4" />
  }
}

function getNotificationColor(type: NotificationType): string {
  switch (type) {
    case 'vote_received':
      return '#22C55E' // green
    case 'milestone_reached':
      return '#F59E0B' // gold
    case 'event_starting':
      return '#3B82F6' // blue
    case 'event_closing':
      return '#EF4444' // red
    case 'contestant_update':
      return '#A855F7' // purple
  }
}

// ─── Notification Item ────────────────────────────────────────────

function NotificationItem({
  notification,
  onRead,
  onClick,
}: {
  notification: Notification
  onRead: (id: string) => void
  onClick: (notification: Notification) => void
}) {
  const color = getNotificationColor(notification.type)
  const icon = getNotificationIcon(notification.type)
  const relativeTime = getRelativeTime(notification.timestamp)

  return (
    <motion.button
      layout
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.25 }}
      onClick={() => {
        onRead(notification.id)
        if (notification.link) onClick(notification)
      }}
      className="w-full text-left p-3 rounded-lg transition-colors duration-200 group"
      style={{
        background: notification.read ? 'transparent' : 'rgba(245, 158, 11, 0.05)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'rgba(245, 158, 11, 0.08)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = notification.read
          ? 'transparent'
          : 'rgba(245, 158, 11, 0.05)'
      }}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div
          className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-0.5"
          style={{
            background: `${color}15`,
            border: `1px solid ${color}30`,
            color,
          }}
        >
          {icon}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="text-sm font-medium truncate"
              style={{ color: notification.read ? 'var(--text-muted)' : 'var(--text-primary)' }}
            >
              {notification.title}
            </span>
            {!notification.read && (
              <span
                className="shrink-0 w-2 h-2 rounded-full"
                style={{ background: '#F59E0B' }}
              />
            )}
          </div>
          <p className="text-xs mt-0.5 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            {notification.message}
          </p>
          <span className="text-[10px] mt-1 block" style={{ color: 'var(--text-muted)', opacity: 0.7 }}>
            {relativeTime}
          </span>
        </div>
      </div>
    </motion.button>
  )
}

// ─── Empty State ──────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div
        className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
        style={{
          background: 'rgba(245, 158, 11, 0.1)',
          border: '1px solid rgba(245, 158, 11, 0.2)',
        }}
      >
        <Bell className="w-7 h-7" style={{ color: '#F59E0B' }} />
      </div>
      <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
        No notifications yet
      </p>
      <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
        We&apos;ll notify you about votes, milestones, and events
      </p>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────

export function NotificationCenter() {
  const [open, setOpen] = useState(false)
  const { notifications, markAsRead, markAllAsRead, clearAll, getUnreadCount } =
    useNotificationStore()
  const unreadCount = getUnreadCount()

  const sortedNotifications = useMemo(
    () => [...notifications].sort((a, b) => b.timestamp - a.timestamp),
    [notifications],
  )

  const handleNotificationClick = (_notification: Notification) => {
    // Future: navigate to the linked view
    setOpen(false)
  }

  return (
    <>
      {/* Bell Trigger Button */}
      <button
        onClick={() => setOpen(true)}
        className="relative p-2 rounded-lg transition-colors duration-200"
        style={{ color: unreadCount > 0 ? '#F59E0B' : 'var(--text-muted)' }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(245, 158, 11, 0.1)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent'
        }}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-0.5 -right-0.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold leading-none"
            style={{
              background: '#F59E0B',
              color: '#0B0F17',
              boxShadow: '0 0 8px rgba(245, 158, 11, 0.5)',
            }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </motion.span>
        )}
      </button>

      {/* Sheet / Drawer */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-md border-l"
          style={{
            background: '#0B0F17',
            borderLeftColor: 'rgba(245, 158, 11, 0.15)',
          }}
        >
          <SheetHeader className="pb-0">
            <div className="flex items-center justify-between pr-6">
              <div>
                <SheetTitle
                  className="text-lg font-bold"
                  style={{ color: 'var(--text-primary)' }}
                >
                  Notifications
                </SheetTitle>
                <SheetDescription style={{ color: 'var(--text-muted)' }}>
                  {unreadCount > 0
                    ? `${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}`
                    : 'All caught up'}
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          {/* Action Buttons */}
          {notifications.length > 0 && (
            <div className="flex items-center gap-2 px-4 pt-2">
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={markAllAsRead}
                  className="text-xs h-8 gap-1.5"
                  style={{ color: '#F59E0B' }}
                >
                  <Check className="w-3.5 h-3.5" />
                  Mark all read
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAll}
                className="text-xs h-8 gap-1.5 ml-auto"
                style={{ color: 'var(--text-muted)' }}
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear all
              </Button>
            </div>
          )}

          <Separator className="mt-2" style={{ background: 'rgba(245, 158, 11, 0.1)' }} />

          {/* Notification List */}
          <ScrollArea className="flex-1 px-2">
            {notifications.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="py-2 space-y-1">
                <AnimatePresence mode="popLayout">
                  {sortedNotifications.map((notification) => (
                    <NotificationItem
                      key={notification.id}
                      notification={notification}
                      onRead={markAsRead}
                      onClick={handleNotificationClick}
                    />
                  ))}
                </AnimatePresence>
              </div>
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </>
  )
}
