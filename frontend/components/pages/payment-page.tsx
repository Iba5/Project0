'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowLeft, Lock, Loader2, Smartphone, CreditCard, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { useAppStore } from '@/lib/store'
import { paymentMethods } from '@/lib/mock-data'
import { toast } from 'sonner'
import type { ParticipantApi } from '@/lib/api'

const typeConfig = {
  mobile_money: {
    label: 'Mobile Money',
    icon: Smartphone,
  },
  card: {
    label: 'Card',
    icon: CreditCard,
  },
  digital_wallet: {
    label: 'Digital Wallet',
    icon: Wallet,
  },
} as const

type PaymentType = keyof typeof typeConfig

export function PaymentPageContent({ participant }: { participant: ParticipantApi }) {
  const { selectedPaymentMethod, setSelectedPaymentMethod, unlockVoting } =
    useAppStore()
  const [processing, setProcessing] = useState(false)

  const grouped = paymentMethods.reduce<Record<PaymentType, typeof paymentMethods>>(
    (acc, m) => {
      acc[m.type].push(m)
      return acc
    },
    { mobile_money: [], card: [], digital_wallet: [] }
  )

  const selectedMethodObj = paymentMethods.find((m) => m.id === selectedPaymentMethod)

  const handlePay = () => {
    if (!selectedPaymentMethod) return
    setProcessing(true)
    setTimeout(() => {
      setProcessing(false)
      unlockVoting()
      toast.success('Payment successful — voting unlocked!')
    }, 2000)
  }

  return (
    <div className="animate-fade-in">
      <div className="mx-auto max-w-lg px-4 py-8 sm:px-6 md:py-12">
        {/* Back button */}
        <Link
          href={`/contestants/${participant.id}`}
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="rounded-lg border border-border p-6"
        >
          <h1 className="text-2xl font-bold">Unlock Voting</h1>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
            Pay a one-time fee to unlock unlimited voting for the current round.
          </p>

          <div className="mt-5 mb-6">
            <p className="text-3xl font-extrabold">$1.00 <span className="text-base font-medium text-muted-foreground">USD</span></p>
          </div>

          <Separator className="mb-6" />

          {/* Payment method groups */}
          <div className="space-y-6">
            {(Object.keys(typeConfig) as PaymentType[]).map((type) => {
              const methods = grouped[type]
              if (methods.length === 0) return null
              const config = typeConfig[type]

              return (
                <div key={type}>
                  <div className="mb-2.5 flex items-center gap-2">
                    <config.icon className="size-3.5 text-muted-foreground" />
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {config.label}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {methods.map((method) => (
                      <button
                        key={method.id}
                        onClick={() => setSelectedPaymentMethod(method.id)}
                        className={`flex items-center gap-2.5 rounded-lg border p-3 text-left text-sm transition-all ${
                          selectedPaymentMethod === method.id
                            ? 'border-2 border-[#C8A24D] bg-muted'
                            : 'border-border text-foreground hover:bg-muted hover:text-foreground'
                        }`}
                      >
                        {/* Logo placeholder circle */}
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold uppercase text-muted-foreground">
                          {method.name.slice(0, 2)}
                        </span>
                        <span className="font-medium leading-tight truncate">
                          {method.name}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Pay button */}
          <div className="mt-8">
            <Button
              size="lg"
              onClick={handlePay}
              disabled={!selectedPaymentMethod || processing}
              className="w-full rounded-full"
            >
              {processing ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Processing…
                </>
              ) : selectedMethodObj ? (
                `Pay $1.00 with ${selectedMethodObj.name}`
              ) : (
                'Select a payment method'
              )}
            </Button>
          </div>

          {/* Security note */}
          <div className="mt-5 flex items-center gap-2 text-xs text-muted-foreground">
            <Lock className="size-3.5 shrink-0" />
            <span>
              Payments are processed securely via Paynow Zimbabwe
            </span>
          </div>
        </motion.div>
      </div>
    </div>
  )
}