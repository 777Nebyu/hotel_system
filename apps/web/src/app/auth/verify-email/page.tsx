'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { authApi } from '@/lib/services'

function VerifyEmailContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const [loading, setLoading] = useState(true)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) {
      setError('No verification token was provided in the link.')
      setLoading(false)
      return
    }

    void authApi
      .verifyEmail(token)
      .then(() => {
        setSuccess(true)
      })
      .catch((caught) => {
        setError(caught instanceof Error ? caught.message : 'Invalid or expired verification link.')
      })
      .finally(() => {
        setLoading(false)
      })
  }, [token])

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-center items-center px-6 py-12">
      <div className="max-w-md w-full bg-white rounded-2xl p-8 border border-[#E2E8F0] shadow-sm text-center">
        <Link href="/" className="inline-flex items-center gap-2.5 mb-6">
          <div className="w-9 h-9 bg-gradient-to-br from-[#D4AF37] to-[#996515] rounded-xl flex items-center justify-center shadow-md">
            <span className="text-white text-sm font-serif font-bold">Y</span>
          </div>
          <span className="font-serif text-2xl font-bold text-[#0F2942]">YayeTech <span className="text-[#D4AF37] text-base font-sans font-normal">Luxury</span></span>
        </Link>

        {loading ? (
          <div>
            <div className="w-12 h-12 border-4 border-[#0F2942]/20 border-t-[#0F2942] rounded-full animate-spin mx-auto mb-4" />
            <h1 className="font-serif text-2xl text-[#0F2942] mb-2">Verifying Your Email</h1>
            <p className="text-sm text-[#64748B]">Please wait while we verify your YayeTech account...</p>
          </div>
        ) : success ? (
          <div>
            <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center text-3xl mx-auto mb-4">
              ✓
            </div>
            <h1 className="font-serif text-2xl text-[#0F2942] mb-2">Email Verified!</h1>
            <p className="text-sm text-[#64748B] mb-6">
              Your email address has been confirmed. Your account is now fully active and ready to book luxury stays across Ethiopia.
            </p>
            <button
              onClick={() => router.push('/auth')}
              className="w-full py-3 bg-[#0F2942] hover:bg-[#163859] text-white rounded-xl font-bold transition-colors shadow-md"
            >
              Sign In to Your Account →
            </button>
          </div>
        ) : (
          <div>
            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center text-3xl mx-auto mb-4">
              ✕
            </div>
            <h1 className="font-serif text-2xl text-[#0F172A] mb-2">Verification Failed</h1>
            <p className="text-sm text-red-600 mb-6">{error}</p>
            <button
              onClick={() => router.push('/auth')}
              className="w-full py-3 bg-[#0F172A] text-white rounded-xl font-bold hover:bg-slate-800 transition-colors"
            >
              Back to Sign In
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center text-[#64748B]">Loading...</div>}>
      <VerifyEmailContent />
    </Suspense>
  )
}
