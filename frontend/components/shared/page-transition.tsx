'use client'

import { motion, type Variants } from 'framer-motion'
import { type ReactNode } from 'react'

export type TransitionVariant = 'fadeIn' | 'slideIn' | 'slideUp' | 'scaleIn'

const variants: Record<TransitionVariant, Variants> = {
  fadeIn: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  },
  slideIn: {
    initial: { opacity: 0, x: 24 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -24 },
  },
  slideUp: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
  },
  scaleIn: {
    initial: { opacity: 0, scale: 0.96 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.96 },
  },
}

interface PageTransitionProps {
  children: ReactNode
  variant?: TransitionVariant
  duration?: number
  delay?: number
  className?: string
}

export function PageTransition({
  children,
  variant = 'slideUp',
  duration = 0.35,
  delay = 0,
  className,
}: PageTransitionProps) {
  const selected = variants[variant]

  return (
    <motion.div
      initial={selected.initial as any}
      animate={selected.animate as any}
      exit={selected.exit as any}
      transition={{
        duration,
        delay,
        ease: [0.22, 1, 0.36, 1],
      }}
      className={className}
    >
      {children}
    </motion.div>
  )
}
