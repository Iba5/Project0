'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  CreditCard,
  Smartphone,
  Globe,
  CheckCircle2,
  Loader2,
  Shield,
  Lock,
  Vote,
  Star,
  Sparkles,
  Share2,
  Users,
  Calculator,
  DollarSign,
  ChevronRight,
  Check,
  Ticket,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAppStore } from '@/lib/store'
import { useRouter } from 'next/navigation'
import {
  getPublicParticipant,
  initiatePayment,
  getPaymentMethods,
  paymentMethods as fallbackPaymentMethods,
  type PaymentMethod,
} from '@/lib/api'
import { apiFetch } from '@/lib/api-client'
import { toast } from 'sonner'

// ─── Step definitions ─────────────────────────────────────────────
const STEPS = [
  { id: 1, label: 'Contestant', icon: Star },
  { id: 2, label: 'Amount', icon: DollarSign },
  { id: 3, label: 'Payment', icon: CreditCard },
  { id: 4, label: 'Confirm', icon: CheckCircle2 },
]



// Vote calculator: votes = amount / vote_price (rounded down) - UX ONLY
function calculateVotes(amount: number, votePrice: number | undefined): number {
  if (!votePrice || votePrice <= 0) return 0
  return Math.floor(amount / votePrice)
}

// ─── Step indicator component ─────────────────────────────────────
function StepIndicator({
  currentStep,
  completedSteps,
}: {
  currentStep: number
  completedSteps: number[]
}) {
  return (
    <div className="flex items-center justify-between gap-1 mb-6">
      {STEPS.map((step, index) => {
        const isCompleted = completedSteps.includes(step.id)
        const isCurrent = currentStep === step.id
        const Icon = step.icon

        return (
          <div key={step.id} className="flex items-center gap-1 flex-1">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300 relative"
                style={{
                  background: isCompleted
                    ? 'linear-gradient(135deg, #22C55E, #16A34A)'
                    : isCurrent
                      ? 'linear-gradient(135deg, #F59E0B, #D97706)'
                      : 'var(--surface-2)',
                  boxShadow: isCurrent
                    ? '0 0 16px rgba(245,158,11,0.3)'
                    : isCompleted
                      ? '0 0 16px rgba(34,197,94,0.2)'
                      : 'none',
                  color: isCompleted || isCurrent ? '#0B0F17' : 'var(--text-muted)',
                }}
              >
                {isCompleted ? (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 300 }}
                  >
                    <Check className="size-4" />
                  </motion.div>
                ) : (
                  <Icon className="size-4" />
                )}
              </div>
              <span
                className="text-[10px] font-medium whitespace-nowrap"
                style={{
                  color: isCurrent
                    ? '#F59E0B'
                    : isCompleted
                      ? '#22C55E'
                      : 'var(--text-muted)',
                }}
              >
                {step.label}
              </span>
            </div>
            {index < STEPS.length - 1 && (
              <div
                className="flex-1 h-[2px] mt-[-18px] rounded-full transition-colors duration-300"
                style={{
                  background: isCompleted
                    ? 'linear-gradient(90deg, #22C55E, rgba(34,197,94,0.3))'
                    : 'var(--border-subtle)',
                }}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Confetti animation ───────────────────────────────────────────
function ConfettiParticles() {
  const particles = Array.from({ length: 40 }, (_, i) => ({
    id: i,
    x: Math.random() * 400 - 200,
    y: Math.random() * -300 - 50,
    size: Math.random() * 10 + 4,
    delay: Math.random() * 0.4,
    color: ['#F59E0B', '#FBBF24', '#D97706', '#22C55E', '#3B82F6', '#EC4899', '#FCD34D'][
      Math.floor(Math.random() * 7)
    ],
    rotation: Math.random() * 720 - 360,
    shape: Math.random() > 0.5 ? 'circle' : 'rect',
  }))

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute"
          style={{
            left: '50%',
            top: '50%',
            width: p.size,
            height: p.shape === 'rect' ? p.size * 0.6 : p.size,
            background: p.color,
            borderRadius: p.shape === 'circle' ? '50%' : '2px',
          }}
          initial={{ x: 0, y: 0, opacity: 1, scale: 1, rotate: 0 }}
          animate={{
            x: p.x,
            y: p.y,
            opacity: [1, 1, 0],
            scale: [0, 1, 0.5],
            rotate: p.rotation,
          }}
          transition={{
            duration: 2,
            delay: p.delay,
            ease: 'easeOut',
          }}
        />
      ))}
    </div>
  )
}

// ─── Recent Supporters ────────────────────────────────────────────
function RecentSupporters({ participantId }: { participantId: string | null }) {
  const [supporters, setSupporters] = useState<Array<{ name: string; amount: number; date: string }>>([])

  useEffect(() => {
    if (!participantId) return
    // Fetch recent supporters from the vote-history endpoint
    async function fetchSupporters() {
      try {
        const data = await apiFetch<{ history: Array<{ voterName: string | null; amount: number; date: string }> }>(`/participants/${participantId}/vote-history?limit=5`)
        const mapped = (data.history || []).map((h) => ({
          name: h.voterName || 'Anonymous',
          amount: h.amount,
          date: h.date,
        }))
        setSupporters(mapped)
      } catch {
        // Silently ignore — this is a nice-to-have feature
      }
    }
    fetchSupporters()
  }, [participantId])

  if (supporters.length === 0) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="glass rounded-xl p-4"
    >
      <div className="flex items-center gap-2 mb-3">
        <Users className="size-4" style={{ color: '#F59E0B' }} />
        <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
          Recent Supporters
        </span>
      </div>
      <div className="space-y-2 max-h-40 overflow-y-auto">
        {supporters.map((s, i) => (
          <div
            key={i}
            className="flex items-center justify-between text-xs"
            style={{ color: 'var(--text-muted)' }}
          >
            <div className="flex items-center gap-2">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold"
                style={{
                  background: 'var(--surface-2)',
                  color: 'var(--text-primary)',
                }}
              >
                {s.name.charAt(0).toUpperCase()}
              </div>
              <span className="truncate max-w-[120px]">{s.name}</span>
            </div>
            <span className="font-medium" style={{ color: '#F59E0B' }}>
              ${s.amount.toFixed(2)}
            </span>
          </div>
        ))}
      </div>
    </motion.div>
  )
}

// ─── Vote Calculator ──────────────────────────────────────────────
function VoteCalculator({ amount, votePrice }: { amount: number; votePrice: number | undefined }) {
  const votes = calculateVotes(amount, votePrice)
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="glass rounded-xl p-4"
    >
      <div className="flex items-center gap-2 mb-2">
        <Calculator className="size-4" style={{ color: '#F59E0B' }} />
        <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
          Estimated Votes
        </span>
      </div>
      <div className="flex items-center justify-between">
        <div>
          <span className="text-2xl font-bold" style={{ color: '#F59E0B' }}>
            {votes}
          </span>
          <span className="text-sm ml-1" style={{ color: 'var(--text-muted)' }}>
            vote{votes !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="text-right">
          {votePrice && (
            <>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                ${votePrice.toFixed(2)} = 1 vote
              </div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Total: ${amount.toFixed(2)}
              </div>
            </>
          )}
        </div>
      </div>
      {/* Visual vote bar */}
      <div className="mt-3 h-2 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
        <motion.div
          className="h-full rounded-full"
          style={{
            background: 'linear-gradient(90deg, #F59E0B, #D97706)',
          }}
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(100, (votes / 50) * 100)}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>0</span>
        <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>50 votes</span>
      </div>
    </motion.div>
  )
}

