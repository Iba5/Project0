'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Loader2, Sparkles, Zap, CheckCircle2 } from 'lucide-react'
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
  } | null
  onVoted?: () => void
}

const VOTE_OPTIONS = [1, 5, 10, 20] as const
const PRICE_PER_VOTE = 1.0

export function QuickVoteDialog({
  open,
  onOpenChange,
  participant,
  onVoted,
}: QuickVoteDialogProps) {
  // No voter auth required — anyone can vote
  const [voteCount, setVoteCount] = useState<number>(1)
  const [method, setMethod] = useState<PaymentMethod | null>(null)
  const [processing, setProcessing] = useState(false)
  const [success, setSuccess] = useState(false)
  // Idempotency key — generated once per dialog open and reused on retries
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID())

  // Reset internal state whenever the dialog is (re)opened.
  useEffect(() => {
    if (open) {
      setVoteCount(1)
      setMethod(null)
      setProcessing(false)
      setSuccess(false)
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

  const total = useMemo(
    () => (voteCount * PRICE_PER_VOTE).toFixed(2),
    [voteCount],
  )

  const handleConfirm = async () => {
    if (!participant || !method) return
    setProcessing(true)
    try {
      const result = await initiatePayment({
        amount: Number(total),
        paymentMethod: method.name,
        contestantId: participant.id,
        sourcePlatform: 'Web',
        idempotencyKey: idempotencyKey,
      })
      setSuccess(true)
      toast.success(`Cast ${voteCount} vote${voteCount > 1 ? 's' : ''} for ${participant.name}!`, {
        description: `Reference: ${result.payment.reference}`,
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
              <Zap className="size-5 text-amber-500" />
              Quick Vote
            </DialogTitle>
            <DialogDescription style={{ color: 'var(--text-muted)' }}>
              {participant
                ? `Cast your vote for ${participant.name} — ${participant.category}.`
                : 'Cast your vote instantly.'}
            </DialogDescription>
          </DialogHeader>

          {success ? (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="py-8 flex flex-col items-center text-center"
            >
              <CheckCircle2 className="size-12 text-green-500 mb-3" />
              <div
                className="text-lg font-semibold"
                style={{ color: 'var(--text-primary)' }}
              >
                {voteCount} vote{voteCount > 1 ? 's' : ''} cast!
              </div>
              <p
                className="text-sm mt-1"
                style={{ color: 'var(--text-muted)' }}
              >
                Thanks for supporting {participant?.name}.
              </p>
            </motion.div>
          ) : (
            <div className="space-y-5 mt-2">
              {/* Vote count selector — 4-button grid */}
              <div>
                <div
                  className="text-xs uppercase tracking-wider font-semibold mb-2"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Number of votes
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {VOTE_OPTIONS.map((n) => {
                    const selected = voteCount === n
                    return (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setVoteCount(n)}
                        className={`relative rounded-xl py-3 text-sm font-bold transition-all duration-200 hover-lift ${
                          selected
                            ? 'text-[#0B0F17]'
                            : 'bg-surface border border-border'
                        }`}
                        style={
                          selected
                            ? {
                                background:
                                  'linear-gradient(135deg, #F59E0B, #D97706)',
                                color: '#0B0F17',
                              }
                            : { color: 'var(--text-primary)' }
                        }
                      >
                        {n}
                      </button>
                    )
                  })}
                </div>
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
                          <span className="text-base">{m.icon}</span>
                          <span className="font-medium truncate">{m.name}</span>
                        </div>
                      </button>
                    )
                  })}
                </div>
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
                  Total ({voteCount} × ${PRICE_PER_VOTE.toFixed(2)})
                </span>
                <span
                  className="text-2xl font-bold text-gold-400"
                  style={{ color: '#F59E0B' }}
                >
                  ${total}
                </span>
              </div>

              <Button
                type="button"
                onClick={handleConfirm}
                disabled={!method || processing || !participant}
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
                    Pay ${total} · Cast {voteCount} Vote{voteCount > 1 ? 's' : ''}
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
