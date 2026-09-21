'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle2, XCircle, ArrowRight, Loader2, MailCheck } from 'lucide-react'
import { authApi } from '@/lib/services'

function VerifyEmailContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const [mounted, setMounted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setMounted(true)
  }, [])

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

  if (!mounted) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-center items-center px-6 py-12">
        <div className="max-w-md w-full bg-white rounded-2xl p-8 border border-[#E2E8F0] shadow-sm text-center">
          <div className="w-12 h-12 rounded-2xl bg-[#0F2942] text-[#D4AF37] flex items-center justify-center mx-auto mb-4">
            <MailCheck className="w-6 h-6 animate-pulse" />
          </div>
          <h1 className="font-serif text-2xl font-bold text-[#0F2942] mb-2">Verifying Your Email</h1>
          <p className="text-sm text-[#64748B]">Please wait...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-center items-center px-6 py-12">
      <div className="max-w-md w-full bg-white rounded-2xl p-8 border border-[#E2E8F0] shadow-sm text-center">
        <Link href="/" className="inline-flex items-center gap-2.5 mb-6">
          <div className="w-10 h-10 bg-gradient-to-br from-[#D4AF37] to-[#996515] rounded-xl flex items-center justify-center shadow-md">
            <span className="text-white text-base font-serif font-bold">L</span>
          </div>
          <span className="font-serif text-2xl font-bold text-[#0F2942]">
            LuxStay <span className="text-[#D4AF37] text-sm font-sans font-normal">Luxury</span>
          </span>
        </Link>

        {loading ? (
          <div className="py-6">
            <div className="w-14 h-14 rounded-2xl bg-amber-50 text-[#996515] flex items-center justify-center mx-auto mb-4">
              <Loader2 className="w-7 h-7 animate-spin" />
            </div>
            <h1 className="font-serif text-2xl font-bold text-[#0F2942] mb-2">Verifying Your Email</h1>
            <p className="text-sm text-[#64748B]">Please wait while we verify your LuxStay account...</p>
          </div>
        ) : success ? (
          <div className="py-2">
            <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm border border-emerald-100">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h1 className="font-serif text-2xl font-bold text-[#0F2942] mb-2">Email Verified</h1>
            <p className="text-sm text-[#64748B] mb-6 leading-relaxed">
              Your email address has been confirmed. Your account is now fully active and ready to book luxury stays across Ethiopia.
            </p>
            <button
              type="button"
              onClick={() => router.push('/auth')}
              suppressHydrationWarning
              className="w-full py-3.5 bg-[#0F2942] hover:bg-[#163859] text-white rounded-xl font-semibold transition-colors shadow-md flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Sign In to Your Account</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="py-2">
            <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm border border-rose-100">
              <XCircle className="w-8 h-8" />
            </div>
            <h1 className="font-serif text-2xl font-bold text-[#0F172A] mb-2">Verification Failed</h1>
            <p className="text-sm text-rose-600 mb-6">{error}</p>
            <button
              type="button"
              onClick={() => router.push('/auth')}
              suppressHydrationWarning
              className="w-full py-3.5 bg-[#0F172A] hover:bg-slate-800 text-white rounded-xl font-semibold transition-colors shadow-md flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Back to Sign In</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center text-[#64748B]">
          <Loader2 className="w-6 h-6 animate-spin text-[#0F2942]" />
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  )
}