// ─── Fade transition for step content ─────────────────────────────
const stepTransition = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 },
  transition: { duration: 0.3 },
}

// ─── Main Payment View ────────────────────────────────────────────
export default function PaymentView({ participantId }: { participantId: string }) {
  const router = useRouter()
  const paymentParticipantId = participantId

  const [participantName, setParticipantName] = useState<string>('')
  const [participantCategory, setParticipantCategory] = useState<string>('')
  const [paymentConfig, setPaymentConfig] = useState<{
    votePrice: number
    minimumPayment: number
    currency: string
    votingOpen: boolean
  } | null>(null)
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>(fallbackPaymentMethods)
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null)
  const [phone, setPhone] = useState('')
  const [voterName, setVoterName] = useState('')
  const [voterEmail, setVoterEmail] = useState('')
  const [processing, setProcessing] = useState(false)
  const [paymentInitiated, setPaymentInitiated] = useState(false)

  // Step management
  const [currentStep, setCurrentStep] = useState(1)
  const [completedSteps, setCompletedSteps] = useState<number[]>([])

  // Amount selection
  const [customAmount, setCustomAmount] = useState<string>('')

  // Input validation
  const [emailError, setEmailError] = useState<string | null>(null)
  const [phoneError, setPhoneError] = useState<string | null>(null)
  // Idempotency key — generated once per payment session and reused on retries
  const [idempotencyKey] = useState(() => crypto.randomUUID())

  // No voter auth required — voter info fields are optional for receipt purposes

  // Load participant data and payment configuration from participant's event
  useEffect(() => {
    async function loadParticipant() {
      if (!paymentParticipantId) return
      try {
        const data = await getPublicParticipant(paymentParticipantId)
        setParticipantName(data.name)
        setParticipantCategory(data.category)

        // Load payment configuration from participant's event data
        if (data.paymentConfiguration) {
          setPaymentConfig({
            votePrice: data.paymentConfiguration.votePrice,
            minimumPayment: data.paymentConfiguration.minimumPayment,
            currency: data.paymentConfiguration.currency,
            votingOpen: data.paymentConfiguration.votingOpen,
          })

          // Check if voting is open
          if (!data.paymentConfiguration.votingOpen) {
            toast.error('Voting is currently closed for this event')
          }
        }
      } catch {
        setParticipantName('Contestant')
      }
    }
    loadParticipant()
  }, [paymentParticipantId])

  // Fetch enabled payment methods from API
  useEffect(() => {
    async function fetchPaymentMethods() {
      try {
        const methods = await getPaymentMethods()
        setPaymentMethods(methods)
      } catch (error) {
        console.error('Failed to fetch payment methods, using fallback', error)
        // Fallback to hardcoded methods is already set in state
      }
    }
    fetchPaymentMethods()
  }, [])

  // Grouped payment methods
  const groupedMethods = paymentMethods.reduce(
    (acc, method) => {
      if (!acc[method.methodType]) acc[method.methodType] = []
      acc[method.methodType].push(method)
      return acc
    },
    {} as Record<string, PaymentMethod[]>
  )

  const typeIcons: Record<string, React.ReactNode> = {
    mobile: <Smartphone className="size-4" />,
    web: <CreditCard className="size-4" />,
    offline: <Ticket className="size-4" />,
  }

  const typeLabels: Record<string, string> = {
    mobile: 'Mobile Money',
    web: 'Card Payment',
    offline: 'Offline/Voucher',
  }

  // Validate email
  const validateEmail = useCallback((email: string) => {
    if (!email.trim()) {
      setEmailError('Email is required')
      return false
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setEmailError('Please enter a valid email')
      return false
    }
    setEmailError(null)
    return true
  }, [])

  // Validate phone
  const validatePhone = useCallback((phone: string) => {
    if (!phone.trim()) {
      setPhoneError('Phone number is required')
      return false
    }
    const cleaned = phone.replace(/[\s+]/g, '')
    if (!/^\d{8,15}$/.test(cleaned)) {
      setPhoneError('Invalid phone number format. Must be between 8 and 15 digits.')
      return false
    }
    setPhoneError(null)
    return true
  }, [])

  // Get the effective amount
  const effectiveAmount = parseFloat(customAmount) || 0

  // Step navigation
  const goToStep = (step: number) => {
    if (step > currentStep) {
      setCompletedSteps((prev) => [...new Set([...prev, currentStep])])
    }
    setCurrentStep(step)
  }

  const canProceedToStep2 = paymentParticipantId !== null
  const canProceedToStep3 = paymentConfig !== null && effectiveAmount >= paymentConfig.minimumPayment && paymentConfig.votingOpen
  const canProceedToStep4 = selectedMethod !== null && phone.trim() !== '' && !phoneError

  const handleNextStep = () => {
    if (currentStep === 1 && canProceedToStep2) {
      goToStep(2)
    } else if (currentStep === 2 && canProceedToStep3) {
      goToStep(3)
    } else if (currentStep === 3 && canProceedToStep4) {
      goToStep(4)
    }
  }

  const handlePrevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  // Handle payment submission
  const handleSubmit = async () => {
    if (!selectedMethod || !paymentParticipantId) return

    // Validate inputs
    if (!validatePhone(phone)) return
    if (voterEmail && !validateEmail(voterEmail)) return

    setProcessing(true)
    try {
      const result = await initiatePayment({
        amount: effectiveAmount,
        paymentMethod: selectedMethod.method,
        contestantId: paymentParticipantId,
        voterPhone: phone,
        voterName: voterName || undefined,
        voterEmail: voterEmail || undefined,
        idempotencyKey: idempotencyKey,
      })

      if (result.payment.paynowRedirectUrl) {
        window.open(result.payment.paynowRedirectUrl, '_blank')
      }

      setPaymentInitiated(true)
      setCompletedSteps([1, 2, 3, 4])

      toast.success('Payment initiated successfully!', {
        description: `Complete payment in the Paynow window. You'll be redirected here after payment. Reference: ${result.payment.reference}`,
      })
    } catch (err) {
      toast.error('Payment failed', {
        description: err instanceof Error ? err.message : 'Please try again',
      })
    } finally {
      setProcessing(false)
    }
  }

  // Handle share
  const handleShare = async () => {
    const text = `I just supported ${participantName} on Vibe Hub! 🌟 Cast your vote too!`
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Vibe Hub', text, url: window.location.href })
      } catch {}
    } else {
      await navigator.clipboard.writeText(text + ' ' + window.location.href)
      toast.success('Link copied to clipboard!')
    }
  }

  // ─── Payment Initiated View ─────────────────────────────────────────────
  if (paymentInitiated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative text-center max-w-md"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.2 }}
            className="w-24 h-24 rounded-full mx-auto mb-6 flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, rgba(245,158,11,0.2), rgba(217,119,6,0.05))',
              boxShadow: '0 0 30px rgba(245,158,11,0.2)',
            }}
          >
            <motion.div
              initial={{ scale: 0, rotate: -45 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.4, type: 'spring', stiffness: 200 }}
            >
              <Loader2 className="size-12 text-amber-500 animate-spin" />
            </motion.div>
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="text-2xl font-bold mb-2"
          >
            Payment Initiated
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="text-muted-foreground mb-1"
          >
            Complete your payment in the Paynow window.
          </motion.p>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="text-sm text-muted-foreground mb-6"
          >
            Your votes will be credited after successful payment.
          </motion.p>
          {participantName && (
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              className="text-gold-400 font-medium mb-6"
            >
              Supporting {participantName}
            </motion.p>
          )}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9 }}
            className="flex flex-col sm:flex-row gap-3 justify-center"
          >
            <Button
              onClick={() => {
                if (paymentParticipantId) {
                  router.push(`/contestants/${paymentParticipantId}`)
                } else {
                  router.push('/contestants')
                }
              }}
              className="rounded-full h-12 font-semibold"
              style={{
                background: 'linear-gradient(135deg, #F59E0B, #D97706)',
                color: '#0B0F17',
              }}
            >
              Return to Contestant
            </Button>
            <Button
              onClick={() => router.push('/contestants')}
              variant="outline"
              className="rounded-full border-border text-muted-foreground hover:bg-accent"
            >
              View All Contestants
            </Button>
          </motion.div>
        </motion.div>
      </div>
    )
  }

  // ─── Main Payment Flow ─────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 glass-strong border-b border-border">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (currentStep > 1) {
                handlePrevStep()
              } else if (paymentParticipantId) {
                router.push(`/contestants/${paymentParticipantId}`)
              } else {
                router.push('/contestants')
              }
            }}
            className="text-muted-foreground hover:text-foreground hover:bg-accent rounded-full gap-2"
          >
            <ArrowLeft className="size-4" />
            {currentStep > 1 ? 'Back' : 'Back'}
          </Button>
          <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
            Step {currentStep} of 4
          </span>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-lg mx-auto px-4 py-6">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          {/* Step Indicator */}
          <StepIndicator currentStep={currentStep} completedSteps={completedSteps} />

          {/* Step Content */}
          <AnimatePresence mode="wait">
            {/* ─── Step 1: Select Contestant ──────────────── */}
            {currentStep === 1 && (
              <motion.div key="step-1" {...stepTransition} className="space-y-4">
                <div>
                  <h1 className="text-2xl font-bold mb-1">Support a Contestant</h1>
                  <p className="text-sm text-muted-foreground">
                    Confirm the contestant you want to support
                  </p>
                </div>

                {/* Contestant card */}
                <div className="glass-premium rounded-2xl overflow-hidden">
                  <div
                    className="h-20 flex items-end px-4 pb-3"
                    style={{
                      background: 'linear-gradient(135deg, rgba(245,158,11,0.2), rgba(217,119,6,0.1))',
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold border-2 border-background"
                        style={{
                          background: 'linear-gradient(135deg, #F59E0B, #D97706)',
                          color: '#0B0F17',
                        }}
                      >
                        {participantName ? participantName.charAt(0) : '?'}
                      </div>
                      <div>
                        <div className="font-semibold text-sm">{participantName || 'Contestant'}</div>
                        {participantCategory && (
                          <div className="text-xs text-muted-foreground flex items-center gap-1">
                            <Star className="size-3 text-gold-500" />
                            {participantCategory}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="px-4 py-3">
                    <p className="text-xs text-muted-foreground">
                      You&apos;re about to support this contestant. Each vote helps them climb the leaderboard!
                    </p>
                  </div>
                </div>

                {/* Recent Supporters — removed per user request (no "who voted for who") */}

                {/* Continue button */}
                <Button
                  onClick={handleNextStep}
                  disabled={!canProceedToStep2}
                  className="w-full rounded-full h-12 font-semibold"
                  style={{
                    background: 'linear-gradient(135deg, #F59E0B, #D97706)',
                    color: '#0B0F17',
                  }}
                >
                  Continue
                  <ChevronRight className="size-4 ml-1" />
                </Button>
              </motion.div>
            )}

            {/* ─── Step 2: Choose Amount ──────────────────── */}
            {currentStep === 2 && (
              <motion.div key="step-2" {...stepTransition} className="space-y-4">
                <div>
                  <h1 className="text-2xl font-bold mb-1">Choose Amount</h1>
                  <p className="text-sm text-muted-foreground">
                    Enter how much you want to contribute
                  </p>
                </div>

                {/* Currency Input */}
                <div className="glass rounded-xl p-4">
                  <Label htmlFor="amount" className="text-sm font-medium mb-2 block">
                    Amount to Contribute
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg font-bold" style={{ color: '#F59E0B' }}>
                      {paymentConfig?.currency || '$'}
                    </span>
                    <Input
                      id="amount"
                      type="number"
                      min={paymentConfig?.minimumPayment || 0}
                      step="0.01"
                      placeholder="0.00"
                      value={customAmount}
                      onChange={(e) => setCustomAmount(e.target.value)}
                      className="pl-8 text-lg font-bold h-12 rounded-xl"
                      style={{
                        background: 'var(--surface-1)',
                        borderColor: 'var(--border-subtle)',
                        color: 'var(--text-primary)',
                      }}
                    />
                  </div>
                  {paymentConfig && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Minimum payment: {paymentConfig.currency}{paymentConfig.minimumPayment.toFixed(2)}
                    </p>
                  )}
                  {paymentConfig && customAmount && parseFloat(customAmount) < paymentConfig.minimumPayment && (
                    <p className="text-xs text-red-400 mt-1">Amount must be at least {paymentConfig.currency}{paymentConfig.minimumPayment.toFixed(2)}</p>
                  )}
                </div>

                {/* Vote Calculator */}
                {paymentConfig && effectiveAmount >= paymentConfig.minimumPayment && (
                  <VoteCalculator amount={effectiveAmount} votePrice={paymentConfig.votePrice} />
                )}

                {/* Continue button */}
                <Button
                  onClick={handleNextStep}
                  disabled={!canProceedToStep3}
                  className="w-full rounded-full h-12 font-semibold"
                  style={{
                    background: 'linear-gradient(135deg, #F59E0B, #D97706)',
                    color: '#0B0F17',
                  }}
                >
                  Continue — ${effectiveAmount.toFixed(2)}
                  <ChevronRight className="size-4 ml-1" />
                </Button>
              </motion.div>
            )}

            {/* ─── Step 3: Payment Method ─────────────────── */}
            {currentStep === 3 && (
              <motion.div key="step-3" {...stepTransition} className="space-y-4">
                <div>
                  <h1 className="text-2xl font-bold mb-1">Payment Method</h1>
                  <p className="text-sm text-muted-foreground">
                    Choose how you want to pay ${effectiveAmount.toFixed(2)}
                  </p>
                </div>

                {/* Payment method selection */}
                <div className="space-y-4">
                  {Object.entries(groupedMethods).map(([type, methods]) => (
                    <div key={type}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-muted-foreground">{typeIcons[type]}</span>
                        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                          {typeLabels[type]}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {methods.map((method) => {
                          const isSelected = selectedMethod?.id === method.id
                          return (
                            <motion.button
                              key={method.id}
                              onClick={() => setSelectedMethod(method)}
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              className={`relative rounded-xl p-3 text-left transition-all duration-200 ${
                                isSelected ? 'glass-premium' : 'glass'
                              }`}
                              style={{
                                border: isSelected
                                  ? '2px solid rgba(245,158,11,0.5)'
                                  : '1px solid var(--border-subtle)',
                                boxShadow: isSelected
                                  ? '0 0 16px rgba(245,158,11,0.15)'
                                  : 'none',
                              }}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="text-lg">{method.iconName === 'smartphone' ? '📱' : method.iconName === 'credit-card' ? '💳' : '🎫'}</span>
                                  <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                                    {method.displayName}
                                  </span>
                                </div>
                                {isSelected && (
                                  <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    transition={{ type: 'spring', stiffness: 300 }}
                                  >
                                    <CheckCircle2 className="size-4 text-gold-500" />
                                  </motion.div>
                                )}
                              </div>
                              <div className="mt-2 flex items-center gap-2">
                                <div
                                  className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center transition-colors ${
                                    isSelected ? 'border-gold-500' : 'border-border'
                                  }`}
                                >
                                  {isSelected && (
                                    <motion.div
                                      initial={{ scale: 0 }}
                                      animate={{ scale: 1 }}
                                      className="w-2 h-2 rounded-full bg-gold-500"
                                    />
                                  )}
                                </div>
                                <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                                  {type === 'mobile_money' ? 'Instant' : type === 'card' ? 'Secure' : 'Fast'}
                                </span>
                              </div>
                            </motion.button>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Continue button */}
                <Button
                  onClick={handleNextStep}
                  disabled={!canProceedToStep4}
                  className="w-full rounded-full h-12 font-semibold"
                  style={{
                    background: 'linear-gradient(135deg, #F59E0B, #D97706)',
                    color: '#0B0F17',
                  }}
                >
                  Continue
                  <ChevronRight className="size-4 ml-1" />
                </Button>
              </motion.div>
            )}

            {/* ─── Step 4: Confirm & Pay ──────────────────── */}
            {currentStep === 4 && (
              <motion.div key="step-4" {...stepTransition} className="space-y-4">
                <div>
                  <h1 className="text-2xl font-bold mb-1">Confirm Payment</h1>
                  <p className="text-sm text-muted-foreground">
                    Review your details and complete payment
                  </p>
                </div>

                {/* Order summary card */}
                <div className="glass-premium rounded-2xl overflow-hidden">
                  <div
                    className="px-4 py-3"
                    style={{
                      background: 'linear-gradient(135deg, rgba(245,158,11,0.1), rgba(217,119,6,0.05))',
                      borderBottom: '1px solid var(--border-subtle)',
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
                        style={{
                          background: 'linear-gradient(135deg, #F59E0B, #D97706)',
                          color: '#0B0F17',
                        }}
                      >
                        {participantName ? participantName.charAt(0) : '?'}
                      </div>
                      <div>
                        <div className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                          {participantName || 'Contestant'}
                        </div>
                        {participantCategory && (
                          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            {participantCategory}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="px-4 py-3 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span style={{ color: 'var(--text-muted)' }}>Amount</span>
                      <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                        ${effectiveAmount.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span style={{ color: 'var(--text-muted)' }}>Votes</span>
                      <span className="font-medium" style={{ color: '#F59E0B' }}>
                        {paymentConfig ? calculateVotes(effectiveAmount, paymentConfig.votePrice) : 0} vote{paymentConfig && calculateVotes(effectiveAmount, paymentConfig.votePrice) !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span style={{ color: 'var(--text-muted)' }}>Payment Method</span>
                      <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                        {selectedMethod?.displayName || '—'}
                      </span>
                    </div>
                    <div
                      className="pt-2 flex justify-between text-sm font-bold"
                      style={{ borderTop: '1px solid var(--border-subtle)' }}
                    >
                      <span style={{ color: 'var(--text-primary)' }}>Total</span>
                      <span style={{ color: '#F59E0B' }}>${effectiveAmount.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* Voter Details (optional — for receipt purposes) */}
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="voterEmail" className="text-sm font-medium mb-1.5 block">
                      Email{' '}
                      <span className="text-muted-foreground/60">(optional)</span>
                    </Label>
                    <Input
                      id="voterEmail"
                      type="email"
                      placeholder="you@example.com"
                      value={voterEmail}
                      onChange={(e) => {
                        setVoterEmail(e.target.value)
                        if (emailError) validateEmail(e.target.value)
                      }}
                      onBlur={() => {
                        if (voterEmail) validateEmail(voterEmail)
                      }}
                      className="bg-surface border-border rounded-xl placeholder:text-muted-foreground/50"
                      style={{
                        borderColor: emailError ? '#EF4444' : undefined,
                      }}
                    />
                    {emailError && (
                      <p className="text-xs text-red-400 mt-1">{emailError}</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="voterName" className="text-sm font-medium mb-1.5 block">
                      Your Name{' '}
                      <span className="text-muted-foreground/60">(optional)</span>
                    </Label>
                    <Input
                      id="voterName"
                      placeholder="Enter your name"
                      value={voterName}
                      onChange={(e) => setVoterName(e.target.value)}
                      className="bg-surface border-border rounded-xl placeholder:text-muted-foreground/50"
                    />
                  </div>

                  <div>
                    <Label htmlFor="phone" className="text-sm font-medium mb-1.5 block">
                      Phone Number <span className="text-red-400">*</span>
                    </Label>
                    <Input
                      id="phone"
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
                      className="bg-surface border-border rounded-xl placeholder:text-muted-foreground/50"
                      style={{
                        borderColor: phoneError ? '#EF4444' : undefined,
                      }}
                    />
                    {phoneError && (
                      <p className="text-xs text-red-400 mt-1">{phoneError}</p>
                    )}
                    <p className="text-xs text-muted-foreground/60 mt-1">
                      Enter your phone number for payment verification
                    </p>
                  </div>
                </div>

                {/* Security Badge */}
                <div className="glass rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-gold-500/10 flex items-center justify-center shrink-0">
                      <Shield className="size-5 text-gold-500" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold mb-1">Secure Payment</h4>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Your payment is protected with 256-bit encryption. We use trusted payment providers
                        and never store your full card details.
                      </p>
                      <div className="flex items-center gap-3 mt-2">
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <Lock className="size-3" />
                          SSL Encrypted
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <Shield className="size-3" />
                          PCI Compliant
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Submit Button */}
                <div className="relative group">
                  <div className="absolute -inset-1 bg-gradient-to-r from-gold-500 via-gold-400 to-gold-600 rounded-full blur-md opacity-50 group-hover:opacity-100 transition-opacity duration-500" />
                  <Button
                    onClick={handleSubmit}
                    disabled={processing}
                    className="relative w-full bg-gold-500 hover:bg-gold-600 text-[#0B0F17] font-semibold rounded-full h-14 text-lg disabled:opacity-50 disabled:cursor-not-allowed focus-ring-gold"
                  >
                    {processing ? (
                      <>
                        <Loader2 className="size-5 animate-spin mr-2" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Sparkles className="size-5 mr-2" />
                        Complete Payment — ${effectiveAmount.toFixed(2)}
                      </>
                    )}
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </main>

    </div>
  )
}
