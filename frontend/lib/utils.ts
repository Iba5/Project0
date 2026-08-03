import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Deterministic gradient from a name string.
 * Used for avatar backgrounds when no portrait photo is available.
 */
export function nameToGradient(name: string): string {
  const gradients = [
    'from-rose-500/30 to-orange-500/30',
    'from-amber-500/30 to-yellow-500/30',
    'from-emerald-500/30 to-teal-500/30',
    'from-purple-500/30 to-pink-500/30',
    'from-cyan-500/30 to-sky-500/30',
    'from-fuchsia-500/30 to-rose-500/30',
  ]
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return gradients[Math.abs(hash) % gradients.length]
}

/**
 * Deterministic solid gradient (no transparency) for avatar backgrounds.
 */
export function nameToSolidGradient(name: string): string {
  const gradients = [
    'from-rose-500 to-orange-500',
    'from-amber-500 to-yellow-500',
    'from-emerald-500 to-teal-500',
    'from-purple-500 to-pink-500',
    'from-cyan-500 to-sky-500',
    'from-fuchsia-500 to-rose-500',
  ]
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return gradients[Math.abs(hash) % gradients.length]
}
