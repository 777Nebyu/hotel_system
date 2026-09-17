'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Lock,
  KeyRound,
  ShieldCheck,
  Loader2,
} from 'lucide-react'
import { authApi } from '@/lib/services'

function ResetPasswordContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token') || ''

  const [mounted, setMounted] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!token) {
      return setError('No reset token was found in the link. Please request a new password reset.')
    }
    if (password.length < 8) {
      return setError('Password must be at least 8 characters long.')
    }
    if (password !== confirmPassword) {
      return setError('Passwords do not match.')
    }

    setLoading(true)
    try {
      await authApi.resetPassword({ token, password })
      setSuccess(true)
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Unable to reset your password. The link may have expired or is invalid.',
      )
    } finally {
      setLoading(false)
    }
  }

  // SSR-safe placeholder during initial mount to avoid browser extension attribute hydration mismatches
  if (!mounted) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-center items-center px-6 py-12">
        <div className="max-w-md w-full bg-white rounded-2xl p-8 border border-[#E2E8F0] shadow-sm text-center">
          <div className="w-12 h-12 rounded-2xl bg-[#0F2942] text-[#D4AF37] flex items-center justify-center mx-auto mb-4">
            <KeyRound className="w-6 h-6 animate-pulse" />
          </div>
          <h1 className="font-serif text-2xl font-bold text-[#0F2942] mb-2">Set New Password</h1>
          <p className="text-sm text-[#64748B]">Preparing secure form...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-center items-center px-6 py-12">
      <div className="max-w-md w-full bg-white rounded-2xl p-8 border border-[#E2E8F0] shadow-sm">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <Link href="/" className="inline-flex items-center gap-2.5 mb-4">
            <div className="w-10 h-10 bg-gradient-to-br from-[#D4AF37] to-[#996515] rounded-xl flex items-center justify-center shadow-md">
              <span className="text-white text-base font-serif font-bold">Y</span>
            </div>
            <span className="font-serif text-2xl font-bold text-[#0F2942]">
              YayeTech <span className="text-[#D4AF37] text-sm font-sans font-normal">Luxury</span>
            </span>
          </Link>
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-amber-50 text-[#996515] mb-3">
            <KeyRound className="w-6 h-6" />
          </div>
          <h1 className="font-serif text-2xl font-bold text-[#0F2942] mb-1.5">Set New Password</h1>
          <p className="text-sm text-[#64748B]">
            Create a strong, secure password for your YayeTech account.
          </p>
        </div>

        {success ? (
          <div className="text-center py-2">
            <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm border border-emerald-100">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h2 className="font-serif text-xl font-bold text-[#0F2942] mb-2">
              Password Reset Successful
            </h2>
            <p className="text-sm text-[#64748B] mb-6 leading-relaxed">
              Your password has been updated securely. You can now sign in using your new credentials.
            </p>
            <button
              type="button"
              onClick={() => router.push('/auth')}
              suppressHydrationWarning
              className="w-full py-3.5 bg-[#0F2942] hover:bg-[#163859] text-white rounded-xl font-semibold transition-colors shadow-md flex items-center justify-center gap-2"
            >
              <span>Sign In to Your Account</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4" suppressHydrationWarning>
            {error && (
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 text-sm text-rose-700 flex items-start gap-2.5">
                <AlertCircle className="w-5 h-5 shrink-0 text-rose-500 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {!token && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-sm text-amber-800 flex items-start gap-2.5">
                <AlertCircle className="w-5 h-5 shrink-0 text-amber-600 mt-0.5" />
                <span>Missing reset token. Please verify you clicked the complete link in your email.</span>
              </div>
            )}

            {/* New Password */}
            <div>
              <label className="block text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-1.5">
                New Password *
              </label>
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="8+ characters"
                  autoComplete="new-password"
                  required
                  suppressHydrationWarning
                  className="w-full border border-[#E2E8F0] rounded-xl pl-10 pr-11 py-3 text-sm text-[#0F172A] focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  suppressHydrationWarning
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Confirm New Password */}
            <div>
              <label className="block text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-1.5">
                Confirm New Password *
              </label>
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat your new password"
                  autoComplete="new-password"
                  required
                  suppressHydrationWarning
                  className="w-full border border-[#E2E8F0] rounded-xl pl-10 pr-11 py-3 text-sm text-[#0F172A] focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                  suppressHydrationWarning
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || !token}
              suppressHydrationWarning
              className="w-full py-3.5 bg-[#0F2942] hover:bg-[#163859] disabled:opacity-50 text-white rounded-xl font-semibold text-sm transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer mt-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Updating Password...</span>
                </>
              ) : (
                <>
                  <span>Update Password</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <div className="text-center pt-2">
              <Link href="/auth" className="text-xs text-[#64748B] hover:text-[#0F2942] transition-colors">
                Remembered your password? <span className="text-[#0F2942] font-semibold underline underline-offset-2">Sign in</span>
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center text-[#64748B]">
          <Loader2 className="w-6 h-6 animate-spin text-[#0F2942]" />
        </div>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  )
}

