'use client'

import { Suspense, useMemo, useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  UserPlus,
  Sparkles,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { verifyInvitation, completeSignup } from '@/lib/api'
import { storeToken } from '@/lib/api-client'

type Step = 'verify' | 'complete' | 'success'

function AcceptInvitationContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [step, setStep] = useState<Step>('verify')
  const [loading, setLoading] = useState(false)

  // Token from URL
  const token = useMemo(() => searchParams?.get('token') || '', [searchParams])

  // Form state
  const [invitationData, setInvitationData] = useState<{
    email: string
    role: string
    valid: boolean
  } | null>(null)

  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  // ── Step 1: Verify Invitation ───────────────────────────────────
  const handleVerifyInvitation = async () => {
    if (!token.trim()) {
      toast.error('Invalid invitation link', { description: 'Missing or invalid token in URL.' })
      return
    }

    setLoading(true)
    try {
      const data = await verifyInvitation(token)

      if (data.valid) {
        setInvitationData({
          email: data.email,
          role: data.role,
          valid: true,
        })
        setStep('complete')
      } else {
        toast.error('Invalid invitation', { description: 'This invitation link is invalid or has expired.' })
      }
    } catch (err) {
      toast.error('Verification failed', {
        description: err instanceof Error ? err.message : 'Could not verify invitation.',
      })
    } finally {
      setLoading(false)
    }
  }

  // Auto-verify on mount if token present
  useEffect(() => {
    if (token.trim()) {
      handleVerifyInvitation()
    }
  }, [token])

  // ── Step 2: Complete Signup ───────────────────────────────────────
  const handleCompleteSignup = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim()) {
      toast.error('Name required', { description: 'Please enter your full name.' })
      return
    }
    if (password.length < 8) {
      toast.error('Password too short', { description: 'Password must be at least 8 characters.' })
      return
    }
    if (password !== confirmPassword) {
      toast.error('Passwords do not match', { description: 'Please make sure both passwords are identical.' })
      return
    }

    setLoading(true)
    try {
      const data = await completeSignup(token.trim(), name.trim(), password)

      // Store the token
      if (data.token) {
        storeToken(data.token)
      }

      setStep('success')
      toast.success('Account activated!', {
        description: 'Your admin account has been created successfully.',
      })
    } catch (err) {
      toast.error('Signup failed', {
        description: err instanceof Error ? err.message : 'Could not complete signup.',
      })
    } finally {
      setLoading(false)
    }
  }

  // ── Card wrapper style ───────────────────────────────────────
  const cardStyle = {
    background: 'rgba(18, 24, 36, 0.8)',
    backdropFilter: 'blur(20px)',
    borderColor: 'rgba(245, 158, 11, 0.1)',
    boxShadow: '0 4px 24px rgba(0, 0, 0, 0.3)',
  }

  const inputStyle = {
    background: 'var(--surface-3)',
    color: 'var(--text-primary)',
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative" style={{ background: '#0B0F17' }}>
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full opacity-5"
          style={{
            background: 'radial-gradient(circle, #F59E0B, transparent 70%)',
            filter: 'blur(80px)',
          }}
        />
        <div
          className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full opacity-5"
          style={{
            background: 'radial-gradient(circle, #D97706, transparent 70%)',
            filter: 'blur(60px)',
          }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="w-full max-w-md relative z-10"
      >
        {/* Back to Homepage */}
        <button
          onClick={() => router.push('/')}
          className="flex items-center gap-2 text-sm mb-6 transition-colors duration-200 hover:gap-3"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = '#F59E0B'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--text-muted)'
          }}
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Homepage
        </button>

        {/* Card */}
        <div className="rounded-2xl p-8 border" style={cardStyle}>
          {/* Logo / Title */}
          <div className="flex flex-col items-center mb-8">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
              style={{
                background: 'linear-gradient(135deg, #F59E0B, #D97706)',
                boxShadow: '0 0 20px rgba(245, 158, 11, 0.2)',
              }}
            >
              <UserPlus className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
              Accept Invitation
            </h1>
            <p className="text-sm mt-1 text-center" style={{ color: 'var(--text-muted)' }}>
              {step === 'verify' && 'Verifying your invitation...'}
              {step === 'complete' && 'Complete your admin account setup'}
              {step === 'success' && 'Your account is ready!'}
            </p>
          </div>

          <AnimatePresence mode="wait">
            {/* ── Step 1: Verification ─────────────────────────────── */}
            {step === 'verify' && (
              <motion.div
                key="verify-step"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
                className="text-center space-y-5"
              >
                {!token ? (
                  <div
                    className="rounded-xl p-4 flex items-start gap-3"
                    style={{
                      background: 'rgba(239, 68, 68, 0.08)',
                      border: '1px solid rgba(239, 68, 68, 0.2)',
                    }}
                  >
                    <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" style={{ color: '#EF4444' }} />
                    <p className="text-sm font-semibold" style={{ color: '#FCA5A5' }}>
                      Invalid invitation link. Missing token parameter.
                    </p>
                  </div>
                ) : loading ? (
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                      Verifying invitation...
                    </p>
                  </div>
                ) : (
                  <div
                    className="rounded-xl p-4 flex items-start gap-3"
                    style={{
                      background: 'rgba(239, 68, 68, 0.08)',
                      border: '1px solid rgba(239, 68, 68, 0.2)',
                    }}
                  >
                    <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" style={{ color: '#EF4444' }} />
                    <p className="text-sm font-semibold" style={{ color: '#FCA5A5' }}>
                      Invitation verification failed. The link may be invalid or expired.
                    </p>
                  </div>
                )}

                <Button
                  onClick={() => router.push('/admin/login')}
                  className="w-full rounded-full py-3 text-base font-semibold"
                  style={{
                    background: 'linear-gradient(135deg, #F59E0B, #D97706)',
                    color: '#0B0F17',
                  }}
                >
                  Go to Sign In
                </Button>
              </motion.div>
            )}

            {/* ── Step 2: Complete Signup ─────────────────────────────── */}
            {step === 'complete' && invitationData && (
              <motion.form
                key="complete-step"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                onSubmit={handleCompleteSignup}
                className="space-y-5"
              >
                {/* Invitation Details */}
                <div
                  className="rounded-xl p-4 space-y-2"
                  style={{
                    background: 'rgba(34, 197, 94, 0.08)',
                    border: '1px solid rgba(34, 197, 94, 0.2)',
                  }}
                >
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4" style={{ color: '#22C55E' }} />
                    <span className="text-sm" style={{ color: '#86EFAC' }}>
                      {invitationData.email}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4" style={{ color: '#22C55E' }} />
                    <span className="text-sm capitalize" style={{ color: '#86EFAC' }}>
                      Role: {invitationData.role}
                    </span>
                  </div>
                </div>

                {/* Name */}
                <div className="space-y-2">
                  <Label htmlFor="signup-name" style={{ color: 'var(--text-muted)' }}>
                    Full Name
                  </Label>
                  <div className="relative">
                    <UserPlus className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                    <Input
                      id="signup-name"
                      type="text"
                      placeholder="Your full name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      className="pl-10 rounded-xl border-none"
                      style={inputStyle}
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="space-y-2">
                  <Label htmlFor="signup-password" style={{ color: 'var(--text-muted)' }}>
                    Password
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                    <Input
                      id="signup-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Min 8 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={8}
                      className="pl-10 pr-10 rounded-xl border-none"
                      style={inputStyle}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Confirm Password */}
                <div className="space-y-2">
                  <Label htmlFor="signup-confirm" style={{ color: 'var(--text-muted)' }}>
                    Confirm Password
                  </Label>
                  <div className="relative">
                    <CheckCircle2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                    <Input
                      id="signup-confirm"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Re-enter your password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      minLength={8}
                      className="pl-10 rounded-xl border-none"
                      style={inputStyle}
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-full py-3 text-base font-semibold"
                  style={{
                    background: 'linear-gradient(135deg, #F59E0B, #D97706)',
                    color: '#0B0F17',
                  }}
                >
                  {loading ? 'Creating account…' : 'Complete Setup'}
                </Button>
              </motion.form>
            )}

            {/* ── Step 3: Success ─────────────────────────────────── */}
            {step === 'success' && (
              <motion.div
                key="success-step"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
                className="text-center space-y-5"
              >
                <div
                  className="w-16 h-16 rounded-full mx-auto flex items-center justify-center"
                  style={{
                    background: 'rgba(34, 197, 94, 0.1)',
                    border: '2px solid rgba(34, 197, 94, 0.3)',
                  }}
                >
                  <ShieldCheck className="w-8 h-8 text-green-400" />
                </div>
                <div>
                  <h2 className="text-lg font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
                    Account Created Successfully
                  </h2>
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    Your admin account has been activated. You can now sign in with your credentials.
                  </p>
                </div>
                <Button
                  onClick={() => router.push('/admin/dashboard')}
                  className="w-full rounded-full py-3 text-base font-semibold"
                  style={{
                    background: 'linear-gradient(135deg, #F59E0B, #D97706)',
                    color: '#0B0F17',
                  }}
                >
                  Go to Dashboard
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <p className="text-center text-xs mt-4" style={{ color: 'var(--text-muted)' }}>
          &copy; {new Date().getFullYear()} Vibe Hub. All rights reserved.
        </p>
      </motion.div>
    </div>
  )
}

export default function AcceptInvitationPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" style={{ background: '#0B0F17' }} />}>
      <AcceptInvitationContent />
    </Suspense>
  )
}
