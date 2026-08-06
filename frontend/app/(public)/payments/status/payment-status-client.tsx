'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { CheckCircle2, XCircle, Clock, AlertCircle, ArrowLeft, Trophy, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { checkPaymentStatus, type PaymentStatusData } from '@/lib/api'
import { toast } from 'sonner'

export default function PaymentStatusClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const reference = searchParams.get('reference')
  
  const [statusData, setStatusData] = useState<PaymentStatusData | null>(null)
  const [loading, setLoading] = useState(true)
  const [polling, setPolling] = useState(false)

  useEffect(() => {
    if (!reference) {
      toast.error('No payment reference provided')
      router.push('/contestants')
      return
    }

    fetchStatus()
  }, [reference])

  useEffect(() => {
    if (!statusData || (statusData.status !== 'pending' && statusData.status !== 'created')) {
      return
    }

    // Poll every 3 seconds for pending payments
    const interval = setInterval(() => {
      fetchStatus()
    }, 3000)

    return () => clearInterval(interval)
  }, [statusData])

  const fetchStatus = async () => {
    if (!reference) return

    try {
      setPolling(true)
      const data = await checkPaymentStatus(reference) as PaymentStatusData
      setStatusData(data)
    } catch (error) {
      console.error('Failed to fetch payment status:', error)
      toast.error('Failed to fetch payment status')
    } finally {
      setLoading(false)
      setPolling(false)
    }
  }

  const handleRefresh = () => {
    fetchStatus()
  }

  const handleReturnToContestant = () => {
    if (statusData?.contestant_id) {
      router.push(`/contestants/${statusData.contestant_id}`)
    } else {
      router.push('/contestants')
    }
  }

  const handleGoToLeaderboard = () => {
    router.push('/leaderboard')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center"
        >
          <RefreshCw className="size-12 text-amber-500 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading payment status...</p>
        </motion.div>
      </div>
    )
  }

  if (!statusData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center max-w-md"
        >
          <AlertCircle className="size-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Payment Not Found</h2>
          <p className="text-muted-foreground mb-6">
            Unable to find payment with reference: {reference}
          </p>
          <Button onClick={() => router.push('/contestants')}>
            Return to Contestants
          </Button>
        </motion.div>
      </div>
    )
  }

  const renderStatusIcon = () => {
    switch (statusData.status) {
      case 'paid':
        return <CheckCircle2 className="size-16 text-green-500" />
      case 'failed':
        return <XCircle className="size-16 text-red-500" />
      case 'cancelled':
        return <XCircle className="size-16 text-orange-500" />
      case 'pending':
      case 'created':
        return <Clock className="size-16 text-amber-500 animate-pulse" />
      default:
        return <AlertCircle className="size-16 text-gray-500" />
    }
  }

  const renderStatusTitle = () => {
    switch (statusData.status) {
      case 'paid':
        return 'Payment Successful!'
      case 'failed':
        return 'Payment Failed'
      case 'cancelled':
        return 'Payment Cancelled'
      case 'pending':
      case 'created':
        return 'Payment Pending'
      default:
        return 'Payment Status Unknown'
    }
  }

  const renderStatusMessage = () => {
    switch (statusData.status) {
      case 'paid':
        return 'Your payment has been successfully processed and votes have been credited.'
      case 'failed':
        return 'Your payment could not be processed. Please try again or contact support.'
      case 'cancelled':
        return 'You cancelled the payment. No charges were made.'
      case 'pending':
      case 'created':
        return 'Your payment is being processed. This page will update automatically.'
      default:
        return 'Please check your payment status later.'
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          {/* Status Icon */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15 }}
            className="flex justify-center mb-6"
          >
            {renderStatusIcon()}
          </motion.div>

          {/* Status Title */}
          <motion.h1
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-3xl font-bold mb-3"
          >
            {renderStatusTitle()}
          </motion.h1>

          {/* Status Message */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-muted-foreground mb-8"
          >
            {renderStatusMessage()}
          </motion.p>

          {/* Payment Details */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="rounded-xl p-6 mb-6"
            style={{
              background: 'var(--surface-1)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                <span className="text-muted-foreground">Reference</span>
                <span className="font-mono text-sm">{statusData.reference}</span>
              </div>
              
              {statusData.contestant_name && (
                <div className="flex justify-between items-center py-2 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                  <span className="text-muted-foreground">Contestant</span>
                  <span className="font-medium">{statusData.contestant_name}</span>
                </div>
              )}
              
              {statusData.amount && (
                <div className="flex justify-between items-center py-2 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                  <span className="text-muted-foreground">Amount Paid</span>
                  <span className="font-bold text-lg" style={{ color: '#F59E0B' }}>
                    ${statusData.amount}
                  </span>
                </div>
              )}
              
              {statusData.votes_awarded !== undefined && statusData.votes_awarded > 0 && (
                <div className="flex justify-between items-center py-2 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                  <span className="text-muted-foreground">Votes Awarded</span>
                  <span className="font-bold text-lg flex items-center gap-2" style={{ color: '#F59E0B' }}>
                    <Trophy className="size-5" />
                    {statusData.votes_awarded}
                  </span>
                </div>
              )}
              
              {statusData.current_total_votes !== undefined && (
                <div className="flex justify-between items-center py-2">
                  <span className="text-muted-foreground">Current Total Votes</span>
                  <span className="font-bold text-lg" style={{ color: '#F59E0B' }}>
                    {statusData.current_total_votes.toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          </motion.div>

          {/* Refresh Button (for pending payments) */}
          {(statusData.status === 'pending' || statusData.status === 'created') && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="mb-6"
            >
              <Button
                onClick={handleRefresh}
                disabled={polling}
                variant="outline"
                className="w-full"
              >
                <RefreshCw className={`size-4 mr-2 ${polling ? 'animate-spin' : ''}`} />
                Refresh Status
              </Button>
            </motion.div>
          )}

          {/* Navigation Buttons */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="flex flex-col sm:flex-row gap-3 justify-center"
          >
            <Button
              onClick={handleReturnToContestant}
              variant="outline"
              className="flex-1"
            >
              <ArrowLeft className="size-4 mr-2" />
              Return to Contestant
            </Button>
            <Button
              onClick={handleGoToLeaderboard}
              className="flex-1"
              style={{
                background: 'linear-gradient(135deg, #F59E0B, #D97706)',
                color: '#0B0F17',
              }}
            >
              <Trophy className="size-4 mr-2" />
              View Leaderboard
            </Button>
          </motion.div>
        </motion.div>
      </div>
    </div>
  )
}
