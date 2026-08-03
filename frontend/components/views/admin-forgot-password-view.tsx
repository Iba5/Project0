'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Mail,
  Lock,
  Eye,
  EyeOff,
  KeyRound,
  CheckCircle2,
  Sparkles,
  ShieldCheck,
} from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/api-client'

type Step = 'email' | 'reset' | 'success'

type AdminForgotPasswordViewProps = {
  initialToken?: string
  initialEmail?: string
}

export function AdminForgotPasswordView({ initialToken = '', initialEmail = '' }: AdminForgotPasswordViewProps) {
  const router = useRouter()

  // Step management
  const [step, setStep] = useState<Step>(initialToken ? 'reset' : 'email')

  // Email step
  const [email, setEmail] = useState(initialEmail)
  const [emailLoading, setEmailLoading] = useState(false)

  // Reset step
  const [token, setToken] = useState(initialToken)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)

  // ── Step 1: Request reset ───────────────────────────────────────
  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) {
      toast.error('Email required', { description: 'Please enter your email address.' })
      return
    }

    setEmailLoading(true)
    try {
      await apiFetch<{ message?: string }>('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim() }),
      })

      toast.success('Reset link sent', {
        description: 'Check your inbox and open the email link to continue.',
      })
    } catch (err) {
      toast.error('Request failed', { description: err instanceof Error ? err.message : 'Something went wrong.' })
    } finally {
      setEmailLoading(false)
    }
  }

  // ── Step 2: Reset password ──────────────────────────────────────
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!token.trim()) {
      toast.error('Token required', { description: 'Please enter the reset token.' })
      return
    }
    if (newPassword.length < 8) {
      toast.error('Password too short', { description: 'Password must be at least 8 characters.' })
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match', { description: 'Please make sure both passwords are identical.' })
      return
    }

    setResetLoading(true)
    try {
      await apiFetch<{ message?: string }>('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({
          token: token.trim(),
          new_password: newPassword,
        }),
      })

      setStep('success')
      toast.success('Password reset!', {
        description: 'You can now sign in with your new password.',
      })
    } catch (err) {
      toast.error('Reset failed', { description: err instanceof Error ? err.message : 'Something went wrong.' })
    } finally {
      setResetLoading(false)
    }
  }

  // ── Shared card wrapper style ───────────────────────────────────
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
              <KeyRound className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
              Reset Password
            </h1>
            <p className="text-sm mt-1 text-center" style={{ color: 'var(--text-muted)' }}>
              {step === 'email' && 'Enter your email to receive a reset link'}
              {step === 'reset' && 'Use the link from your email to set a new password'}
              {step === 'success' && 'Your password has been reset!'}
            </p>
          </div>

          <AnimatePresence mode="wait">
            {/* ── Step 1: Email ─────────────────────────────────── */}
            {step === 'email' && (
              <motion.form
                key="email-step"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
                onSubmit={handleRequestReset}
                className="space-y-5"
              >
                <div className="space-y-2">
                  <Label htmlFor="reset-email" style={{ color: 'var(--text-muted)' }}>
                    Email Address
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                    <Input
                      id="reset-email"
                      type="email"
                      placeholder="admin@vibehub.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="pl-10 rounded-xl border-none"
                      style={inputStyle}
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={emailLoading}
                  className="w-full rounded-full py-3 text-base font-semibold"
                  style={{
                    background: 'linear-gradient(135deg, #F59E0B, #D97706)',
                    color: '#0B0F17',
                  }}
                >
                  {emailLoading ? 'Sending…' : 'Send Reset Link'}
                </Button>

                <button
                  type="button"
                  onClick={() => router.push('/admin/login')}
                  className="w-full text-sm hover:underline text-center"
                  style={{ color: '#F59E0B' }}
                >
                  Back to Sign In
                </button>
              </motion.form>
            )}

            {/* ── Step 2: Reset ─────────────────────────────────── */}
            {step === 'reset' && (
              <motion.form
                key="reset-step"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                onSubmit={handleResetPassword}
                className="space-y-4"
              >
                {/* Token field */}
                <div className="space-y-2">
                  <Label htmlFor="reset-token" style={{ color: 'var(--text-muted)' }}>
                    Reset Link Token
                  </Label>
                  <div className="relative">
                    <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                    <Input
                      id="reset-token"
                      type="text"
                      placeholder="Token from your email link"
                      value={token}
                      onChange={(e) => setToken(e.target.value)}
                      required
                      className="pl-10 rounded-xl border-none font-mono text-sm"
                      style={inputStyle}
                    />
                  </div>
                </div>

                {/* New password */}
                <div className="space-y-2">
                  <Label htmlFor="new-password" style={{ color: 'var(--text-muted)' }}>
                    New Password
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                    <Input
                      id="new-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Min 8 characters"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
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

                {/* Confirm password */}
                <div className="space-y-2">
                  <Label htmlFor="confirm-new-password" style={{ color: 'var(--text-muted)' }}>
                    Confirm Password
                  </Label>
                  <div className="relative">
                    <CheckCircle2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                    <Input
                      id="confirm-new-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Re-enter your new password"
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
                  disabled={resetLoading}
                  className="w-full rounded-full py-3 text-base font-semibold"
                  style={{
                    background: 'linear-gradient(135deg, #F59E0B, #D97706)',
                    color: '#0B0F17',
                  }}
                >
                  {resetLoading ? 'Resetting…' : 'Reset Password'}
                </Button>

                <button
                  type="button"
                  onClick={() => setStep('email')}
                  className="w-full text-sm hover:underline text-center"
                  style={{ color: '#F59E0B' }}
                >
                  Need another link? Try again
                </button>
              </motion.form>
            )}

            {/* ── Step 3: Success ───────────────────────────────── */}
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
                    Password Reset Complete
                  </h2>
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    Your password has been updated successfully. You can now sign in with your new credentials.
                  </p>
                </div>
                <Button
                  onClick={() => router.push('/admin/login')}
                  className="w-full rounded-full py-3 text-base font-semibold"
                  style={{
                    background: 'linear-gradient(135deg, #F59E0B, #D97706)',
                    color: '#0B0F17',
                  }}
                >
                  Sign In Now
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
