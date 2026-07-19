'use client'

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Loader2, CheckCircle, XCircle } from 'lucide-react'

type InvitationInfo = {
  valid: boolean
  email: string
  role: string
}

export default function AcceptInvitationClient() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const token = searchParams.get('token')

  const [loading, setLoading] = useState(true)
  const [valid, setValid] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState<InvitationInfo | null>(null)

  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (!token) {
      setError('Invitation token is missing.')
      setLoading(false)
      return
    }

    async function verifyInvitation() {
      try {
        const res = await fetch(
          `/api/proxy/auth/invitation/${token}`
        )

        const data = await res.json()

        if (!res.ok) {
          throw new Error(data.detail || data.message)
        }

        setInfo(data)
        setValid(true)
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Invalid invitation.'
        )
      } finally {
        setLoading(false)
      }
    }

    verifyInvitation()
  }, [token])

  async function handleSubmit(
    e: React.FormEvent<HTMLFormElement>
  ) {
    e.preventDefault()

    if (!name.trim()) {
      alert('Please enter your name.')
      return
    }

    if (password.length < 8) {
      alert('Password must be at least 8 characters.')
      return
    }

    if (password !== confirmPassword) {
      alert('Passwords do not match.')
      return
    }

    setSubmitting(true)

    try {
      const res = await fetch(
        '/api/proxy/auth/complete-signup',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            token,
            name,
            password,
          }),
        }
      )

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.detail || data.message)
      }

      setSuccess(true)

      setTimeout(() => {
        router.push('/admin/login')
      }, 2500)
    } catch (err) {
      alert(
        err instanceof Error
          ? err.message
          : 'Failed to activate account.'
      )
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!valid) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="w-full max-w-md rounded-xl border bg-card p-8 text-center shadow">
          <XCircle className="mx-auto mb-4 h-12 w-12 text-red-500" />

          <h1 className="text-2xl font-bold">
            Invitation Invalid
          </h1>

          <p className="mt-3 text-muted-foreground">
            {error}
          </p>

          <button
            onClick={() => router.push('/admin/login')}
            className="mt-6 rounded-lg bg-black px-5 py-2 text-white"
          >
            Back to Login
          </button>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="w-full max-w-md rounded-xl border bg-card p-8 text-center shadow">
          <CheckCircle className="mx-auto mb-4 h-12 w-12 text-green-500" />

          <h1 className="text-2xl font-bold">
            Account Activated
          </h1>

          <p className="mt-3 text-muted-foreground">
            Redirecting to login...
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-md rounded-xl border bg-card p-8 shadow">
        <h1 className="text-3xl font-bold">
          Accept Invitation
        </h1>

        <p className="mt-2 text-sm text-muted-foreground">
          Finish setting up your administrator account.
        </p>

        <div className="mt-6 rounded-lg bg-muted p-4">
          <p>
            <strong>Email:</strong> {info?.email}
          </p>

          <p>
            <strong>Role:</strong> {info?.role}
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="mt-6 space-y-4"
        >
          <div>
            <label className="mb-1 block text-sm font-medium">
              Full Name
            </label>

            <input
              type="text"
              className="w-full rounded-lg border px-3 py-2"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Password
            </label>

            <input
              type="password"
              className="w-full rounded-lg border px-3 py-2"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Confirm Password
            </label>

            <input
              type="password"
              className="w-full rounded-lg border px-3 py-2"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-black py-3 font-semibold text-white disabled:opacity-50"
          >
            {submitting ? (
              <Loader2 className="mx-auto h-5 w-5 animate-spin" />
            ) : (
              'Activate Account'
            )}
          </button>
        </form>
      </div>
    </div>
  )
}