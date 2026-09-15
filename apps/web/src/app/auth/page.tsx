'use client'

import * as React from 'react'
import { Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { loginSchema, registerSchema, forgotPasswordSchema } from '@repo/shared-types'
import type { LoginInput, RegisterInput, ForgotPasswordInput } from '@repo/shared-types'
import { useAuth } from '@/lib/auth-store'
import { useLoginMutation, useRegisterMutation, useForgotPasswordMutation } from '@/hooks/use-auth'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { toast } from '@/components/ui/Toast'
import {
  Hotel,
  Mail,
  Lock,
  User,
  Phone,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
} from 'lucide-react'

type AuthMode = 'login' | 'register' | 'forgot'

function AuthForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const returnTo = searchParams.get('returnTo')
  const modeParam = searchParams.get('mode') as AuthMode | null
  const initialMode = modeParam === 'register' || modeParam === 'forgot' ? modeParam : 'login'

  const [mode, setMode] = React.useState<AuthMode>(initialMode)
  const [showPassword, setShowPassword] = React.useState(false)
  const [apiError, setApiError] = React.useState<string | null>(null)
  const [forgotSuccess, setForgotSuccess] = React.useState(false)

  // Reactively synchronize form mode whenever URL search params change
  React.useEffect(() => {
    if (modeParam === 'login' || modeParam === 'register' || modeParam === 'forgot') {
      setMode(modeParam)
      setApiError(null)
    }
  }, [modeParam])

  const user = useAuth((s) => s.user)

  // Redirect if already authenticated
  React.useEffect(() => {
    if (user) {
      if (returnTo) {
        const decoded = decodeURIComponent(returnTo)
        // Guard against cross-role redirects (e.g., manager redirected to /admin)
        const isForbidden =
          (decoded.startsWith('/admin') && user.role !== 'ADMIN') ||
          (decoded.startsWith('/manager') && user.role !== 'MANAGER' && user.role !== 'ADMIN') ||
          (decoded.startsWith('/staff') && user.role !== 'STAFF' && user.role !== 'MANAGER' && user.role !== 'ADMIN')

        if (!isForbidden) {
          router.replace(decoded)
          return
        }
      }

      // Default role-specific landing destinations
      if (user.role === 'ADMIN') {
        router.replace('/admin')
      } else if (user.role === 'MANAGER') {
        router.replace('/manager')
      } else if (user.role === 'STAFF') {
        router.replace('/staff')
      } else {
        router.replace('/dashboard')
      }
    }
  }, [user, returnTo, router])

  // React Hook Form for Login
  const loginForm = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  // React Hook Form for Register
  const registerForm = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { fullName: '', email: '', phone: '', password: '' },
  })

  // React Hook Form for Forgot Password
  const forgotForm = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  })

  // TanStack Query Mutations
  const loginMutation = useLoginMutation()
  const registerMutation = useRegisterMutation()
  const forgotMutation = useForgotPasswordMutation()

  const onLoginSubmit = async (data: LoginInput) => {
    setApiError(null)
    try {
      await loginMutation.mutateAsync(data)
      toast.success('Welcome back', 'You have signed in successfully.')
    } catch (err: any) {
      setApiError(err?.message || 'Invalid email or password. Please try again.')
    }
  }

  const onRegisterSubmit = async (data: RegisterInput) => {
    setApiError(null)
    try {
      await registerMutation.mutateAsync(data)
      toast.success('Account created', 'Welcome to YayeTech Luxury Stays.')
    } catch (err: any) {
      setApiError(err?.message || 'Registration could not be completed. Please try again.')
    }
  }

  const onForgotSubmit = async (data: ForgotPasswordInput) => {
    setApiError(null)
    try {
      await forgotMutation.mutateAsync(data)
      setForgotSuccess(true)
      toast.info('Check your inbox', 'Password reset instructions have been sent.')
    } catch (err: any) {
      setApiError(err?.message || 'Unable to request password reset. Please try again.')
    }
  }

  return (
    <div className="min-h-[85vh] flex items-center justify-center py-12 px-4 sm:px-6">
      <div className="w-full max-w-md">
        {/* Header Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#0F2942] text-[#D4AF37] shadow-lg mb-4">
            <Hotel className="w-7 h-7" />
          </div>
          <h1 className="font-serif text-3xl font-bold text-[#0F2942]">
            {mode === 'login' && 'Welcome Back'}
            {mode === 'register' && 'Join YayeTech'}
            {mode === 'forgot' && 'Reset Password'}
          </h1>
          <p className="text-sm text-slate-500 mt-2">
            {mode === 'login' && 'Sign in to access your luxury itineraries and bookings'}
            {mode === 'register' && 'Create your account to unlock curated rates and perks'}
            {mode === 'forgot' && 'Enter your email to receive recovery instructions'}
          </p>
        </div>

        {/* Auth Glass Card */}
        <div className="bg-white/90 backdrop-blur-xl rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-200/80">
          {/* Global API Error Alert */}
          {apiError && (
            <div
              role="alert"
              className="mb-6 p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs sm:text-sm flex items-start gap-2.5"
            >
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-600" />
              <div className="leading-relaxed">{apiError}</div>
            </div>
          )}

          {/* Login Form */}
          {mode === 'login' && (
            <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-4">
              <Input
                label="Email Address"
                type="email"
                placeholder="name@example.com"
                leftIcon={<Mail className="w-4 h-4" />}
                error={loginForm.formState.errors.email?.message}
                {...loginForm.register('email')}
              />

              <div className="space-y-1">
                <Input
                  label="Password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  leftIcon={<Lock className="w-4 h-4" />}
                  rightIcon={
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-slate-400 hover:text-slate-700 cursor-pointer"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  }
                  error={loginForm.formState.errors.password?.message}
                  {...loginForm.register('password')}
                />
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('forgot')
                      setApiError(null)
                      router.replace(`/auth?mode=forgot${returnTo ? `&returnTo=${encodeURIComponent(returnTo)}` : ''}`)
                    }}
                    className="text-xs font-semibold text-[#0F2942] hover:text-[#D4AF37] transition-colors cursor-pointer"
                  >
                    Forgot password?
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                variant="gold"
                size="lg"
                loading={loginMutation.isPending}
                className="w-full mt-2"
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Sign In
              </Button>
            </form>
          )}

          {/* Registration Form */}
          {mode === 'register' && (
            <form onSubmit={registerForm.handleSubmit(onRegisterSubmit)} className="space-y-4">
              <Input
                label="Full Name"
                type="text"
                placeholder="Alexander Wright"
                leftIcon={<User className="w-4 h-4" />}
                error={registerForm.formState.errors.fullName?.message}
                {...registerForm.register('fullName')}
              />

              <Input
                label="Email Address"
                type="email"
                placeholder="name@example.com"
                leftIcon={<Mail className="w-4 h-4" />}
                error={registerForm.formState.errors.email?.message}
                {...registerForm.register('email')}
              />

              <Input
                label="Phone Number (Optional)"
                type="tel"
                placeholder="+251 911 234567"
                leftIcon={<Phone className="w-4 h-4" />}
                error={registerForm.formState.errors.phone?.message}
                {...registerForm.register('phone')}
              />

              <Input
                label="Password (min 8 characters)"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                leftIcon={<Lock className="w-4 h-4" />}
                rightIcon={
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-slate-400 hover:text-slate-700 cursor-pointer"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                }
                error={registerForm.formState.errors.password?.message}
                {...registerForm.register('password')}
              />

              <Button
                type="submit"
                variant="gold"
                size="lg"
                loading={registerMutation.isPending}
                className="w-full mt-2"
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Create Account
              </Button>
            </form>
          )}

          {/* Forgot Password Form */}
          {mode === 'forgot' && (
            <div className="space-y-4">
              {forgotSuccess ? (
                <div className="text-center py-4">
                  <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <h4 className="font-serif text-lg font-bold text-slate-900">Check Your Email</h4>
                  <p className="text-sm text-slate-500 mt-1 mb-6">
                    We have dispatched password reset instructions to your email address.
                  </p>
                  <Button
                    variant="primary"
                    onClick={() => {
                      setMode('login')
                      setForgotSuccess(false)
                    }}
                    className="w-full"
                  >
                    Back to Sign In
                  </Button>
                </div>
              ) : (
                <form onSubmit={forgotForm.handleSubmit(onForgotSubmit)} className="space-y-4">
                  <Input
                    label="Registered Email"
                    type="email"
                    placeholder="name@example.com"
                    leftIcon={<Mail className="w-4 h-4" />}
                    error={forgotForm.formState.errors.email?.message}
                    {...forgotForm.register('email')}
                  />

                  <Button
                    type="submit"
                    variant="gold"
                    size="lg"
                    loading={forgotMutation.isPending}
                    className="w-full"
                  >
                    Send Reset Link
                  </Button>

                  <div className="text-center">
                    <button
                      type="button"
                      onClick={() => {
                        setMode('login')
                        setApiError(null)
                        router.replace(`/auth?mode=login${returnTo ? `&returnTo=${encodeURIComponent(returnTo)}` : ''}`)
                      }}
                      className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                    >
                      Remembered your password? Sign in
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* Mode Switcher Footer */}
          {mode !== 'forgot' && (
            <div className="mt-6 pt-6 border-t border-slate-100 text-center">
              <p className="text-sm text-slate-500">
                {mode === 'login' ? "Don't have an account yet?" : 'Already have a registered account?'}{' '}
                <button
                  type="button"
                  onClick={() => {
                    const nextMode = mode === 'login' ? 'register' : 'login'
                    setMode(nextMode)
                    setApiError(null)
                    router.replace(`/auth?mode=${nextMode}${returnTo ? `&returnTo=${encodeURIComponent(returnTo)}` : ''}`)
                  }}
                  className="font-bold text-[#0F2942] hover:text-[#D4AF37] transition-colors cursor-pointer"
                >
                  {mode === 'login' ? 'Create Account' : 'Sign In'}
                </button>
              </p>
            </div>
          )}
        </div>

        {/* Security Trust Badges */}
        <div className="mt-8 flex items-center justify-center gap-6 text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-[#D4AF37]" />
            <span>256-bit SSL Encryption</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span>Authoritative RBAC</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function AuthPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[80vh] flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-[#D4AF37] border-t-transparent animate-spin" />
        </div>
      }
    >
      <AuthForm />
    </Suspense>
  )
}
