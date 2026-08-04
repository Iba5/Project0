/**
 * Safe date formatting utilities for handling timezone-aware ISO strings from backend
 */

/**
 * Safely parse a date string from backend, handling timezone-aware ISO strings
 */
export function safeParseDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const d = new Date(value)
  return isNaN(d.getTime()) ? null : d
}

/**
 * Format a date string for display (date only)
 */
export function formatDate(value: string | null | undefined): string {
  const d = safeParseDate(value)
  if (!d) return "—"
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

/**
 * Format a date string for display (date and time)
 */
export function formatDateTime(value: string | null | undefined): string {
  const d = safeParseDate(value)
  if (!d) return "—"
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
}

/**
 * Format a date string for datetime-local input
 */
export function formatForInput(value: string | null | undefined): string {
  const d = safeParseDate(value)
  if (!d) return ''
  return d.toISOString().slice(0, 16)
}

/**
 * Format a date range
 */
export function formatDateRange(startISO: string, endISO: string): string {
  const start = safeParseDate(startISO)
  const end = safeParseDate(endISO)
  if (!start && !end) return 'Dates TBA'
  if (start && end) {
    if (start.getFullYear() === end.getFullYear()) {
      return `${start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} → ${end.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`
    }
    return `${start.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} → ${end.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`
  }
  if (start) return start.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  if (end) return `Until ${end.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`
  return 'Dates TBA'
}
