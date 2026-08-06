'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Loader2, Sparkles, Zap, CheckCircle2, DollarSign } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { initiatePayment, paymentMethods, type PaymentMethod } from '@/lib/api'
import { toast } from 'sonner'

interface QuickVoteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  participant: {
    id: string
    name: string
    category: string
    paymentConfiguration?: {
      votePrice: number
      minimumPayment: number
      currency: string
      votingOpen: boolean
    }
  } | null
  onVoted?: () => void
}

export function QuickVoteDialog({
  open,
  onOpenChange,
  participant,
  onVoted,
}: QuickVoteDialogProps) {
  // No voter auth required — anyone can vote
  const [amount, setAmount] = useState<string>('')
  const [method, setMethod] = useState<PaymentMethod | null>(null)
  const [phone, setPhone] = useState('')
  const [processing, setProcessing] = useState(false)
  const [paymentInitiated, setPaymentInitiated] = useState(false)
  const [phoneError, setPhoneError] = useState<string | null>(null)
  // Idempotency key — generated once per dialog open and reused on retries
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID())

  // Reset internal state whenever the dialog is (re)opened.
  useEffect(() => {
    if (open) {
      setAmount('')
      setMethod(null)
      setPhone('')
      setProcessing(false)
      setPaymentInitiated(false)
      setPhoneError(null)
      // Generate a new idempotency key for each new dialog session
      setIdempotencyKey(crypto.randomUUID())
    }
  }, [open])

  // Default-select the first mobile money method for convenience.
  useEffect(() => {
    if (!method && paymentMethods.length > 0) {
      setMethod(paymentMethods[0])
    }
  }, [method])

  const effectiveAmount = parseFloat(amount) || 0

  // Get payment configuration from participant
  const paymentConfig = participant?.paymentConfiguration

  // Calculate estimated votes for UX display only using backend configuration
  const estimatedVotes = useMemo(
    () => {
      if (!paymentConfig || !paymentConfig.votePrice || effectiveAmount <= 0) return 0
      return Math.floor(effectiveAmount / paymentConfig.votePrice)
    },
    [effectiveAmount, paymentConfig?.votePrice],
  )

  const validatePhone = (phone: string) => {
    if (!phone.trim()) {
      setPhoneError('Phone number is required')
      return false
    }
    const cleaned = phone.replace(/[\s+]/g, '')
    if (!/^\d{8,15}$/.test(cleaned)) {
      setPhoneError('Invalid phone number format')
      return false
    }
    setPhoneError(null)
    return true
  }

  const handleConfirm = async () => {
    if (!participant || !method) return
    if (!validatePhone(phone)) return
    if (!paymentConfig) {
      toast.error('Payment configuration not available', {
        description: 'Please try again later',
      })
      return
    }
    if (effectiveAmount < paymentConfig.minimumPayment) {
      toast.error('Invalid amount', {
        description: `Please enter an amount of at least ${paymentConfig.currency}${paymentConfig.minimumPayment.toFixed(2)}`,
      })
      return
    }
    setProcessing(true)
    try {
      const result = await initiatePayment({
        amount: effectiveAmount,
        paymentMethod: method.method,
        contestantId: participant.id,
        voterPhone: phone,
        idempotencyKey: idempotencyKey,
      })
      setPaymentInitiated(true)
      toast.success(`Payment initiated for ${participant.name}!`, {
        description: `Complete payment in the Paynow window. Reference: ${result.payment.reference}`,
      })
      setTimeout(() => {
        onOpenChange(false)
        onVoted?.()
      }, 1100)
    } catch (err) {
      toast.error('Quick Vote failed', {
        description: err instanceof Error ? err.message : 'Please try again',
      })
    } finally {
      setProcessing(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="glass-premium gradient-gold-border max-w-md mx-4 rounded-2xl border border-border"
        style={{
          background: 'var(--surface-elevated)',
        }}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
        >
          <DialogHeader>
            <DialogTitle
              className="flex items-center gap-2 text-xl"
              style={{ color: 'var(--text-primary)' }}
            >
              <DollarSign className="size-5 text-amber-500" />
              Quick Vote
            </DialogTitle>
            <DialogDescription style={{ color: 'var(--text-muted)' }}>
              {participant
                ? `Support ${participant.name} — ${participant.category}.`
                : 'Support your favorite contestant.'}
            </DialogDescription>
          </DialogHeader>

          {paymentInitiated ? (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="py-8 flex flex-col items-center text-center"
            >
              <Loader2 className="size-12 text-amber-500 animate-spin mb-3" />
              <div
                className="text-lg font-semibold"
                style={{ color: 'var(--text-primary)' }}
              >
                Payment Initiated
              </div>
              <p
                className="text-sm mt-1"
                style={{ color: 'var(--text-muted)' }}
              >
                Complete payment in the Paynow window.
              </p>
              <p
                className="text-xs mt-2"
                style={{ color: 'var(--text-muted)' }}
              >
                Votes will be credited after successful payment.
              </p>
            </motion.div>
          ) : (
            <div className="space-y-5 mt-2">
              {/* Amount input */}
              <div>
                <div
                  className="text-xs uppercase tracking-wider font-semibold mb-2"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Amount to contribute
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg font-bold" style={{ color: '#F59E0B' }}>
                    {paymentConfig?.currency || '$'}
                  </span>
                  <input
                    type="number"
                    min={paymentConfig?.minimumPayment || 0}
                    step="0.01"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full pl-8 pr-4 py-3 rounded-xl text-lg font-bold"
                    style={{
                      background: 'var(--surface-1)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-primary)',
                    }}
                  />
                </div>
                {effectiveAmount > 0 && (
                  <div className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
                    Estimated votes: <span className="font-bold" style={{ color: '#F59E0B' }}>{estimatedVotes}</span>
                  </div>
                )}
                {paymentConfig && (
                  <div className="text-xs text-muted-foreground mt-1">
                    Minimum payment: {paymentConfig.currency}{paymentConfig.minimumPayment.toFixed(2)}
                  </div>
                )}
              </div>

              {/* Payment method selector */}
              <div>
                <div
                  className="text-xs uppercase tracking-wider font-semibold mb-2"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Payment method
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {paymentMethods.slice(0, 6).map((m) => {
                    const selected = method?.id === m.id
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setMethod(m)}
                        className={`rounded-xl px-3 py-2.5 text-left text-sm transition-all duration-200 hover-lift border ${
                          selected
                            ? 'bg-gold-500/15 border-gold-500/40'
                            : 'bg-surface border-border hover:border-border/60'
                        }`}
                        style={{ color: 'var(--text-primary)' }}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-base">{m.iconName || '💳'}</span>
                          <span className="font-medium truncate">{m.displayName}</span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Phone number input */}
              <div>
                <div
                  className="text-xs uppercase tracking-wider font-semibold mb-2"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Phone number
                </div>
                <input
                  type="tel"
                  placeholder="+263 7XX XXX XXX"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value)
                    if (phoneError) validatePhone(e.target.value)
                  }}
                  onBlur={() => {
                    if (phone) validatePhone(phone)
                  }}
                  className="w-full px-4 py-3 rounded-xl"
                  style={{
                    background: 'var(--surface-1)',
                    border: phoneError ? '1px solid #EF4444' : '1px solid var(--border-subtle)',
                    color: 'var(--text-primary)',
                  }}
                />
                {phoneError && (
                  <p className="text-xs text-red-400 mt-1">{phoneError}</p>
                )}
              </div>

              {/* Total + CTA */}
              <div
                className="rounded-xl p-3 flex items-center justify-between"
                style={{ background: 'var(--surface-1)' }}
              >
                <span
                  className="text-sm"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Total
                </span>
                <span
                  className="text-2xl font-bold text-gold-400"
                  style={{ color: '#F59E0B' }}
                >
                  ${effectiveAmount.toFixed(2)}
                </span>
              </div>

              <Button
                type="button"
                onClick={handleConfirm}
                disabled={!method || processing || !participant || !paymentConfig || effectiveAmount < paymentConfig.minimumPayment || !phone.trim()}
                className="w-full h-12 px-8 text-base font-semibold rounded-full text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 hover-lift disabled:opacity-50 disabled:cursor-not-allowed disabled:hover-lift-none"
              >
                {processing ? (
                  <>
                    <Loader2 className="size-4 animate-spin mr-2" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Sparkles className="size-4 mr-2" />
                    Pay {paymentConfig?.currency || '$'}{effectiveAmount.toFixed(2)}
                  </>
                )}
              </Button>


            </div>
          )}
        </motion.div>
      </DialogContent>
    </Dialog>
  )
}
