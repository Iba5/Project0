'use client'

/**
 * Chart theme helper.
 *
 * Recharts SVG attributes (e.g. `tick={{ fill }}`, `stroke`, `axisLine`) do
 * NOT support CSS variables — they require concrete color strings. This hook
 * reads the theme-aware CSS variables from `:root` / `.dark` via
 * `getComputedStyle(document.documentElement)` and returns concrete hex/rgba
 * values that can be passed directly to recharts components.
 *
 * Implementation uses `useSyncExternalStore` so that:
 *  - SSR returns sensible defaults (no flash of unstyled charts)
 *  - The client re-reads values on theme toggle (via MutationObserver on
 *    `<html>` `class` attribute) and on window focus
 *  - No `setState` is called synchronously inside `useEffect` (avoids the
 *    `react-hooks/set-state-in-effect` lint rule)
 */

import { useSyncExternalStore } from 'react'

export interface ChartTheme {
  /** Tick / axis label color (maps to `--text-muted`). */
  tick: string
  /** Grid line color (maps to `--border-subtle`). */
  grid: string
  /** Cursor / hover fill (semi-transparent). */
  cursor: string
  /** Primary accent color (gold — `--primary` / `#F59E0B`). */
  accent: string
  /** Secondary accent — orange. */
  accent2: string
  /** Tertiary accent — pink. */
  accent3: string
  /** Quaternary accent — emerald. */
  accent4: string
  /** Quinary accent — blue. */
  accent5: string
  /** Senary accent — violet. */
  accent6: string
  /** Tooltip background (maps to `--surface-elevated`). */
  tooltipBg: string
  /** Tooltip border (maps to `--border-subtle`). */
  tooltipBorder: string
  /** Tooltip primary text (maps to `--text-primary`). */
  tooltipText: string
  /** Tooltip muted text (maps to `--text-muted`). */
  tooltipMuted: string
  /** Whether the theme values have been hydrated on the client. */
  ready: boolean
}

// Default palette used for SSR and before mount. These mirror the dark-theme
// CSS variables so the very first paint matches the previously-rendered
// dashboard (which used dark colors). After mount the hook re-reads the
// actual computed values and updates.
const DEFAULTS: ChartTheme = {
  tick: '#94A3B8',
  grid: 'rgba(255, 255, 255, 0.06)',
  cursor: 'rgba(255, 255, 255, 0.04)',
  accent: '#F59E0B',
  accent2: '#FB923C',
  accent3: '#F472B6',
  accent4: '#34D399',
  accent5: '#60A5FA',
  accent6: '#A78BFA',
  tooltipBg: '#1E293B',
  tooltipBorder: 'rgba(255, 255, 255, 0.08)',
  tooltipText: '#F8FAFC',
  tooltipMuted: '#94A3B8',
  ready: false,
}

// Distinct hex palette for multi-series charts (pie slices, multi-bar, etc.).
// These are intentionally NOT CSS variables because we want consistent
// distinct hues regardless of theme.
export const CHART_PALETTE: string[] = [
  '#F59E0B',
  '#FB923C',
  '#F472B6',
  '#34D399',
  '#60A5FA',
  '#A78BFA',
  '#FBBF24',
  '#22D3EE',
  '#FB7185',
  '#4ADE80',
]

function readThemeFromDOM(): ChartTheme {
  if (typeof window === 'undefined') return DEFAULTS
  const root = document.documentElement
  const styles = getComputedStyle(root)
  const get = (name: string, fallback: string) => {
    const v = styles.getPropertyValue(name).trim()
    return v || fallback
  }
  // The `--accent` var on .dark is `#1A2332` (panel) — we always want the
  // gold accent for charts, so prefer `--primary` (gold in both themes).
  const accent = get('--primary', '#F59E0B')
  const tick = get('--text-muted', '#94A3B8')
  const grid = get('--border-subtle', 'rgba(255, 255, 255, 0.06)')
  const tooltipBg = get('--surface-elevated', '#1E293B')
  const tooltipBorder = get('--border-subtle', 'rgba(255, 255, 255, 0.08)')
  const tooltipText = get('--text-primary', '#F8FAFC')
  // Build a faint cursor fill from the grid color (lower opacity).
  let cursor = 'rgba(127, 127, 127, 0.05)'
  const gridMatch = grid.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/)
  if (gridMatch) {
    cursor = `rgba(${gridMatch[1]}, ${gridMatch[2]}, ${gridMatch[3]}, 0.05)`
  }
  return {
    tick,
    grid,
    cursor,
    accent,
    accent2: '#FB923C',
    accent3: '#F472B6',
    accent4: '#34D399',
    accent5: '#60A5FA',
    accent6: '#A78BFA',
    tooltipBg,
    tooltipBorder,
    tooltipText,
    tooltipMuted: tick,
    ready: true,
  }
}

// ─── useSyncExternalStore plumbing ────────────────────────────────

// Module-level cache so `getSnapshot` returns a referentially-stable value
// between renders (required by `useSyncExternalStore` to avoid infinite
// re-renders). The cache key is derived from the `<html>` class attribute
// and the two most relevant CSS variable values — when the theme changes,
// the key changes, and we re-read + cache the new snapshot.
let cachedTheme: ChartTheme | null = null
let cachedKey: string | null = null

function computeKey(): string {
  if (typeof window === 'undefined') return 'ssr'
  const root = document.documentElement
  const styles = getComputedStyle(root)
  return (
    root.className +
    '|' +
    styles.getPropertyValue('--primary') +
    '|' +
    styles.getPropertyValue('--text-muted') +
    '|' +
    styles.getPropertyValue('--border-subtle') +
    '|' +
    styles.getPropertyValue('--surface-elevated') +
    '|' +
    styles.getPropertyValue('--text-primary')
  )
}

function subscribe(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  // Re-read whenever the `class` attribute on <html> changes (theme toggle).
  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === 'attributes' && m.attributeName === 'class') {
        callback()
        return
      }
    }
  })
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  })
  // Safety net — re-read on focus (handles external theme changes).
  window.addEventListener('focus', callback)
  return () => {
    observer.disconnect()
    window.removeEventListener('focus', callback)
  }
}

function getSnapshot(): ChartTheme {
  const key = computeKey()
  if (cachedTheme && key === cachedKey) return cachedTheme
  cachedTheme = readThemeFromDOM()
  cachedKey = key
  return cachedTheme
}

function getServerSnapshot(): ChartTheme {
  return DEFAULTS
}

/**
 * Hook returning theme-aware concrete colors for recharts. Re-reads on theme
 * toggle (via MutationObserver on `<html>` `class` attribute) and on window
 * focus as a safety net. SSR-safe (returns dark-theme defaults before
 * hydration).
 */
export function useChartTheme(): ChartTheme {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

/**
 * Curated 6-color palette (kept for backwards compat / convenience). Use
 * `CHART_PALETTE` for the full 10-color palette.
 */
export const CHART_SERIES_COLORS = CHART_PALETTE.slice(0, 6)
