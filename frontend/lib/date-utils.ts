/**
 * Safe date formatting utilities for handling timezone-aware ISO strings from backend
 */

let platformTimezone: string = 'Africa/Harare' // Default fallback timezone

if (typeof window !== 'undefined') {
  try {
    const cached = localStorage.getItem('platform_timezone')
    if (cached) {
      platformTimezone = cached
    }
  } catch (e) {
    // Ignore localStorage access errors
  }
}

export function setPlatformTimezone(tz: string) {
  if (!tz) return
  platformTimezone = tz
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('platform_timezone', tz)
    } catch (e) {}
  }
}

export function getPlatformTimezone(): string {
  return platformTimezone
}

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
  try {
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      timeZone: platformTimezone,
    })
  } catch (e) {
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }
}

/**
 * Format a date string for display (date and time)
 */
export function formatDateTime(value: string | null | undefined): string {
  const d = safeParseDate(value)
  if (!d) return "—"
  try {
    return d.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: platformTimezone,
    })
  } catch (e) {
    return d.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    })
  }
}

/**
 * Format a date string for datetime-local input, preserving wall-clock time
 */
export function formatForInput(value: string | null | undefined): string {
  const d = safeParseDate(value)
  if (!d) return ''
  
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: platformTimezone,
    })
    
    const parts = formatter.formatToParts(d)
    const year = parts.find(p => p.type === 'year')?.value
    const month = parts.find(p => p.type === 'month')?.value
    const day = parts.find(p => p.type === 'day')?.value
    const hour = parts.find(p => p.type === 'hour')?.value
    const minute = parts.find(p => p.type === 'minute')?.value
    
    if (year && month && day && hour && minute) {
      let hh = hour
      if (hh === '24') hh = '00'
      return `${year}-${month}-${day}T${hh}:${minute}`
    }
  } catch (e) {}

  // Fallback to local system time format if formatting fails
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

/**
 * Parse a local wall-clock datetime string (YYYY-MM-DDTHH:mm) as if it were in the platform timezone,
 * and return the corresponding ISO string (UTC) to send to the backend.
 */
export function parseLocalInputToUTC(value: string | null | undefined): string | null {
  if (!value) return null
  
  try {
    if (value.includes('Z') || value.includes('+') || (value.includes('-') && value.split('-').length > 3)) {
      const parsed = safeParseDate(value)
      return parsed ? parsed.toISOString() : null
    }
    
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/)
    if (!match) {
      const parsed = safeParseDate(value)
      return parsed ? parsed.toISOString() : null
    }
    
    const [_, year, month, day, hour, minute] = match
    
    const dateUTC = new Date(Date.UTC(
      parseInt(year),
      parseInt(month) - 1,
      parseInt(day),
      parseInt(hour),
      parseInt(minute)
    ))
    
    const formatter = new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: platformTimezone,
    })
    
    const formattedParts = formatter.formatToParts(dateUTC)
    const fYear = parseInt(formattedParts.find(p => p.type === 'year')?.value || year)
    const fMonth = parseInt(formattedParts.find(p => p.type === 'month')?.value || month)
    const fDay = parseInt(formattedParts.find(p => p.type === 'day')?.value || day)
    let fHour = parseInt(formattedParts.find(p => p.type === 'hour')?.value || hour)
    if (fHour === 24) fHour = 0
    const fMinute = parseInt(formattedParts.find(p => p.type === 'minute')?.value || minute)
    
    const dateFormattedUTC = new Date(Date.UTC(fYear, fMonth - 1, fDay, fHour, fMinute))
    const diffMs = dateUTC.getTime() - dateFormattedUTC.getTime()
    const finalDate = new Date(dateUTC.getTime() + diffMs)
    return finalDate.toISOString()
  } catch (e) {
    const parsed = new Date(value)
    return isNaN(parsed.getTime()) ? null : parsed.toISOString()
  }
}

/**
 * Format a date range
 */
export function formatDateRange(startISO: string, endISO: string): string {
  const start = safeParseDate(startISO)
  const end = safeParseDate(endISO)
  if (!start && !end) return 'Dates TBA'
  
  const opt: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    timeZone: platformTimezone
  }
  const optYear: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: platformTimezone
  }
  
  if (start && end) {
    try {
      const startYear = start.toLocaleDateString(undefined, { year: 'numeric', timeZone: platformTimezone })
      const endYear = end.toLocaleDateString(undefined, { year: 'numeric', timeZone: platformTimezone })
      if (startYear === endYear) {
        return `${start.toLocaleDateString(undefined, opt)} → ${end.toLocaleDateString(undefined, optYear)}`
      }
      return `${start.toLocaleDateString(undefined, optYear)} → ${end.toLocaleDateString(undefined, optYear)}`
    } catch (e) {
      if (start.getFullYear() === end.getFullYear()) {
        return `${start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} → ${end.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`
      }
      return `${start.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} → ${end.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`
    }
  }
  
  if (start) {
    try {
      return start.toLocaleDateString(undefined, optYear)
    } catch (e) {
      return start.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    }
  }
  
  if (end) {
    try {
      return `Until ${end.toLocaleDateString(undefined, optYear)}`
    } catch (e) {
      return `Until ${end.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`
    }
  }
  
  return 'Dates TBA'
}

