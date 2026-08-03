'use client'

import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { PieChart as PieChartIcon } from 'lucide-react'
import type { VotesByCategoryPoint } from '@/lib/api'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

// ─── Color palette for categories ─────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  Singing: '#F59E0B',
  Dancing: '#FB923C',
  Comedy: '#F472B6',
  Acting: '#34D399',
  Poetry: '#60A5FA',
  'Spoken Word': '#A78BFA',
  Instrumental: '#22D3EE',
  Other: '#64748B',
}

const FALLBACK_COLORS = [
  '#F59E0B',
  '#FB923C',
  '#F472B6',
  '#34D399',
  '#60A5FA',
  '#A78BFA',
  '#22D3EE',
  '#FB7185',
  '#4ADE80',
  '#64748B',
]

function getCategoryColor(category: string, index: number): string {
  return CATEGORY_COLORS[category] || FALLBACK_COLORS[index % FALLBACK_COLORS.length]
}

// ─── Types ────────────────────────────────────────────────────────

interface CategoryDonutChartProps {
  data: VotesByCategoryPoint[]
  accent?: string
}

// ─── Component ────────────────────────────────────────────────────

export function CategoryDonutChart({ data, accent = '#F59E0B' }: CategoryDonutChartProps) {
  const totalVotes = useMemo(() => {
    return data.reduce((sum, d) => sum + d.votes, 0)
  }, [data])

  const segments = useMemo(() => {
    if (data.length === 0 || totalVotes === 0) return []
    let cumulativePercent = 0
    return data.map((d, index) => {
      const percent = (d.votes / totalVotes) * 100
      const startPercent = cumulativePercent
      cumulativePercent += percent
      const color = getCategoryColor(d.category, index)
      return {
        category: d.category,
        votes: d.votes,
        percent,
        startPercent,
        color,
      }
    })
  }, [data, totalVotes])

  // Build conic-gradient string
  const conicGradient = useMemo(() => {
    if (segments.length === 0) return 'conic-gradient(var(--surface-3) 0% 100%)'
    const stops = segments.map((s) => {
      return `${s.color} ${s.startPercent}% ${s.startPercent + s.percent}%`
    })
    return `conic-gradient(${stops.join(', ')})`
  }, [segments])

  return (
    <Card
      className="rounded-xl border hover-lift h-full"
      style={{
        background: 'var(--surface-1)',
        borderColor: 'var(--border-subtle)',
      }}
    >
      <CardHeader className="pb-3 p-4 md:p-6">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="w-1 h-5 rounded-full shrink-0"
            style={{ background: accent }}
          />
          <PieChartIcon
            className="w-4 h-4 shrink-0"
            style={{ color: accent }}
          />
          <h3
            className="text-sm font-semibold truncate"
            style={{ color: 'var(--text-primary)' }}
          >
            Category Distribution
          </h3>
        </div>
        <p
          className="text-xs -mt-1"
          style={{ color: 'var(--text-muted)' }}
        >
          Vote distribution by category
        </p>
      </CardHeader>
      <CardContent className="p-4 md:p-6 pt-0">
        {segments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <PieChartIcon
              className="w-8 h-8 mb-2"
              style={{ color: 'var(--text-muted)' }}
            />
            <p
              className="text-sm text-center"
              style={{ color: 'var(--text-muted)' }}
            >
              No vote data available
            </p>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row items-center gap-6">
            {/* Donut chart */}
            <motion.div
              className="relative shrink-0"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            >
              <div
                className="w-40 h-40 rounded-full relative"
                style={{ background: conicGradient }}
              >
                {/* Inner circle (donut hole) */}
                <div
                  className="absolute inset-[28%] rounded-full flex items-center justify-center"
                  style={{ background: 'var(--surface-1)' }}
                >
                  <div className="text-center">
                    <p
                      className="text-lg font-bold"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {totalVotes.toLocaleString()}
                    </p>
                    <p
                      className="text-[10px] uppercase tracking-wide"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      Total Votes
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Legend */}
            <div className="flex-1 space-y-2 min-w-0 w-full sm:w-auto">
              {segments.map((segment, index) => (
                <motion.div
                  key={segment.category}
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{
                    duration: 0.3,
                    delay: 0.2 + index * 0.05,
                  }}
                  className="flex items-center gap-3 group"
                >
                  <span
                    className="w-3 h-3 rounded-sm shrink-0"
                    style={{ background: segment.color }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className="text-xs font-medium truncate"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {segment.category}
                      </span>
                      <span
                        className="text-xs font-semibold tabular-nums shrink-0"
                        style={{ color: segment.color }}
                      >
                        {segment.percent.toFixed(1)}%
                      </span>
                    </div>
                    <div
                      className="h-1 rounded-full overflow-hidden mt-1"
                      style={{ background: 'var(--surface-3)' }}
                    >
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${segment.percent}%` }}
                        transition={{
                          duration: 0.6,
                          delay: 0.3 + index * 0.05,
                          ease: 'easeOut',
                        }}
                        className="h-full rounded-full"
                        style={{ background: segment.color }}
                      />
                    </div>
                  </div>
                  <span
                    className="text-[10px] tabular-nums shrink-0"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {segment.votes.toLocaleString()}
                  </span>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
