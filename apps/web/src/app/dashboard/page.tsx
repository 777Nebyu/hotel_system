'use client'

import { useState, useMemo, Suspense, useRef, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/lib/auth-store'
import AuthGate from '@/components/AuthGate'
import {
  useMyBookingsQuery,
  useCancelBookingMutation,
  useCreateStayRequestMutation,
  useModifyBookingMutation,
} from '@/hooks/use-booking'
import { useFavoritesQuery, useToggleFavoriteMutation } from '@/hooks/use-catalog'
import { useMyPaymentsQuery } from '@/hooks/use-payment'
import { useMyReviewsQuery, useCreateReviewMutation, useDeleteReviewMutation } from '@/hooks/use-catalog'
import { useUpdateProfileMutation, useUploadProfilePhotoMutation } from '@/hooks/use-auth'
import { bookingService } from '@/services/booking.service'
import { formatEthiopianBirr } from '@/lib/currency'
import { useLanguage } from '@/lib/i18n'
import { StatusBadge } from '@/components/ui/StatusBadge'
import type { Booking, FavoriteHotel, Payment } from '@/lib/types'
import {
  Calendar,
  CreditCard,
  Heart,
  Star,
  Clock,
  FileDown,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  X,
  Bed,
  MapPin,
  ShieldAlert,
  Loader2,
  Trash2,
  Send,
  MessageSquare,
  UserCheck,
  Building,
  Sparkles,
  Camera,
  Check,
  Lock,
  KeyRound,
  Eye,
  EyeOff,
  User as UserIcon,
  Phone,
  Mail,
} from 'lucide-react'

const FALLBACK_IMAGE =
  'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ef/Swimming_pool_and_main_building_of_Amantaka_luxury_Resort_%26_Hotel_in_Luang_Prabang_Laos.jpg/960px-Swimming_pool_and_main_building_of_Amantaka_luxury_Resort_%26_Hotel_in_Luang_Prabang_Laos.jpg'

type DashboardTab = 'overview' | 'bookings' | 'wishlist' | 'payments' | 'reviews' | 'profile'
type BookingFilter = 'all' | 'upcoming' | 'completed' | 'cancelled'

function formatDate(val: string) {
  if (!val) return '—'
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(val))
  } catch {
    return val
  }
}

