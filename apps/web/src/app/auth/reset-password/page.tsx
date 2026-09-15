'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { authApi } from '@/lib/services'

function ResetPasswordContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token') || ''
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

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
      setError(caught instanceof Error ? caught.message : 'Unable to reset your password. The link may have expired.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-center items-center px-6 py-12">
      <div className="max-w-md w-full bg-white rounded-2xl p-8 border border-[#E2E8F0] shadow-sm">
        <div className="text-center mb-6">
          <Link href="/" className="inline-flex items-center gap-2.5 mb-4">
            <div className="w-9 h-9 bg-gradient-to-br from-[#D4AF37] to-[#996515] rounded-xl flex items-center justify-center shadow-md">
              <span className="text-white text-sm font-serif font-bold">Y</span>
            </div>
            <span className="font-serif text-2xl font-bold text-[#0F2942]">YayeTech <span className="text-[#D4AF37] text-base font-sans font-normal">Luxury</span></span>
          </Link>
          <h1 className="font-serif text-3xl text-[#0F2942] mb-2">Set New Password</h1>
          <p className="text-sm text-[#64748B]">Create a strong, secure password for your YayeTech account.</p>
        </div>

        {success ? (
          <div className="text-center">
            <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center text-3xl mx-auto mb-4">
              ✓
            </div>
            <h2 className="font-bold text-xl text-[#0F2942] mb-2">Password Reset Successful!</h2>
            <p className="text-sm text-[#64748B] mb-6">You can now sign in using your new password.</p>
            <button
              onClick={() => router.push('/auth')}
              className="w-full py-3.5 bg-[#0F2942] hover:bg-[#163859] text-white rounded-xl font-bold transition-colors shadow-md"
            >
              Sign In Now →
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3.5 text-sm text-red-600 font-medium">
                {error}
              </div>
            )}

            {!token && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-sm text-amber-800 font-medium">
                Missing token parameter. Please make sure you clicked the full link from your reset email.
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-1.5">
                New Password *
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="8+ characters"
                  required
                  className="w-full border border-[#E2E8F0] rounded-xl px-4 py-3 pr-12 text-sm text-[#0F172A] focus:outline-none focus:border-[#2563EB] transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#64748B]"
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-1.5">
                Confirm New Password *
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat your new password"
                required
                className="w-full border border-[#E2E8F0] rounded-xl px-4 py-3 text-sm text-[#0F172A] focus:outline-none focus:border-[#2563EB] transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !token}
              className="w-full py-3.5 bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-50 text-white rounded-xl font-bold text-base transition-colors shadow-lg shadow-blue-100"
            >
              {loading ? 'Updating password...' : 'Update Password →'}
            </button>

            <div className="text-center pt-2">
              <Link href="/auth" className="text-xs text-[#64748B] hover:text-[#0F172A]">
                Remembered your password? <span className="text-[#2563EB] font-semibold">Sign in</span>
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
    <Suspense fallback={<div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center text-[#64748B]">Loading...</div>}>
      <ResetPasswordContent />
    </Suspense>
  )
}
