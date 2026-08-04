'use client'

import { useState, useEffect, Suspense } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Mail, Lock, Eye, EyeOff, Sparkles, ArrowLeft, UserPlus, ShieldAlert, CheckCircle2 } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { login, signup } from '@/lib/api'
import { apiFetch } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

type AuthMode = 'login' | 'signup'

function AdminLoginViewContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get('next') || '/admin/dashboard'
  
  const [mode, setMode] = useState<AuthMode>('login')
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [bootstrapToken, setBootstrapToken] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  // Track whether a super admin already exists
  const [superAdminExists, setSuperAdminExists] = useState<boolean | null>(null)

  // Check on mount whether a super admin has already been created
  useEffect(() => {
    apiFetch<{ superAdminExists: boolean }>('/auth/signup/status')
      .then((data) => {
        if (typeof data.superAdminExists === 'boolean') {
          setSuperAdminExists(data.superAdminExists)
        }
      })
      .catch(() => {
        // If the check fails, allow signup (fail-open)
        setSuperAdminExists(false)
      })
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      console.log('[Login] Starting login process for:', email)
      const { user } = await login(email, password)
      console.log('[Login] Login successful, user:', user)
      // User state is now set in the API layer from backend response
      console.log('[Login] Admin user set in store via API')
      toast.success('Welcome back!', { description: `Signed in as ${user.name}` })
      // Small delay to ensure state is updated before navigation
      setTimeout(() => {
        console.log('[Login] Navigating to:', next)
        router.push(next)
      }, 100)
    } catch (err) {
      console.error('[Login] Login failed:', err)
      toast.error('Login failed', {
        description: err instanceof Error ? err.message : 'Invalid credentials',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirmPassword) {
      toast.error('Passwords do not match', { description: 'Please make sure both passwords are identical.' })
      return
    }
    if (password.length < 8) {
      toast.error('Password too short', { description: 'Password must be at least 8 characters.' })
      return
    }
    setLoading(true)
    try {
      const { user, isFirstUser } = await signup(name, email, password, bootstrapToken || undefined)
      // User state is now set in the API layer from backend response
      if (isFirstUser) {
        toast.success('Admin account created!', {
          description: `Welcome, ${user.name}! Your admin account is ready.`,
          duration: 6000,
        })
      }
      // Small delay to ensure state is updated before navigation
      setTimeout(() => {
        console.log('[Signup] Navigating to:', next)
        router.push(next)
      }, 100)
    } catch (err) {
      toast.error('Signup failed', {
        description: err instanceof Error ? err.message : 'Could not create account',
      })
    } finally {
      setLoading(false)
    }
  }

  const switchMode = (newMode: AuthMode) => {
    setMode(newMode)
    setEmail('')
    setName('')
    setPassword('')
    setConfirmPassword('')
    setShowPassword(false)
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
        <div
          className="rounded-2xl p-8 border"
          style={{
            background: 'rgba(18, 24, 36, 0.8)',
            backdropFilter: 'blur(20px)',
            borderColor: 'rgba(245, 158, 11, 0.1)',
            boxShadow: '0 4px 24px rgba(0, 0, 0, 0.3)',
          }}
        >
          {/* Logo / Title */}
          <div className="flex flex-col items-center mb-8">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
              style={{
                background: 'linear-gradient(135deg, #F59E0B, #D97706)',
                boxShadow: '0 0 20px rgba(245, 158, 11, 0.2)',
              }}
            >
              <Sparkles className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
              Vibe Hub
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
              {mode === 'login' ? 'Admin Portal' : 'Create Admin Account'}
            </p>
          </div>

          <AnimatePresence mode="wait">
            {mode === 'login' ? (
              <motion.form
                key="login"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
                onSubmit={handleLogin}
                className="space-y-5"
              >
                <div className="space-y-2">
                  <Label htmlFor="login-email" style={{ color: 'var(--text-muted)' }}>
                    Email
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="admin@vibewub.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="pl-10 rounded-xl border-none"
                      style={{
                        background: 'var(--surface-3)',
                        color: 'var(--text-primary)',
                      }}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="login-password" style={{ color: 'var(--text-muted)' }}>
                    Password
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                    <Input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="pl-10 pr-10 rounded-xl border-none"
                      style={{
                        background: 'var(--surface-3)',
                        color: 'var(--text-primary)',
                      }}
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

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-full py-3 text-base font-semibold"
                  style={{
                    background: 'linear-gradient(135deg, #F59E0B, #D97706)',
                    color: '#0B0F17',
                  }}
                >
                  {loading ? 'Signing in…' : 'Sign In'}
                </Button>
              </motion.form>
            ) : superAdminExists ? (
              /* ── Invitation-only notice ── */
              <motion.div
                key="invite-only"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="space-y-5"
              >
                <div
                  className="rounded-xl p-4 flex items-start gap-3"
                  style={{
                    background: 'rgba(239, 68, 68, 0.08)',
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                  }}
                >
                  <ShieldAlert className="w-5 h-5 mt-0.5 shrink-0" style={{ color: '#EF4444' }} />
                  <p className="text-sm font-semibold" style={{ color: '#FCA5A5' }}>
                    You must be invited to create an account.
                  </p>
                </div>

                <Button
                  type="button"
                  onClick={() => switchMode('login')}
                  className="w-full rounded-full py-3 text-base font-semibold"
                  style={{
                    background: 'linear-gradient(135deg, #F59E0B, #D97706)',
                    color: '#0B0F17',
                  }}
                >
                  Go to Sign In
                </Button>
              </motion.div>
            ) : (
              /* ── First-user signup form (no super admin prompt) ── */
              <motion.form
                key="signup"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                onSubmit={handleSignup}
                className="space-y-5"
              >
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
                      style={{
                        background: 'var(--surface-3)',
                        color: 'var(--text-primary)',
                      }}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-email" style={{ color: 'var(--text-muted)' }}>
                    Email
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="admin@vibehub.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="pl-10 rounded-xl border-none"
                      style={{
                        background: 'var(--surface-3)',
                        color: 'var(--text-primary)',
                      }}
                    />
                  </div>
                </div>

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
                      style={{
                        background: 'var(--surface-3)',
                        color: 'var(--text-primary)',
                      }}
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

                {!superAdminExists && (
                  <div className="space-y-2">
                    <Label htmlFor="bootstrap-token" style={{ color: 'var(--text-muted)' }}>
                      Setup Token
                    </Label>
                    <div className="relative">
                      <ShieldAlert className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                      <Input
                        id="bootstrap-token"
                        type="text"
                        placeholder="Enter setup token from backend"
                        value={bootstrapToken}
                        onChange={(e) => setBootstrapToken(e.target.value)}
                        required={!superAdminExists}
                        className="pl-10 rounded-xl border-none"
                        style={{
                          background: 'var(--surface-3)',
                          color: 'var(--text-primary)',
                        }}
                      />
                    </div>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      Required for first admin setup. Get this from your backend environment variables.
                    </p>
                  </div>
                )}

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
                      style={{
                        background: 'var(--surface-3)',
                        color: 'var(--text-primary)',
                      }}
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
                  {loading ? 'Creating account…' : 'Create Admin Account'}
                </Button>
              </motion.form>
            )}
          </AnimatePresence>

          {/* Mode Switch & Forgot Password */}
          <div className="mt-6 text-center space-y-3">
            {mode === 'login' && (
              <button
                onClick={() => router.push('/reset-password')}
                className="text-sm hover:underline block w-full"
                style={{ color: '#F59E0B' }}
              >
                Forgot Password?
              </button>
            )}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t" style={{ borderColor: 'rgba(245, 158, 11, 0.1)' }} />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="px-2" style={{ color: 'var(--text-muted)', background: 'rgba(18, 24, 36, 0.8)' }}>
                  or
                </span>
              </div>
            </div>
            {mode === 'login' ? (
              <button
                onClick={() => switchMode('signup')}
                className="text-sm font-medium hover:underline"
                style={{ color: '#F59E0B' }}
              >
                Don&apos;t have an account? Sign Up
              </button>
            ) : (
              <button
                onClick={() => switchMode('login')}
                className="text-sm font-medium hover:underline"
                style={{ color: '#F59E0B' }}
              >
                Already have an account? Sign In
              </button>
            )}
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs mt-4" style={{ color: 'var(--text-muted)' }}>
          &copy; {new Date().getFullYear()} Vibe Hub. All rights reserved.
        </p>
      </motion.div>
    </div>
  )
}

export function AdminLoginView() {
  return (
    <Suspense fallback={<div className="min-h-screen" style={{ background: '#0B0F17' }} />}>
      <AdminLoginViewContent />
    </Suspense>
  )
}
