'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  HardDrive,
  Upload,
  FileImage,
  Clock,
  AlertTriangle,
  CheckCircle,
  BarChart3,
  RefreshCw,
  TrendingUp,
  Database,
  Calendar,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { getR2Usage } from '@/lib/api'
import { toast } from 'sonner'

interface R2UsageData {
  storage: {
    total_size_bytes: number
    total_size_mb: number
    total_size_gb: number
    file_count: number
    file_types: Record<string, number>
    largest_files: Array<{
      key: string
      size: number
      last_modified: string
    }>
    free_tier_storage_mb: number
    free_tier_usage_percent: number
    last_updated: string
  }
  uploads: {
    period_days: number
    total_uploads: number
    daily_uploads: Record<string, number>
    recent_files: Array<{
      key: string
      size: number
      last_modified: string
    }>
    last_updated: string
  }
  summary: {
    total_size_gb: number
    file_count: number
    monthly_uploads: number
    free_tier_remaining_gb: number
    free_tier_usage_percent: number
    is_near_limit: boolean
  }
  last_updated: string
}

export function R2UsageDashboard() {
  const [usageData, setUsageData] = useState<R2UsageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchUsage = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await getR2Usage() as R2UsageData
      setUsageData(data)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch R2 usage'
      setError(errorMessage)
      toast.error('Failed to load R2 usage data', {
        description: errorMessage,
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsage()
  }, [])

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (loading) {
    return (
      <Card className="border border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            R2 Storage Usage
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="border border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            R2 Storage Usage
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <AlertTriangle className="w-12 h-12 text-amber-500 mb-3" />
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={fetchUsage} variant="outline" size="sm">
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!usageData) return null

  const { storage, uploads, summary } = usageData
  const isNearLimit = summary.is_near_limit
  const usageColor = isNearLimit ? 'text-amber-500' : 'text-emerald-500'
  const StatusIcon = isNearLimit ? AlertTriangle : CheckCircle

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">R2 Storage Dashboard</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Monitor your Cloudflare R2 storage usage and performance
          </p>
        </div>
        <Button onClick={fetchUsage} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Storage Usage */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="border border-border/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <HardDrive className="w-5 h-5 text-blue-500" />
                <Badge variant={isNearLimit ? 'destructive' : 'secondary'}>
                  {StatusIcon && <StatusIcon className="w-3 h-3 mr-1" />}
                  {isNearLimit ? 'Near Limit' : 'Healthy'}
                </Badge>
              </div>
              <div className="space-y-2">
                <p className="text-2xl font-bold">{summary.total_size_gb} GB</p>
                <p className="text-sm text-muted-foreground">Total Storage Used</p>
                <Progress 
                  value={summary.free_tier_usage_percent} 
                  className="h-2"
                />
                <p className="text-xs text-muted-foreground">
                  {summary.free_tier_usage_percent}% of 10GB free tier
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* File Count */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <Card className="border border-border/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <FileImage className="w-5 h-5 text-purple-500" />
                <Badge variant="secondary">
                  <TrendingUp className="w-3 h-3 mr-1" />
                  Active
                </Badge>
              </div>
              <div className="space-y-2">
                <p className="text-2xl font-bold">{summary.file_count}</p>
                <p className="text-sm text-muted-foreground">Total Files</p>
                <p className="text-xs text-muted-foreground">
                  Across all storage buckets
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Monthly Uploads */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
          <Card className="border border-border/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <Upload className="w-5 h-5 text-emerald-500" />
                <Badge variant="secondary">
                  <Calendar className="w-3 h-3 mr-1" />
                  30 Days
                </Badge>
              </div>
              <div className="space-y-2">
                <p className="text-2xl font-bold">{summary.monthly_uploads}</p>
                <p className="text-sm text-muted-foreground">Monthly Uploads</p>
                <p className="text-xs text-muted-foreground">
                  Files uploaded this month
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Remaining Storage */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.3 }}
        >
          <Card className="border border-border/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <Database className="w-5 h-5 text-amber-500" />
                <Badge variant="secondary">
                  <Clock className="w-3 h-3 mr-1" />
                  Available
                </Badge>
              </div>
              <div className="space-y-2">
                <p className="text-2xl font-bold">{summary.free_tier_remaining_gb} GB</p>
                <p className="text-sm text-muted-foreground">Free Tier Remaining</p>
                <p className="text-xs text-muted-foreground">
                  Of 10GB monthly allowance
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* File Types Distribution */}
      <Card className="border border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            File Types Distribution
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Object.entries(storage.file_types).length > 0 ? (
              Object.entries(storage.file_types).map(([type, count]) => {
                const percentage = (count / storage.file_count) * 100
                return (
                  <div key={type} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium uppercase">{type}</span>
                      <span className="text-muted-foreground">{count} files ({percentage.toFixed(1)}%)</span>
                    </div>
                    <Progress value={percentage} className="h-2" />
                  </div>
                )
              })
            ) : (
              <p className="text-muted-foreground text-center py-4">No files uploaded yet</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Recent Uploads */}
      <Card className="border border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Recent Uploads (Last 30 Days)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {uploads.recent_files.length > 0 ? (
            <div className="space-y-2">
              {uploads.recent_files.slice(0, 10).map((file, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2, delay: index * 0.05 }}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <FileImage className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{file.key}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(file.last_modified)}</p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="shrink-0">
                    {formatBytes(file.size)}
                  </Badge>
                </motion.div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-4">No recent uploads</p>
          )}
        </CardContent>
      </Card>

      {/* Last Updated */}
      <div className="text-center text-sm text-muted-foreground">
        Last updated: {formatDate(usageData.last_updated)}
      </div>
    </div>
  )
}