function calculateRefundEligibility(checkInStr: string, totalAmount: number | string) {
  const checkIn = new Date(checkInStr)
  const now = new Date()
  const daysUntil = Math.floor((checkIn.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  const num = Number(totalAmount)

  if (daysUntil >= 7) {
    return {
      percentage: 100,
      refundAmount: num,
      badge: 'refundFullBadge',
      description: 'refundFullDescription',
    }
  }
  if (daysUntil >= 3) {
    return {
      percentage: 50,
      refundAmount: num * 0.5,
      badge: 'refundPartialBadge',
      description: 'refundPartialDescription',
    }
  }
  return {
    percentage: 0,
    refundAmount: 0,
    badge: 'refundNonRefundableBadge',
    description: 'refundNonRefundableDescription',
  }
}

function CustomerDashboardContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { t } = useLanguage()
  const currentTab = (searchParams.get('tab') as DashboardTab) || 'overview'

  const user = useAuth((s) => s.user)
  const logout = useAuth((s) => s.logout)

  const [bookingFilter, setBookingFilter] = useState<BookingFilter>('all')
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const bookingFilterLabels: Record<BookingFilter, string> = {
    all: t('account', 'allStays'),
    upcoming: t('account', 'upcomingFilter'),
    completed: t('account', 'completedFilter'),
    cancelled: t('account', 'cancelledFilter'),
  }

  // Auto-dismiss notification banners
  useEffect(() => {
    if (!successMessage) return
    const timer = setTimeout(() => setSuccessMessage(null), 5000)
    return () => clearTimeout(timer)
  }, [successMessage])

  useEffect(() => {
    if (!errorMessage) return
    const timer = setTimeout(() => setErrorMessage(null), 7000)
    return () => clearTimeout(timer)
  }, [errorMessage])

  // Cancellation Modal State
  const [cancellingBooking, setCancellingBooking] = useState<Booking | null>(null)

  // Stay Request Modal State
  const [stayRequestBooking, setStayRequestBooking] = useState<Booking | null>(null)
  const [stayRequestType, setStayRequestType] = useState<'EARLY_CHECK_IN' | 'LATE_CHECK_OUT'>('EARLY_CHECK_IN')
  const [stayRequestTime, setStayRequestTime] = useState('11:00')

  // Date Modification Modal State
  const [modifyingBooking, setModifyingBooking] = useState<Booking | null>(null)
  const [modCheckIn, setModCheckIn] = useState('')
  const [modCheckOut, setModCheckOut] = useState('')
  const [modReason, setModReason] = useState('')

  // Review Modal State
  const [reviewBooking, setReviewBooking] = useState<Booking | null>(null)
  const [reviewRating, setReviewRating] = useState(5)
  const [reviewComment, setReviewComment] = useState('')

  // Invoice Download State
  const [downloadingInvoiceId, setDownloadingInvoiceId] = useState<string | null>(null)

  const handleDownloadInvoice = async (bookingId: string) => {
    try {
      setDownloadingInvoiceId(bookingId)
      await bookingService.downloadInvoice(bookingId)
    } catch {
      // Fallback to tokenized URL if blob trigger fails
      window.open(bookingService.getInvoiceDownloadUrl(bookingId), '_blank')
    } finally {
      setDownloadingInvoiceId(null)
    }
  }

  // Queries
  const { data: bookingsData, isLoading: isBookingsLoading } = useMyBookingsQuery()
  const { data: favorites = [], isLoading: isFavoritesLoading } = useFavoritesQuery()
  const { data: paymentsData, isLoading: isPaymentsLoading } = useMyPaymentsQuery()
  const { data: reviews = [], isLoading: isReviewsLoading } = useMyReviewsQuery()

  // Mutations
  const cancelBookingMutation = useCancelBookingMutation()
  const createStayRequestMutation = useCreateStayRequestMutation()
  const modifyBookingMutation = useModifyBookingMutation()
  const toggleFavoriteMutation = useToggleFavoriteMutation()
  const createReviewMutation = useCreateReviewMutation()
  const deleteReviewMutation = useDeleteReviewMutation()

  // Profile & Photo Edit State
  const [profileFullName, setProfileFullName] = useState(user?.fullName || '')
  const [profilePhone, setProfilePhone] = useState(user?.phone || '')
  const [photoFeedback, setPhotoFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [profileFeedback, setProfileFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Security / Password State
  const [showPasswordSection, setShowPasswordSection] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [passwordFeedback, setPasswordFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const updateProfileMutation = useUpdateProfileMutation()
  const uploadProfilePhotoMutation = useUploadProfilePhotoMutation()

  useEffect(() => {
    if (user) {
      setProfileFullName(user.fullName || '')
      setProfilePhone(user.phone || '')
    }
  }, [user?.fullName, user?.phone])

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFeedback(null)

    if (file.size > 5 * 1024 * 1024) {
      setPhotoFeedback({
        type: 'error',
        message: t('account', 'photoTooLarge'),
      })
      return
    }

    if (!file.type.startsWith('image/')) {
      setPhotoFeedback({
        type: 'error',
        message: t('account', 'photoTypeNotAllowed'),
      })
      return
    }

    try {
      await uploadProfilePhotoMutation.mutateAsync(file)
      setPhotoFeedback({
        type: 'success',
        message: t('account', 'photoUploadSuccess'),
      })
    } catch (err: unknown) {
      const errorMsg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (err as Error)?.message ||
        t('account', 'photoUploadFailed')
      setPhotoFeedback({
        type: 'error',
        message: errorMsg,
      })
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setProfileFeedback(null)

    if (profileFullName.trim().length < 2) {
      setProfileFeedback({
        type: 'error',
        message: t('account', 'fullNameTooShort'),
      })
      return
    }

    try {
      await updateProfileMutation.mutateAsync({
        fullName: profileFullName.trim(),
        phone: profilePhone.trim() || null,
      })
      setProfileFeedback({
        type: 'success',
        message: t('account', 'profileUpdateSuccess'),
      })
    } catch (err: unknown) {
      const errorMsg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (err as Error)?.message ||
        t('account', 'profileUpdateFailed')
      setProfileFeedback({
        type: 'error',
        message: errorMsg,
      })
    }
  }

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordFeedback(null)

    if (newPassword.length < 8) {
      setPasswordFeedback({
        type: 'error',
        message: t('account', 'newPasswordTooShort'),
      })
      return
    }

    if (newPassword !== confirmPassword) {
      setPasswordFeedback({
        type: 'error',
        message: t('account', 'passwordsDoNotMatch'),
      })
      return
    }

    try {
      await updateProfileMutation.mutateAsync({
        currentPassword,
        newPassword,
      })
      setPasswordFeedback({
        type: 'success',
        message: t('account', 'passwordChangeSuccess'),
      })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err: unknown) {
      const errorMsg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (err as Error)?.message ||
        t('account', 'passwordUpdateFailed')
      setPasswordFeedback({
        type: 'error',
        message: errorMsg,
      })
    }
  }

  const bookings: Booking[] = useMemo(() => bookingsData?.data || [], [bookingsData?.data])
  const payments: Payment[] = useMemo(() => paymentsData?.data || [], [paymentsData?.data])

  // Split bookings by categories
  const upcomingBookings = useMemo(
    () => bookings.filter((b) => ['PENDING', 'CONFIRMED', 'CHECKED_IN'].includes(b.status)),
    [bookings],
  )
  const completedBookings = useMemo(
    () => bookings.filter((b) => b.status === 'CHECKED_OUT'),
    [bookings],
  )
  const cancelledBookings = useMemo(
    () => bookings.filter((b) => ['CANCELLED', 'REJECTED'].includes(b.status)),
    [bookings],
  )

  const filteredBookings = useMemo(() => {
    if (bookingFilter === 'upcoming') return upcomingBookings
    if (bookingFilter === 'completed') return completedBookings
    if (bookingFilter === 'cancelled') return cancelledBookings
    return bookings
  }, [bookingFilter, bookings, upcomingBookings, completedBookings, cancelledBookings])

  const totalSpent = useMemo(
    () => payments.filter((p) => p.status === 'SUCCEEDED').reduce((sum, p) => sum + Number(p.amount), 0),
    [payments],
  )

  // Handlers
  const handleConfirmCancel = async () => {
    if (!cancellingBooking) return
    setErrorMessage(null)
    try {
      await cancelBookingMutation.mutateAsync(cancellingBooking.id)
      setSuccessMessage(t('account', 'cancelSuccess'))
      setCancellingBooking(null)
    } catch (err: any) {
      setErrorMessage(err?.message || t('account', 'cancelFailed'))
    }
  }

  const handleStayRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!stayRequestBooking) return
    setErrorMessage(null)
    try {
      await createStayRequestMutation.mutateAsync({
        bookingId: stayRequestBooking.id,
        type: stayRequestType,
        requestedTime: stayRequestTime,
      })
      setSuccessMessage(t('account', 'stayRequestSuccess'))
      setStayRequestBooking(null)
    } catch (err: any) {
      setErrorMessage(err?.message || t('account', 'stayRequestFailed'))
    }
  }

  const handleModifySubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!modifyingBooking) return
    setErrorMessage(null)
    try {
      await modifyBookingMutation.mutateAsync({
        bookingId: modifyingBooking.id,
        checkIn: modCheckIn,
        checkOut: modCheckOut,
        reason: modReason.trim() || undefined,
      })
      setSuccessMessage(t('account', 'modifyDatesSuccess'))
      setModifyingBooking(null)
    } catch (err: any) {
      setErrorMessage(err?.message || t('account', 'modifyDatesFailed'))
    }
  }

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!reviewBooking || !reviewComment.trim()) return
    setErrorMessage(null)
    try {
      await createReviewMutation.mutateAsync({
        hotelId: reviewBooking.hotelId,
        bookingId: reviewBooking.id,
        rating: reviewRating,
        comment: reviewComment.trim(),
      })
      setSuccessMessage(t('account', 'reviewPublishSuccess'))
      setReviewBooking(null)
      setReviewComment('')
      setReviewRating(5)
    } catch (err: any) {
      setErrorMessage(err?.message || t('account', 'reviewSubmitFailed'))
    }
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Top Banner / Welcome Bar */}
      <section className="bg-[#0F2942] text-white pt-10 pb-16 px-4 sm:px-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(212,175,55,0.15),transparent_50%)]" />
        <div className="max-w-6xl mx-auto relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#D4AF37] to-[#996515] flex items-center justify-center text-white text-2xl font-serif font-bold shadow-lg">
              {user?.fullName?.charAt(0).toUpperCase() || 'G'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight">
                  {t('account', 'welcomeUser', {
                    name: user?.fullName?.split(' ')[0] || t('account', 'valuedGuest'),
                  })}
                </h1>
                <span className="px-2.5 py-0.5 rounded-full bg-[#D4AF37]/20 border border-[#D4AF37]/40 text-[#D4AF37] text-[11px] font-bold uppercase tracking-wider">
                  {t('account', 'luxuryMember')}
                </span>
              </div>
              <p className="text-slate-300 text-xs sm:text-sm mt-1">
                {user?.email} · {t('account', 'headerSubtitle')}
              </p>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-3 gap-3 bg-white/5 border border-white/10 p-3 rounded-2xl backdrop-blur-md">
            <div className="text-center px-3 py-1">
              <div className="text-lg sm:text-xl font-serif font-bold text-[#D4AF37]">
                {upcomingBookings.length}
              </div>
              <div className="text-[11px] text-slate-300">{t('account', 'statUpcoming')}</div>
            </div>
            <div className="text-center px-3 py-1 border-x border-white/10">
              <div className="text-lg sm:text-xl font-serif font-bold text-white">
                {bookings.length}
              </div>
              <div className="text-[11px] text-slate-300">{t('account', 'statTotalStays')}</div>
            </div>
            <div className="text-center px-3 py-1">
              <div className="text-lg sm:text-xl font-serif font-bold text-[#D4AF37]">
                {favorites.length}
              </div>
              <div className="text-[11px] text-slate-300">{t('account', 'statSaved')}</div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Container */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 -mt-8 relative z-20 pb-16">
        {/* Navigation Tabs Bar */}
        <div className="bg-white rounded-2xl p-2 border border-slate-200/80 shadow-sm flex items-center gap-1 overflow-x-auto mb-8">
          {[
            { id: 'overview', label: t('account', 'tabOverview'), icon: Building },
            { id: 'bookings', label: t('account', 'tabMyBookings'), icon: Calendar, badge: upcomingBookings.length },
            { id: 'wishlist', label: t('account', 'tabSavedStays'), icon: Heart, badge: favorites.length },
            { id: 'payments', label: t('account', 'tabPaymentLedger'), icon: CreditCard },
            { id: 'reviews', label: t('account', 'tabVerifiedReviews'), icon: Star, badge: reviews.length },
            { id: 'profile', label: t('account', 'tabProfileSecurity'), icon: UserCheck },
          ].map((item) => {
            const Icon = item.icon
            const isActive = currentTab === item.id
            return (
              <button
                key={item.id}
                onClick={() => router.push(`/dashboard?tab=${item.id}`)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-[#0F2942] text-white shadow-sm'
                    : 'text-slate-600 hover:text-[#0F2942] hover:bg-slate-50'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-[#D4AF37]' : 'text-slate-400'}`} />
                <span>{item.label}</span>
                {item.badge !== undefined && item.badge > 0 && (
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                      isActive ? 'bg-[#D4AF37] text-[#0F2942]' : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Success Banner */}
        {successMessage && (
          <div className="mb-6 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center justify-between shadow-sm animate-in fade-in">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>{successMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setSuccessMessage(null)}
              className="text-emerald-700 hover:text-emerald-900 p-1 rounded-lg hover:bg-emerald-100/60 transition-colors"
              aria-label={t('account', 'dismissNotification')}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Error Banner */}
        {errorMessage && (
          <div className="mb-6 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center justify-between shadow-sm animate-in fade-in">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="text-rose-700 hover:text-rose-900 p-1 rounded-lg hover:bg-rose-100/60 transition-colors"
              aria-label={t('account', 'dismissNotification')}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* TAB 1: OVERVIEW */}
        {currentTab === 'overview' && (
          <div className="space-y-8">
            {/* Upcoming Hero Card */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-serif text-xl font-bold text-[#0F2942]">{t('account', 'upcomingReservation')}</h2>
                <button
                  onClick={() => router.push('/dashboard?tab=bookings')}
                  className="text-xs font-semibold text-[#0F2942] hover:text-[#D4AF37] flex items-center gap-1 transition-colors"
                >
                  {t('account', 'viewAllStays')} <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {upcomingBookings.length > 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col md:flex-row hover:shadow-md transition-shadow">
                  <div className="relative w-full md:w-72 h-48 md:h-auto bg-slate-100 shrink-0">
                    <Image
                      src={upcomingBookings[0].hotel?.images?.[0]?.url || FALLBACK_IMAGE}
                      alt={upcomingBookings[0].hotel?.name || t('account', 'hotelAltFallback')}
                      fill
                      className="object-cover"
                    />
                  </div>
                  <div className="p-6 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <span className="font-mono text-xs text-slate-400 block mb-1">
                            {t('account', 'referenceNumber', { id: upcomingBookings[0].id.slice(-8) })}
                          </span>
                          <h3 className="font-serif text-xl font-bold text-[#0F2942]">
                            {upcomingBookings[0].hotel?.name || t('account', 'fallbackHotelStay')}
                          </h3>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {upcomingBookings[0].hotel?.address || t('account', 'ethiopiaFallback')}
                          </p>
                        </div>
                        <StatusBadge status={upcomingBookings[0].status} />
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-6 pt-4 border-t border-slate-100 text-xs">
                        <div>
                          <span className="text-slate-400 block">{t('account', 'checkIn')}</span>
                          <span className="font-semibold text-slate-900">
                            {formatDate(upcomingBookings[0].checkIn)}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">{t('account', 'checkOut')}</span>
                          <span className="font-semibold text-slate-900">
                            {formatDate(upcomingBookings[0].checkOut)}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">{t('account', 'totalAmount')}</span>
                          <span className="font-bold text-[#0F2942] text-sm">
                            {formatEthiopianBirr(upcomingBookings[0].totalPrice)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2.5 mt-6 pt-4 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => handleDownloadInvoice(upcomingBookings[0].id)}
                        disabled={downloadingInvoiceId === upcomingBookings[0].id}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors disabled:opacity-50 cursor-pointer"
                      >
                        {downloadingInvoiceId === upcomingBookings[0].id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-[#D4AF37]" />
                        ) : (
                          <FileDown className="w-3.5 h-3.5 text-[#D4AF37]" />
                        )}
                        <span>{t('account', 'pdfInvoice')}</span>
                      </button>
                      <button
                        onClick={() => {
                          setStayRequestBooking(upcomingBookings[0])
                          setStayRequestType('EARLY_CHECK_IN')
                          setStayRequestTime('11:00')
                        }}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
                      >
                        <Clock className="w-3.5 h-3.5 text-[#0F2942]" /> {t('account', 'conciergeRequest')}
                      </button>
                      <button
                        onClick={() => setCancellingBooking(upcomingBookings[0])}
                                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-semibold transition-colors ml-auto"
                              >
                                {t('account', 'cancelStay')}
                              </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-2xl p-10 border border-slate-200 text-center">
                  <Building className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <h3 className="font-serif text-lg font-bold text-slate-800">{t('account', 'noUpcomingReservations')}</h3>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-6">
                    {t('account', 'noUpcomingReservationsDesc')}
                  </p>
                  <Link
                    href="/search"
                    className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#0F2942] hover:bg-[#163859] text-white rounded-xl text-xs font-bold transition-colors shadow-sm"
                  >
                    {t('account', 'discoverStays')} <Sparkles className="w-3.5 h-3.5 text-[#D4AF37]" />
                  </Link>
                </div>
              )}
            </div>

            {/* Quick Favorites Section */}
            {favorites.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-serif text-xl font-bold text-[#0F2942]">{t('account', 'savedStays')}</h2>
                  <button
                    onClick={() => router.push('/dashboard?tab=wishlist')}
                    className="text-xs font-semibold text-[#0F2942] hover:text-[#D4AF37] flex items-center gap-1 transition-colors"
                  >
                    {t('account', 'viewAllCount', { count: favorites.length })} <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {favorites.slice(0, 3).map((hotel) => (
                    <div
                      key={hotel.id}
                      className="bg-white rounded-2xl overflow-hidden border border-slate-200/80 shadow-sm flex flex-col hover:shadow-md transition-all group"
                    >
                      <div className="relative aspect-[16/10] bg-slate-100">
                        <Image
                          src={hotel.primaryImageUrl || FALLBACK_IMAGE}
                          alt={hotel.name}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        <button
                          onClick={() =>
                            toggleFavoriteMutation.mutate({ hotelId: hotel.id, isFavorite: true })
                          }
                          className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/90 text-rose-500 shadow-sm flex items-center justify-center hover:bg-white"
                        >
                          <Heart className="w-4 h-4 fill-current" />
                        </button>
                      </div>
                      <div className="p-4 flex-1 flex flex-col justify-between">
                        <div>
                          <h3 className="font-serif font-bold text-slate-900 line-clamp-1">{hotel.name}</h3>
                          <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                            {hotel.city?.name}, {hotel.city?.country?.name}
                          </p>
                        </div>
                        <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100">
                          <div>
                            <span className="font-serif font-bold text-[#0F2942] text-sm">
                              {formatEthiopianBirr(hotel.minPricePerNight ?? 0)}
                            </span>
                            <span className="text-[10px] text-slate-400">{t('account', 'perNight')}</span>
                          </div>
                          <Link
                            href={`/hotel/${hotel.id}`}
                            className="px-3 py-1.5 bg-[#0F2942] text-white rounded-lg text-xs font-semibold hover:bg-[#163859] transition-colors"
                          >
                            {t('account', 'bookStay')}
                          </Link>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: BOOKINGS */}
        {currentTab === 'bookings' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="font-serif text-2xl font-bold text-[#0F2942]">{t('account', 'reservationHistory')}</h2>
                <p className="text-xs text-slate-500">
                  {t('account', 'reservationHistoryDesc')}
                </p>
              </div>

              {/* Sub-tabs filter */}
              <div className="bg-white rounded-xl p-1 border border-slate-200 shadow-sm flex items-center gap-1">
                {(
                  [
                    { id: 'all' },
                    { id: 'upcoming' },
                    { id: 'completed' },
                    { id: 'cancelled' },
                  ] as const
                ).map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setBookingFilter(f.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                      bookingFilter === f.id
                        ? 'bg-[#0F2942] text-white'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {bookingFilterLabels[f.id]}
                  </button>
                ))}
              </div>
            </div>

            {isBookingsLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-40 bg-white rounded-2xl border border-slate-200 animate-pulse" />
                ))}
              </div>
            ) : filteredBookings.length > 0 ? (
              <div className="space-y-4">
                {filteredBookings.map((b) => {
                  const isUpcoming = ['PENDING', 'CONFIRMED', 'CHECKED_IN'].includes(b.status)
                  const isPast = b.status === 'CHECKED_OUT'
                  const isCancelled = ['CANCELLED', 'REJECTED'].includes(b.status)
                  const paymentStatus = b.payment?.status

                  return (
                    <div
                      key={b.id}
                      className="bg-white rounded-2xl overflow-hidden border border-slate-200/80 shadow-sm flex flex-col md:flex-row hover:border-slate-300 transition-colors"
                    >
                      <div className="relative w-full md:w-56 h-40 md:h-auto bg-slate-100 shrink-0">
                        <Image
                          src={b.hotel?.images?.[0]?.url || FALLBACK_IMAGE}
                          alt={b.hotel?.name || t('account', 'hotelAltFallback')}
                          fill
                          className="object-cover"
                        />
                      </div>

                      <div className="p-5 flex-1 flex flex-col justify-between">
                        <div>
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <span className="font-mono text-[11px] text-slate-400 block mb-0.5">
                                {t('account', 'bookingNumber', { id: b.id.slice(-8) })}
                              </span>
                              <h3 className="font-serif text-lg font-bold text-[#0F2942]">
                                {b.hotel?.name || t('account', 'fallbackHotelReservation')}
                              </h3>
                              <p className="text-xs text-slate-500">{b.hotel?.address || t('account', 'ethiopiaFallback')}</p>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <StatusBadge status={b.status} />
                              {/* Contract 2.D: Distinct refund badge if refunded */}
                              {paymentStatus && ['REFUNDED', 'PARTIALLY_REFUNDED', 'REFUND_PENDING'].includes(paymentStatus) && (
                                <StatusBadge status={paymentStatus} />
                              )}
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-4 text-xs text-slate-600 mt-4 pt-3 border-t border-slate-100">
                            <span className="flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-[#D4AF37]" />
                              {formatDate(b.checkIn)} → {formatDate(b.checkOut)}
                            </span>
                            <span className="flex items-center gap-1.5">
                              <Bed className="w-3.5 h-3.5 text-[#D4AF37]" />
                              {b.details?.[0]?.room?.type?.replace(/_/g, ' ') || t('account', 'fallbackSuite')}
                            </span>
                            <span className="font-bold text-[#0F2942]">
                              {formatEthiopianBirr(b.totalPrice)}
                            </span>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t border-slate-100">
                          <button
                            type="button"
                            onClick={() => handleDownloadInvoice(b.id)}
                            disabled={downloadingInvoiceId === b.id}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
                          >
                            {downloadingInvoiceId === b.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#D4AF37]" />
                            ) : (
                              <FileDown className="w-3.5 h-3.5 text-[#D4AF37]" />
                            )}
                            <span>{t('account', 'pdfInvoice')}</span>
                          </button>

                          {isUpcoming && (
                            <>
                              <button
                                onClick={() => {
                                  setStayRequestBooking(b)
                                  setStayRequestType('EARLY_CHECK_IN')
                                  setStayRequestTime('11:00')
                                }}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
                              >
                                <Clock className="w-3.5 h-3.5 text-[#0F2942]" /> {t('account', 'conciergeRequest')}
                              </button>

                              <button
                                onClick={() => {
                                  setModifyingBooking(b)
                                  setModCheckIn(b.checkIn.slice(0, 10))
                                  setModCheckOut(b.checkOut.slice(0, 10))
                                  setModReason('')
                                }}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold transition-colors"
                              >
                                {t('account', 'modifyDates')}
                              </button>

                              <button
                                onClick={() => setCancellingBooking(b)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-semibold transition-colors ml-auto"
                              >
                                {t('account', 'cancelStay')}
                              </button>
                            </>
                          )}

                          {isPast && (
                            <button
                              onClick={() => {
                                setReviewBooking(b)
                                setReviewRating(5)
                                setReviewComment('')
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0F2942] text-white hover:bg-[#163859] text-xs font-semibold transition-colors ml-auto"
                            >
                              <Star className="w-3.5 h-3.5 text-[#D4AF37]" /> {t('account', 'leaveReview')}
                            </button>
                          )}

                          {isCancelled && (
                            <Link
                              href="/search"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors ml-auto"
                            >
                              {t('account', 'bookNewStay')}
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="bg-white rounded-2xl p-12 border border-slate-200 text-center">
                <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h3 className="font-serif text-lg font-bold text-slate-800">{t('account', 'noReservationsFound')}</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-6">
                  {bookingFilter === 'all'
                    ? t('account', 'noBookingsYet')
                    : t('account', 'noReservationsForFilter', {
                        filter: bookingFilterLabels[bookingFilter],
                      })}
                </p>
                <Link
                  href="/search"
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#0F2942] hover:bg-[#163859] text-white rounded-xl text-xs font-bold transition-colors shadow-sm"
                >
                  {t('account', 'exploreHotels')}
                </Link>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: WISHLIST / SAVED */}
        {currentTab === 'wishlist' && (
          <div className="space-y-6">
            <div>
              <h2 className="font-serif text-2xl font-bold text-[#0F2942]">{t('account', 'savedStays')}</h2>
              <p className="text-xs text-slate-500">
                {t('account', 'savedStaysDesc')}
              </p>
            </div>

            {isFavoritesLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-64 bg-white rounded-2xl border border-slate-200 animate-pulse" />
                ))}
              </div>
            ) : favorites.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {favorites.map((hotel) => (
                  <div
                    key={hotel.id}
                    className="bg-white rounded-2xl overflow-hidden border border-slate-200/80 shadow-sm flex flex-col hover:shadow-md transition-all group"
                  >
                    <div className="relative aspect-[16/10] bg-slate-100">
                      <Image
                        src={hotel.primaryImageUrl || FALLBACK_IMAGE}
                        alt={hotel.name}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      <button
                        onClick={() =>
                          toggleFavoriteMutation.mutate({ hotelId: hotel.id, isFavorite: true })
                        }
                        className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/90 text-rose-500 shadow-sm flex items-center justify-center hover:bg-white cursor-pointer"
                        title={t('account', 'removeFromSaved')}
                      >
                        <Heart className="w-4 h-4 fill-current" />
                      </button>
                    </div>
                    <div className="p-4 flex-1 flex flex-col justify-between">
                      <div>
                        <h3 className="font-serif font-bold text-slate-900 line-clamp-1">{hotel.name}</h3>
                        <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                          {hotel.city?.name}, {hotel.city?.country?.name}
                        </p>
                      </div>
                      <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100">
                        <div>
                          <span className="font-serif font-bold text-[#0F2942] text-base">
                            {formatEthiopianBirr(hotel.minPricePerNight ?? 0)}
                          </span>
                          <span className="text-[10px] text-slate-400">{t('account', 'perNight')}</span>
                        </div>
                        <Link
                          href={`/hotel/${hotel.id}`}
                          className="px-3.5 py-1.5 bg-[#0F2942] hover:bg-[#163859] text-white rounded-lg text-xs font-semibold transition-colors"
                        >
                          {t('account', 'bookStay')}
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-2xl p-12 border border-slate-200 text-center">
                <Heart className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h3 className="font-serif text-lg font-bold text-slate-800">{t('account', 'noSavedStays')}</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-6">
                  {t('account', 'noSavedStaysDesc')}
                </p>
                <Link
                  href="/search"
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#0F2942] hover:bg-[#163859] text-white rounded-xl text-xs font-bold transition-colors shadow-sm"
                >
                  {t('account', 'exploreHotels')}
                </Link>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: PAYMENTS LEDGER */}
        {currentTab === 'payments' && (
          <div className="space-y-6">
            <div>
              <h2 className="font-serif text-2xl font-bold text-[#0F2942]">{t('account', 'paymentLedger')}</h2>
              <p className="text-xs text-slate-500">
                {t('account', 'paymentLedgerDesc')}
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
              <div className="p-4 bg-slate-50/70 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase tracking-wider grid grid-cols-12 gap-2">
                <div className="col-span-5 sm:col-span-4">{t('account', 'colTransactionHotel')}</div>
                <div className="col-span-3 sm:col-span-3">{t('account', 'colMethod')}</div>
                <div className="col-span-4 sm:col-span-3 text-right">{t('account', 'colAmount')}</div>
                <div className="hidden sm:block sm:col-span-2 text-right">{t('account', 'colStatus')}</div>
              </div>

              {isPaymentsLoading ? (
                <div className="p-8 space-y-4 animate-pulse">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-10 bg-slate-100 rounded-xl" />
                  ))}
                </div>
              ) : payments.length > 0 ? (
                <div className="divide-y divide-slate-100">
                  {payments.map((p) => (
                    <div key={p.id} className="p-4 grid grid-cols-12 gap-2 items-center text-xs">
                      <div className="col-span-5 sm:col-span-4">
                        <div className="font-semibold text-slate-900 line-clamp-1">
                          {p.booking?.hotel?.name || t('account', 'fallbackPaymentHotel')}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          {formatDate(p.createdAt)} · {t('account', 'referenceShort')}: {p.providerRef || p.id.slice(-8)}
                        </div>
                      </div>

                      <div className="col-span-3 sm:col-span-3 text-slate-600 capitalize">
                        {p.method.replace(/_/g, ' ')}
                      </div>

                      <div className="col-span-4 sm:col-span-3 text-right font-serif font-bold text-[#0F2942] text-sm">
                        {formatEthiopianBirr(p.amount)}
                      </div>

                      <div className="col-span-12 sm:col-span-2 flex justify-end mt-1 sm:mt-0">
                        <StatusBadge status={p.status} size="sm" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-10 text-center text-slate-500 text-xs">
                  {t('account', 'noPaymentsYet')}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 5: VERIFIED REVIEWS */}
        {currentTab === 'reviews' && (
          <div className="space-y-6">
            <div>
              <h2 className="font-serif text-2xl font-bold text-[#0F2942]">{t('account', 'myVerifiedReviews')}</h2>
              <p className="text-xs text-slate-500">
                {t('account', 'myVerifiedReviewsDesc')}
              </p>
            </div>

            {isReviewsLoading ? (
              <div className="space-y-4">
                {[1, 2].map((i) => (
                  <div key={i} className="h-28 bg-white rounded-2xl border border-slate-200 animate-pulse" />
                ))}
              </div>
            ) : reviews.length > 0 ? (
              <div className="space-y-4">
                {reviews.map((r: any) => (
                  <div
                    key={r.id}
                    className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex flex-col sm:flex-row justify-between gap-4"
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-serif font-bold text-slate-900">
                          {r.hotel?.name || t('account', 'hotelStay')}
                        </span>
                        <div className="flex items-center text-amber-400 text-xs">
                          {Array.from({ length: 5 }).map((_, idx) => (
                            <Star
                              key={idx}
                              className={`w-3.5 h-3.5 ${
                                idx < r.rating ? 'fill-current' : 'text-slate-200'
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed max-w-xl">{r.comment}</p>
                      <span className="text-[10px] text-slate-400 mt-2 block">
                        {t('account', 'publishedOn', { date: formatDate(r.createdAt) })}
                      </span>
                    </div>

                    <button
                      onClick={() => deleteReviewMutation.mutate(r.id)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-semibold self-start transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> {t('account', 'deleteLabel')}
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-2xl p-12 border border-slate-200 text-center">
                <Star className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h3 className="font-serif text-lg font-bold text-slate-800">{t('account', 'noReviewsPublished')}</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                  {t('account', 'noReviewsPublishedDesc')}
                </p>
              </div>
            )}
          </div>
        )}

        {/* TAB 6: PROFILE & SECURITY */}
        {currentTab === 'profile' && (
          <div className="max-w-3xl space-y-6">
            <div>
              <h2 className="font-serif text-2xl font-bold text-[#0F2942]">{t('account', 'profileIdentity')}</h2>
              <p className="text-xs text-slate-500">
                {t('account', 'profileIdentityDesc')}
              </p>
            </div>

            {/* Profile Photo & Guest Overview Card */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 pb-6 border-b border-slate-100">
                {/* Avatar with Camera Overlay */}
                <div className="relative group shrink-0">
                  <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-[#0F2942] to-[#163859] text-white flex items-center justify-center font-serif text-3xl font-bold overflow-hidden shadow-md ring-4 ring-slate-100/80">
                    {user?.profilePhotoUrl ? (
                      <Image
                        src={user.profilePhotoUrl}
                        alt={user.fullName || t('account', 'guestProfileAlt')}
                        width={96}
                        height={96}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      user?.fullName?.charAt(0).toUpperCase() || 'G'
                    )}
                  </div>

                  {/* Camera overlay on hover */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadProfilePhotoMutation.isPending}
                    aria-label={t('account', 'uploadPhotoAria')}
                    className="absolute inset-0 rounded-2xl bg-black/50 text-white flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-[2px] cursor-pointer disabled:cursor-not-allowed"
                  >
                    {uploadProfilePhotoMutation.isPending ? (
                      <Loader2 className="w-6 h-6 animate-spin text-[#D4AF37]" />
                    ) : (
                      <>
                        <Camera className="w-6 h-6 mb-1 text-[#D4AF37]" />
                        <span className="text-[10px] font-bold tracking-wide uppercase">{t('account', 'changeLabel')}</span>
                      </>
                    )}
                  </button>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={handlePhotoUpload}
                  />
                </div>

                <div className="space-y-2 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-serif font-bold text-slate-900 text-xl">{user?.fullName || t('account', 'guestFallback')}</h3>
                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[#D4AF37]/15 text-[#917215] border border-[#D4AF37]/30 uppercase tracking-wider">
                      {t('account', 'accountRoleBadge', { role: user?.role || 'CUSTOMER' })}
                    </span>
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200/80 inline-flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" /> {t('account', 'verifiedGuest')}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    {t('account', 'memberSince', { date: formatDate(user?.createdAt || '') })} · {t('account', 'profilePhotoNote')}
                  </p>

                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadProfilePhotoMutation.isPending}
                      className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200/80 text-slate-800 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-60"
                    >
                      {uploadProfilePhotoMutation.isPending ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-[#0F2942]" />
                          {t('account', 'uploadingCloudinary')}
                        </>
                      ) : (
                        <>
                          <Camera className="w-3.5 h-3.5 text-[#D4AF37]" />
                          {t('account', 'uploadNewPhoto')}
                        </>
                      )}
                    </button>
                    <span className="text-[11px] text-slate-400">{t('account', 'fileFormatsHint')}</span>
                  </div>
                </div>
              </div>

              {/* Photo Upload Toast / Feedback */}
              {photoFeedback && (
                <div
                  className={`p-3 rounded-xl flex items-center gap-2.5 text-xs font-medium ${
                    photoFeedback.type === 'success'
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-rose-50 text-rose-800 border border-rose-200'
                  }`}
                >
                  {photoFeedback.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  )}
                  <span>{photoFeedback.message}</span>
                  <button
                    type="button"
                    onClick={() => setPhotoFeedback(null)}
                    className="ml-auto text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Profile Edit Form */}
              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    {t('account', 'personalInformation')}
                  </h4>
                  <span className="text-[11px] text-slate-400">{t('account', 'keepDetailsUpdated')}</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                      <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                      {t('account', 'fullLegalName')} <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={profileFullName}
                      onChange={(e) => setProfileFullName(e.target.value)}
                      placeholder={t('account', 'fullNamePlaceholder')}
                      className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/50 focus:border-[#D4AF37] transition-all bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      {t('account', 'phoneNumber')}
                    </label>
                    <input
                      type="tel"
                      value={profilePhone}
                      onChange={(e) => setProfilePhone(e.target.value)}
                      placeholder={t('account', 'phonePlaceholder')}
                      className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/50 focus:border-[#D4AF37] transition-all bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-slate-400" />
                      {t('account', 'emailAddress')}
                    </span>
                    <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full">
                      {t('account', 'verifiedIdentity')}
                    </span>
                  </label>
                  <input
                    type="email"
                    disabled
                    value={user?.email || ''}
                    className="w-full border border-slate-200 bg-slate-50/80 rounded-xl px-4 py-2.5 text-sm text-slate-500 cursor-not-allowed"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    {t('account', 'emailVerifiedNote')}
                  </p>
                </div>

                {/* Profile Edit Feedback */}
                {profileFeedback && (
                  <div
                    className={`p-3 rounded-xl flex items-center gap-2.5 text-xs font-medium ${
                      profileFeedback.type === 'success'
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-rose-50 text-rose-800 border border-rose-200'
                    }`}
                  >
                    {profileFeedback.type === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    )}
                    <span>{profileFeedback.message}</span>
                    <button
                      type="button"
                      onClick={() => setProfileFeedback(null)}
                      className="ml-auto text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setProfileFullName(user?.fullName || '')
                      setProfilePhone(user?.phone || '')
                      setProfileFeedback(null)
                    }}
                    disabled={
                      updateProfileMutation.isPending ||
                      (profileFullName === (user?.fullName || '') && profilePhone === (user?.phone || ''))
                    }
                    className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {t('account', 'resetChanges')}
                  </button>
                  <button
                    type="submit"
                    disabled={
                      updateProfileMutation.isPending ||
                      !profileFullName.trim() ||
                      (profileFullName === (user?.fullName || '') && profilePhone === (user?.phone || ''))
                    }
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#0F2942] to-[#1a446c] hover:from-[#163859] hover:to-[#225686] text-white text-xs font-bold shadow-md shadow-[#0F2942]/10 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.99]"
                  >
                    {updateProfileMutation.isPending ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-[#D4AF37]" />
                        {t('account', 'savingProfile')}
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5 text-[#D4AF37]" />
                        {t('account', 'saveProfileChanges')}
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>

            {/* Account Security & Password Card */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-5">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                    <KeyRound className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-serif font-bold text-slate-900 text-base">{t('account', 'accountPassword')}</h3>
                    <p className="text-xs text-slate-500">{t('account', 'accountPasswordDesc')}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowPasswordSection((prev) => !prev)
                    setPasswordFeedback(null)
                  }}
                  className="px-3.5 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 transition-colors cursor-pointer"
                >
                  {showPasswordSection ? t('account', 'hideLabel') : t('account', 'changePassword')}
                </button>
              </div>

              {showPasswordSection && (
                <form onSubmit={handleSavePassword} className="space-y-4 pt-1 animate-in fade-in-50 duration-200">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        {t('account', 'currentPasswordLabel')}
                      </label>
                      <div className="relative">
                        <input
                          type={showCurrentPassword ? 'text' : 'password'}
                          required
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full border border-slate-200 rounded-xl pl-4 pr-10 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/50 focus:border-[#D4AF37] transition-all bg-white"
                        />
                        <button
                          type="button"
                          onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        {t('account', 'newPasswordLabel')}
                      </label>
                      <div className="relative">
                        <input
                          type={showNewPassword ? 'text' : 'password'}
                          required
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full border border-slate-200 rounded-xl pl-4 pr-10 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/50 focus:border-[#D4AF37] transition-all bg-white"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      {t('account', 'confirmPasswordLabel')}
                    </label>
                    <input
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/50 focus:border-[#D4AF37] transition-all bg-white"
                    />
                  </div>

                  {passwordFeedback && (
                    <div
                      className={`p-3 rounded-xl flex items-center gap-2.5 text-xs font-medium ${
                        passwordFeedback.type === 'success'
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : 'bg-rose-50 text-rose-800 border border-rose-200'
                      }`}
                    >
                      {passwordFeedback.type === 'success' ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                      )}
                      <span>{passwordFeedback.message}</span>
                    </div>
                  )}

                  <div className="flex justify-end pt-2">
                    <button
                      type="submit"
                      disabled={updateProfileMutation.isPending || !currentPassword || !newPassword || !confirmPassword}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {updateProfileMutation.isPending ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-[#D4AF37]" />
                          {t('account', 'updatingPassword')}
                        </>
                      ) : (
                        <>
                          <Lock className="w-3.5 h-3.5 text-[#D4AF37]" />
                          {t('account', 'updatePassword')}
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Session Management & Sign Out */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-900">{t('account', 'signOutOfSession')}</div>
                <div className="text-xs text-slate-500 mt-0.5">{t('account', 'signOutSessionDesc')}</div>
              </div>
              <button
                type="button"
                onClick={() => {
                  logout()
                  router.push('/')
                }}
                className="px-4 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition-colors cursor-pointer border border-rose-200/60"
              >
                {t('account', 'signOut')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MODAL 1: CANCELLATION WITH REFUND ELIGIBILITY BREAKDOWN */}
      {cancellingBooking && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2 text-rose-600 font-bold text-base">
                <ShieldAlert className="w-5 h-5" /> {t('account', 'cancelReservation')}
              </div>
              <button
                onClick={() => setCancellingBooking(null)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 mb-4">
              {t('account', 'cancelConfirmPrefix')}{' '}
              <strong>{cancellingBooking.hotel?.name || t('account', 'thisHotel')}</strong>
              {t('account', 'cancelConfirmSuffix')}
            </p>

            {/* Authoritative Refund Disclosure (Section 1 & Contract 2.D) */}
            {(() => {
              const refund = calculateRefundEligibility(
                cancellingBooking.checkIn,
                cancellingBooking.totalPrice,
              )
              return (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 mb-6">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
                      {t('account', 'refundPolicyEligibility')}
                    </span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
                      {t('account', refund.badge)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600">{t('account', refund.description)}</p>
                  <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs">
                    <span className="text-slate-500">{t('account', 'estimatedRefund')}</span>
                    <span className="font-serif font-bold text-[#0F2942] text-sm">
                      {formatEthiopianBirr(refund.refundAmount)}
                    </span>
                  </div>
                </div>
              )
            })()}

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setCancellingBooking(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50"
              >
                {t('account', 'keepStay')}
              </button>
              <button
                type="button"
                disabled={cancelBookingMutation.isPending}
                onClick={handleConfirmCancel}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-sm disabled:opacity-50 cursor-pointer"
              >
                {cancelBookingMutation.isPending ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> {t('account', 'cancelling')}
                  </>
                ) : (
                  t('account', 'confirmCancellation')
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: SPECIAL STAY REQUEST */}
      {stayRequestBooking && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="font-serif text-lg font-bold text-[#0F2942]">{t('account', 'specialStayRequest')}</h3>
              <button
                onClick={() => setStayRequestBooking(null)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleStayRequestSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  {t('account', 'requestType')}
                </label>
                <select
                  value={stayRequestType}
                  onChange={(e) => setStayRequestType(e.target.value as any)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#0F2942]"
                >
                  <option value="EARLY_CHECK_IN">{t('account', 'earlyCheckIn')}</option>
                  <option value="LATE_CHECK_OUT">{t('account', 'lateCheckOut')}</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  {t('account', 'requestedTime')}
                </label>
                <input
                  type="time"
                  required
                  value={stayRequestTime}
                  onChange={(e) => setStayRequestTime(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#0F2942]"
                />
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900">
                {t('account', 'stayRequestNotice')}
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setStayRequestBooking(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold"
                >
                  {t('account', 'cancelLabel')}
                </button>
                <button
                  type="submit"
                  disabled={createStayRequestMutation.isPending}
                  className="px-5 py-2 rounded-xl bg-[#0F2942] hover:bg-[#163859] text-white text-xs font-bold"
                >
                  {createStayRequestMutation.isPending
                    ? t('account', 'submitting')
                    : t('account', 'submitRequest')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: MODIFY STAY DATES */}
      {modifyingBooking && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="font-serif text-lg font-bold text-[#0F2942]">{t('account', 'modifyStayDates')}</h3>
              <button
                onClick={() => setModifyingBooking(null)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleModifySubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  {t('account', 'newCheckInDate')}
                </label>
                <input
                  type="date"
                  required
                  value={modCheckIn}
                  onChange={(e) => setModCheckIn(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#0F2942]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  {t('account', 'newCheckOutDate')}
                </label>
                <input
                  type="date"
                  required
                  min={modCheckIn}
                  value={modCheckOut}
                  onChange={(e) => setModCheckOut(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#0F2942]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  {t('account', 'reasonForModification')}
                </label>
                <textarea
                  rows={2}
                  placeholder={t('account', 'reasonPlaceholder')}
                  value={modReason}
                  onChange={(e) => setModReason(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#0F2942] resize-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModifyingBooking(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold"
                >
                  {t('account', 'cancelLabel')}
                </button>
                <button
                  type="submit"
                  disabled={modifyBookingMutation.isPending}
                  className="px-5 py-2 rounded-xl bg-[#0F2942] hover:bg-[#163859] text-white text-xs font-bold"
                >
                  {modifyBookingMutation.isPending
                    ? t('account', 'saving')
                    : t('account', 'applyDateChanges')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: LEAVE VERIFIED REVIEW */}
      {reviewBooking && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="font-serif text-lg font-bold text-[#0F2942]">{t('account', 'verifiedGuestReview')}</h3>
              <button
                onClick={() => setReviewBooking(null)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500 mb-4">
              {t('account', 'reviewIntroPrefix')}{' '}
              <strong>{reviewBooking.hotel?.name}</strong>
              {t('account', 'reviewIntroSuffix')}
            </p>

            <form onSubmit={handleReviewSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  {t('account', 'rating')}
                </label>
                <div className="flex items-center gap-1.5">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setReviewRating(star)}
                      className="p-1 text-2xl transition-colors cursor-pointer"
                    >
                      <Star
                        className={`w-6 h-6 ${
                          star <= reviewRating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  {t('account', 'reviewCommentsLabel')}
                </label>
                <textarea
                  rows={4}
                  required
                  placeholder={t('account', 'reviewPlaceholder')}
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-[#0F2942] resize-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setReviewBooking(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold"
                >
                  {t('account', 'cancelLabel')}
                </button>
                <button
                  type="submit"
                  disabled={createReviewMutation.isPending || !reviewComment.trim()}
                  className="px-5 py-2 rounded-xl bg-[#0F2942] hover:bg-[#163859] text-white text-xs font-bold disabled:opacity-50 cursor-pointer"
                >
                  {createReviewMutation.isPending
                    ? t('account', 'publishing')
                    : t('account', 'publishReview')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default function CustomerDashboardPage() {
  const { t } = useLanguage()
  return (
    <AuthGate roles={['CUSTOMER', 'ADMIN']}>

      <Suspense
        fallback={
          <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 text-[#0F2942] animate-spin" />
              <span className="text-slate-500 text-sm">{t('account', 'loadingDashboard')}</span>
            </div>
          </div>
        }
      >
        <CustomerDashboardContent />
      </Suspense>
    </AuthGate>
  )
}
