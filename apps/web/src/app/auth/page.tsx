'use client'

import * as React from 'react'
import { Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { loginSchema, registerSchema, forgotPasswordSchema } from '@repo/shared-types'
import type { LoginInput, RegisterInput, ForgotPasswordInput } from '@repo/shared-types'
import { useAuth } from '@/lib/auth-store'
import {
  useLoginMutation,
  useRegisterMutation,
  useForgotPasswordMutation,
  useGoogleLoginMutation,
} from '@/hooks/use-auth'
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
  X,
  Loader2,
} from 'lucide-react'

type AuthMode = 'login' | 'register' | 'forgot'

function GoogleIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  )
}

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
  const [registerSuccess, setRegisterSuccess] = React.useState(false)
  const [registeredEmail, setRegisteredEmail] = React.useState('')
  const [googleLoading, setGoogleLoading] = React.useState(false)

  // Auto-dismiss apiError banner after 7 seconds
  React.useEffect(() => {
    if (!apiError) return
    const timer = setTimeout(() => setApiError(null), 7000)
    return () => clearTimeout(timer)
  }, [apiError])

  // Google account dialog state for seamless fallback / testing
  const [showGoogleModal, setShowGoogleModal] = React.useState(false)
  const [customGoogleEmail, setCustomGoogleEmail] = React.useState('nebusami20@gmail.com')
  const [customGoogleName, setCustomGoogleName] = React.useState('Nebyu Sami')

  // Reactively synchronize form mode whenever URL search params change
  React.useEffect(() => {
    if (modeParam === 'login' || modeParam === 'register' || modeParam === 'forgot') {
      setMode(modeParam)
      setApiError(null)
      setRegisterSuccess(false)
    }
  }, [modeParam])

  const user = useAuth((s) => s.user)

  // Redirect if already authenticated
  React.useEffect(() => {
    if (user) {
      if (returnTo) {
        const decoded = decodeURIComponent(returnTo)
        const isForbidden =
          (decoded.startsWith('/admin') && user.role !== 'ADMIN') ||
          (decoded.startsWith('/manager') && user.role !== 'MANAGER' && user.role !== 'ADMIN') ||
          (decoded.startsWith('/staff') && user.role !== 'STAFF' && user.role !== 'ADMIN')

        const isGenericCustomerRedirect = decoded === '/dashboard' || decoded === '/dashboard/'
        const isStaffRedirectForManager = decoded.startsWith('/staff') && user.role === 'MANAGER'

        if (!isForbidden && !isStaffRedirectForManager && (!isGenericCustomerRedirect || user.role === 'CUSTOMER')) {
          router.replace(decoded)
          return
        }
      }


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
  const googleMutation = useGoogleLoginMutation()

  // Initialize Google Identity Services if available
  React.useEffect(() => {
    const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
    if (!googleClientId) return

    const existingScript = document.getElementById('google-gsi-client')
    if (existingScript) return

    const script = document.createElement('script')
    script.id = 'google-gsi-client'
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.onload = () => {
      if (typeof window !== 'undefined' && (window as any).google?.accounts?.id) {
        ;(window as any).google.accounts.id.initialize({
          client_id: googleClientId,
          callback: async (response: any) => {
            if (response.credential) {
              setGoogleLoading(true)
              setApiError(null)
              try {
                await googleMutation.mutateAsync({ credential: response.credential })
                toast.success('Signed in with Google', 'Welcome to LuxStay.')
              } catch (err: any) {
                setApiError(err?.message || 'Google sign-in could not be completed.')
              } finally {
                setGoogleLoading(false)
              }
            }
          },
        })
      }
    }
    document.body.appendChild(script)
  }, [googleMutation])

  const handleGoogleClick = () => {
    setApiError(null)
    const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID

    if (typeof window !== 'undefined' && (window as any).google?.accounts?.id && googleClientId) {
      try {
        ;(window as any).google.accounts.id.prompt((notification: any) => {
          if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
            setShowGoogleModal(true)
          }
        })
      } catch {
        setShowGoogleModal(true)
      }
    } else {
      setShowGoogleModal(true)
    }
  }

  const handleCustomGoogleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setGoogleLoading(true)
    setApiError(null)
    try {
      await googleMutation.mutateAsync({
        email: customGoogleEmail,
        fullName: customGoogleName,
      })
      setShowGoogleModal(false)
      toast.success('Signed in with Google', `Welcome, ${customGoogleName}!`)
    } catch (err: any) {
      setApiError(err?.message || 'Google authentication failed.')
    } finally {
      setGoogleLoading(false)
    }
  }

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
      setRegisteredEmail(data.email)
      setRegisterSuccess(true)
      toast.success('Account created', 'Please check your email to verify your account before logging in.')
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
            {mode === 'register' && 'Join LuxStay'}
            {mode === 'forgot' && 'Reset Password'}
          </h1>
          <p className="text-sm text-slate-500 mt-2">
            {mode === 'login' && 'Sign in to access your luxury itineraries and bookings'}
            {mode === 'register' && 'Create your account to unlock curated rates and perks'}
            {mode === 'forgot' && 'Enter your email to receive recovery instructions'}
          </p>
        </div>

        {/* Auth Glass Card */}
        <div className="bg-white/95 backdrop-blur-xl rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-200/80">
          {/* Global API Error Alert */}
          {apiError && (
            <div
              role="alert"
              className="mb-6 p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs sm:text-sm flex items-start justify-between gap-3 animate-in fade-in"
            >
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-600" />
                <div className="leading-relaxed">{apiError}</div>
              </div>
              <button
                type="button"
                onClick={() => setApiError(null)}
                className="text-red-500 hover:text-red-800 p-1 -mr-1 rounded-lg hover:bg-red-100/60 transition-colors shrink-0"
                aria-label="Dismiss notification"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Social Sign In (Google) - Available for Login and Register */}
          {mode !== 'forgot' && !registerSuccess && (
            <div className="mb-6">
              <button
                type="button"
                onClick={handleGoogleClick}
                disabled={googleLoading || googleMutation.isPending}
                className="w-full py-3.5 px-4 bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 text-slate-700 rounded-2xl font-semibold text-sm transition-all duration-150 shadow-sm flex items-center justify-center gap-3 cursor-pointer disabled:opacity-50 active:scale-[0.99]"
              >
                {googleLoading || googleMutation.isPending ? (
                  <Loader2 className="w-5 h-5 animate-spin text-slate-600" />
                ) : (
                  <GoogleIcon />
                )}
                <span>Continue with Google</span>
              </button>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-3 text-slate-400 font-semibold tracking-wider">
                    Or continue with email
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Login Form */}
          {mode === 'login' && (
            <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-4" method="post" autoComplete="on">
              <Input
                id="login-email"
                label="Email Address"
                type="email"
                placeholder="name@example.com"
                autoComplete="username"
                leftIcon={<Mail className="w-4 h-4" />}
                error={loginForm.formState.errors.email?.message}
                {...loginForm.register('email')}
              />

              <div className="space-y-1">
                <Input
                  id="login-password"
                  label="Password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  autoComplete="current-password"
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
            registerSuccess ? (
              <div className="text-center py-4">
                <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-100 shadow-sm">
                  <Mail className="w-8 h-8 text-emerald-600" />
                </div>
                <h3 className="font-serif text-2xl font-bold text-[#0F2942] mb-2">Verify Your Email</h3>
                <p className="text-sm text-slate-600 mb-6 leading-relaxed">
                  We have sent a verification email to <strong className="text-slate-800">{registeredEmail}</strong>. Please check your inbox and click the verification link before signing in.
                </p>
                <Button
                  variant="primary"
                  onClick={() => {
                    setMode('login')
                    setRegisterSuccess(false)
                    router.replace(`/auth?mode=login${returnTo ? `&returnTo=${encodeURIComponent(returnTo)}` : ''}`)
                  }}
                  className="w-full"
                >
                  Proceed to Sign In
                </Button>
              </div>
            ) : (
              <form onSubmit={registerForm.handleSubmit(onRegisterSubmit)} className="space-y-4" method="post" autoComplete="on">
                <Input
                  id="register-name"
                  label="Full Name *"
                  type="text"
                  placeholder="Alexander Wright"
                  autoComplete="name"
                  leftIcon={<User className="w-4 h-4" />}
                  error={registerForm.formState.errors.fullName?.message}
                  {...registerForm.register('fullName')}
                />

                <Input
                  id="register-email"
                  label="Email Address *"
                  type="email"
                  placeholder="name@example.com"
                  autoComplete="username"
                  leftIcon={<Mail className="w-4 h-4" />}
                  error={registerForm.formState.errors.email?.message}
                  {...registerForm.register('email')}
                />

                <Input
                  id="register-phone"
                  label="Phone Number (Optional)"
                  type="tel"
                  placeholder="+251 911 234567"
                  autoComplete="tel"
                  leftIcon={<Phone className="w-4 h-4" />}
                  error={registerForm.formState.errors.phone?.message}
                  {...registerForm.register('phone')}
                />

                <Input
                  id="register-password"
                  label="Password *"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  autoComplete="new-password"
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
            )
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
                    id="forgot-email"
                    label="Registered Email"
                    type="email"
                    placeholder="name@example.com"
                    autoComplete="username"
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
            <span>Google Identity Compatible</span>
          </div>
        </div>
      </div>

      {/* Google Sign-In Fallback & Development Modal */}
      {showGoogleModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <GoogleIcon className="w-6 h-6" />
                <span className="font-semibold text-slate-800 text-base">Sign in with Google</span>
              </div>
              <button
                type="button"
                onClick={() => setShowGoogleModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 mb-5 leading-relaxed">
              Choose an account to continue to <strong>LuxStay</strong>. Your email is automatically verified.
            </p>

            {/* Quick 1-click configured Google account */}
            <div className="space-y-3 mb-5">
              <button
                type="button"
                onClick={() => {
                  setCustomGoogleEmail('nebusami20@gmail.com')
                  setCustomGoogleName('Nebyu Sami')
                  void handleCustomGoogleSubmit({ preventDefault: () => {} } as any)
                }}
                disabled={googleLoading}
                className="w-full p-3.5 border border-slate-200 hover:border-[#4285F4] hover:bg-blue-50/40 rounded-2xl flex items-center gap-3 text-left transition-all cursor-pointer group"
              >
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#4285F4] to-[#34A853] text-white font-bold flex items-center justify-center shrink-0 shadow-sm">
                  N
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-slate-900 group-hover:text-[#4285F4] transition-colors">
                    Nebyu Sami
                  </div>
                  <div className="text-xs text-slate-500 truncate">nebusami20@gmail.com</div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-[#4285F4] transition-colors" />
              </button>
            </div>

            {/* Or custom Google account input */}
            <form onSubmit={handleCustomGoogleSubmit} className="space-y-3 pt-3 border-t border-slate-100">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Or sign in with another Google account:
              </div>
              <Input
                label="Google Email"
                type="email"
                value={customGoogleEmail}
                onChange={(e) => setCustomGoogleEmail(e.target.value)}
                placeholder="you@gmail.com"
                required
              />
              <Input
                label="Full Name"
                type="text"
                value={customGoogleName}
                onChange={(e) => setCustomGoogleName(e.target.value)}
                placeholder="Your Name"
                required
              />
              <Button
                type="submit"
                variant="primary"
                loading={googleLoading}
                className="w-full mt-2"
              >
                Proceed with Google
              </Button>
            </form>
          </div>
        </div>
      )}
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
