'use client'

import { useState, useMemo, Suspense } from 'react'
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
import { bookingService } from '@/services/booking.service'
import { formatEthiopianBirr } from '@/lib/currency'
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
} from 'lucide-react'

const FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=600&h=400&fit=crop&auto=format'

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
      badge: 'Full Refund (100%)',
      description: 'Stays cancelled at least 7 days in advance are 100% refundable.',
    }
  }
  if (daysUntil >= 3) {
    return {
      percentage: 50,
      refundAmount: num * 0.5,
      badge: 'Partial Refund (50%)',
      description: 'Stays cancelled 3 to 6 days prior to check-in are eligible for a 50% refund.',
    }
  }
  return {
    percentage: 0,
    refundAmount: 0,
    badge: 'Non-Refundable',
    description: 'Cancellations within 48 hours of check-in are non-refundable under standard policy.',
  }
}

function CustomerDashboardContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const currentTab = (searchParams.get('tab') as DashboardTab) || 'overview'

  const user = useAuth((s) => s.user)
  const logout = useAuth((s) => s.logout)

  const [bookingFilter, setBookingFilter] = useState<BookingFilter>('all')
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

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
      setSuccessMessage('Reservation cancelled successfully. Refund processing has been initiated.')
      setCancellingBooking(null)
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to cancel reservation.')
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
      setSuccessMessage('Stay request submitted to the hotel concierge.')
      setStayRequestBooking(null)
    } catch (err: any) {
      setErrorMessage(err?.message || 'Unable to submit request.')
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
      setSuccessMessage('Stay dates modified successfully.')
      setModifyingBooking(null)
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to modify reservation dates.')
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
      setSuccessMessage('Thank you! Your verified review has been published.')
      setReviewBooking(null)
      setReviewComment('')
      setReviewRating(5)
    } catch (err: any) {
      setErrorMessage(err?.message || 'Unable to submit review.')
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
                  Welcome, {user?.fullName?.split(' ')[0] || 'Valued Guest'}
                </h1>
                <span className="px-2.5 py-0.5 rounded-full bg-[#D4AF37]/20 border border-[#D4AF37]/40 text-[#D4AF37] text-[11px] font-bold uppercase tracking-wider">
                  Luxury Member
                </span>
              </div>
              <p className="text-slate-300 text-xs sm:text-sm mt-1">
                {user?.email} · Manage your verified bookings, wishlist, and payments.
              </p>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-3 gap-3 bg-white/5 border border-white/10 p-3 rounded-2xl backdrop-blur-md">
            <div className="text-center px-3 py-1">
              <div className="text-lg sm:text-xl font-serif font-bold text-[#D4AF37]">
                {upcomingBookings.length}
              </div>
              <div className="text-[11px] text-slate-300">Upcoming</div>
            </div>
            <div className="text-center px-3 py-1 border-x border-white/10">
              <div className="text-lg sm:text-xl font-serif font-bold text-white">
                {bookings.length}
              </div>
              <div className="text-[11px] text-slate-300">Total Stays</div>
            </div>
            <div className="text-center px-3 py-1">
              <div className="text-lg sm:text-xl font-serif font-bold text-[#D4AF37]">
                {favorites.length}
              </div>
              <div className="text-[11px] text-slate-300">Saved</div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Container */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 -mt-8 relative z-20 pb-16">
        {/* Navigation Tabs Bar */}
        <div className="bg-white rounded-2xl p-2 border border-slate-200/80 shadow-sm flex items-center gap-1 overflow-x-auto mb-8">
          {[
            { id: 'overview', label: 'Overview', icon: Building },
            { id: 'bookings', label: 'My Bookings', icon: Calendar, badge: upcomingBookings.length },
            { id: 'wishlist', label: 'Saved Stays', icon: Heart, badge: favorites.length },
            { id: 'payments', label: 'Payment Ledger', icon: CreditCard },
            { id: 'reviews', label: 'Verified Reviews', icon: Star, badge: reviews.length },
            { id: 'profile', label: 'Profile & Security', icon: UserCheck },
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
            <button onClick={() => setSuccessMessage(null)} className="text-emerald-700 hover:text-emerald-900">
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
            <button onClick={() => setErrorMessage(null)} className="text-rose-700 hover:text-rose-900">
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
                <h2 className="font-serif text-xl font-bold text-[#0F2942]">Upcoming Reservation</h2>
                <button
                  onClick={() => router.push('/dashboard?tab=bookings')}
                  className="text-xs font-semibold text-[#0F2942] hover:text-[#D4AF37] flex items-center gap-1 transition-colors"
                >
                  View All Stays <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {upcomingBookings.length > 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col md:flex-row hover:shadow-md transition-shadow">
                  <div className="relative w-full md:w-72 h-48 md:h-auto bg-slate-100 shrink-0">
                    <Image
                      src={upcomingBookings[0].hotel?.images?.[0]?.url || FALLBACK_IMAGE}
                      alt={upcomingBookings[0].hotel?.name || 'Hotel'}
                      fill
                      className="object-cover"
                    />
                  </div>
                  <div className="p-6 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <span className="font-mono text-xs text-slate-400 block mb-1">
                            Reference #{upcomingBookings[0].id.slice(-8)}
                          </span>
                          <h3 className="font-serif text-xl font-bold text-[#0F2942]">
                            {upcomingBookings[0].hotel?.name || 'Luxury Hotel Stay'}
                          </h3>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {upcomingBookings[0].hotel?.address || 'Ethiopia'}
                          </p>
                        </div>
                        <StatusBadge status={upcomingBookings[0].status} />
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-6 pt-4 border-t border-slate-100 text-xs">
                        <div>
                          <span className="text-slate-400 block">Check-in</span>
                          <span className="font-semibold text-slate-900">
                            {formatDate(upcomingBookings[0].checkIn)}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">Check-out</span>
                          <span className="font-semibold text-slate-900">
                            {formatDate(upcomingBookings[0].checkOut)}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">Total Amount</span>
                          <span className="font-bold text-[#0F2942] text-sm">
                            {formatEthiopianBirr(upcomingBookings[0].totalPrice)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2.5 mt-6 pt-4 border-t border-slate-100">
                      <a
                        href={bookingService.getInvoiceDownloadUrl(upcomingBookings[0].id)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors"
                      >
                        <FileDown className="w-3.5 h-3.5 text-[#D4AF37]" /> PDF Invoice
                      </a>
                      <button
                        onClick={() => {
                          setStayRequestBooking(upcomingBookings[0])
                          setStayRequestType('EARLY_CHECK_IN')
                          setStayRequestTime('11:00')
                        }}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
                      >
                        <Clock className="w-3.5 h-3.5 text-[#0F2942]" /> Concierge Request
                      </button>
                      <button
                        onClick={() => setCancellingBooking(upcomingBookings[0])}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-semibold transition-colors ml-auto"
                      >
                        Cancel Stay
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-2xl p-10 border border-slate-200 text-center">
                  <Building className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <h3 className="font-serif text-lg font-bold text-slate-800">No Upcoming Reservations</h3>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-6">
                    You have no active stays scheduled. Explore our handpicked collection of luxury suites across Ethiopia.
                  </p>
                  <Link
                    href="/search"
                    className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#0F2942] hover:bg-[#163859] text-white rounded-xl text-xs font-bold transition-colors shadow-sm"
                  >
                    Discover Stays <Sparkles className="w-3.5 h-3.5 text-[#D4AF37]" />
                  </Link>
                </div>
              )}
            </div>

            {/* Quick Favorites Section */}
            {favorites.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-serif text-xl font-bold text-[#0F2942]">Saved Stays</h2>
                  <button
                    onClick={() => router.push('/dashboard?tab=wishlist')}
                    className="text-xs font-semibold text-[#0F2942] hover:text-[#D4AF37] flex items-center gap-1 transition-colors"
                  >
                    View All ({favorites.length}) <ChevronRight className="w-3.5 h-3.5" />
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
                            <span className="text-[10px] text-slate-400">/night</span>
                          </div>
                          <Link
                            href={`/hotel/${hotel.id}`}
                            className="px-3 py-1.5 bg-[#0F2942] text-white rounded-lg text-xs font-semibold hover:bg-[#163859] transition-colors"
                          >
                            Book Stay
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
                <h2 className="font-serif text-2xl font-bold text-[#0F2942]">Reservation History</h2>
                <p className="text-xs text-slate-500">
                  Track and manage all your confirmed, completed, and cancelled reservations.
                </p>
              </div>

              {/* Sub-tabs filter */}
              <div className="bg-white rounded-xl p-1 border border-slate-200 shadow-sm flex items-center gap-1">
                {(
                  [
                    { id: 'all', label: 'All Stays' },
                    { id: 'upcoming', label: 'Upcoming' },
                    { id: 'completed', label: 'Completed' },
                    { id: 'cancelled', label: 'Cancelled' },
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
                    {f.label}
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
                          alt={b.hotel?.name || 'Hotel'}
                          fill
                          className="object-cover"
                        />
                      </div>

                      <div className="p-5 flex-1 flex flex-col justify-between">
                        <div>
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <span className="font-mono text-[11px] text-slate-400 block mb-0.5">
                                Booking #{b.id.slice(-8)}
                              </span>
                              <h3 className="font-serif text-lg font-bold text-[#0F2942]">
                                {b.hotel?.name || 'Luxury Hotel Reservation'}
                              </h3>
                              <p className="text-xs text-slate-500">{b.hotel?.address || 'Ethiopia'}</p>
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
                              {b.details?.[0]?.room?.type?.replace(/_/g, ' ') || 'Luxury Suite'}
                            </span>
                            <span className="font-bold text-[#0F2942]">
                              {formatEthiopianBirr(b.totalPrice)}
                            </span>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t border-slate-100">
                          <a
                            href={bookingService.getInvoiceDownloadUrl(b.id)}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors"
                          >
                            <FileDown className="w-3.5 h-3.5 text-[#D4AF37]" /> PDF Invoice
                          </a>

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
                                <Clock className="w-3.5 h-3.5 text-[#0F2942]" /> Concierge Request
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
                                Modify Dates
                              </button>

                              <button
                                onClick={() => setCancellingBooking(b)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-semibold transition-colors ml-auto"
                              >
                                Cancel Stay
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
                              <Star className="w-3.5 h-3.5 text-[#D4AF37]" /> Leave Review
                            </button>
                          )}

                          {isCancelled && (
                            <Link
                              href="/search"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors ml-auto"
                            >
                              Book New Stay
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
                <h3 className="font-serif text-lg font-bold text-slate-800">No Reservations Found</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-6">
                  {bookingFilter === 'all'
                    ? 'You have not booked any stays yet.'
                    : `No ${bookingFilter} reservations found in your account.`}
                </p>
                <Link
                  href="/search"
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#0F2942] hover:bg-[#163859] text-white rounded-xl text-xs font-bold transition-colors shadow-sm"
                >
                  Explore Hotels
                </Link>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: WISHLIST / SAVED */}
        {currentTab === 'wishlist' && (
          <div className="space-y-6">
            <div>
              <h2 className="font-serif text-2xl font-bold text-[#0F2942]">Saved Stays</h2>
              <p className="text-xs text-slate-500">
                Your curated collection of preferred luxury properties.
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
                        title="Remove from saved"
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
                          <span className="text-[10px] text-slate-400">/night</span>
                        </div>
                        <Link
                          href={`/hotel/${hotel.id}`}
                          className="px-3.5 py-1.5 bg-[#0F2942] hover:bg-[#163859] text-white rounded-lg text-xs font-semibold transition-colors"
                        >
                          Book Stay
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-2xl p-12 border border-slate-200 text-center">
                <Heart className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h3 className="font-serif text-lg font-bold text-slate-800">No Saved Stays</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-6">
                  Save your favorite properties while searching to quickly revisit and compare them here.
                </p>
                <Link
                  href="/search"
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#0F2942] hover:bg-[#163859] text-white rounded-xl text-xs font-bold transition-colors shadow-sm"
                >
                  Explore Hotels
                </Link>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: PAYMENTS LEDGER */}
        {currentTab === 'payments' && (
          <div className="space-y-6">
            <div>
              <h2 className="font-serif text-2xl font-bold text-[#0F2942]">Payment Ledger</h2>
              <p className="text-xs text-slate-500">
                Complete transactional history with provider references and status records.
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
              <div className="p-4 bg-slate-50/70 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase tracking-wider grid grid-cols-12 gap-2">
                <div className="col-span-5 sm:col-span-4">Transaction / Hotel</div>
                <div className="col-span-3 sm:col-span-3">Method</div>
                <div className="col-span-4 sm:col-span-3 text-right">Amount</div>
                <div className="hidden sm:block sm:col-span-2 text-right">Status</div>
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
                          {p.booking?.hotel?.name || 'Hotel Stay Reservation'}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          {formatDate(p.createdAt)} · Ref: {p.providerRef || p.id.slice(-8)}
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
                  No payment transactions recorded on your account yet.
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 5: VERIFIED REVIEWS */}
        {currentTab === 'reviews' && (
          <div className="space-y-6">
            <div>
              <h2 className="font-serif text-2xl font-bold text-[#0F2942]">My Verified Reviews</h2>
              <p className="text-xs text-slate-500">
                Reviews you have shared with the luxury hospitality community.
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
                          {r.hotel?.name || 'Hotel Stay'}
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
                        Published {formatDate(r.createdAt)}
                      </span>
                    </div>

                    <button
                      onClick={() => deleteReviewMutation.mutate(r.id)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-semibold self-start transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Delete
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-2xl p-12 border border-slate-200 text-center">
                <Star className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h3 className="font-serif text-lg font-bold text-slate-800">No Reviews Published</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                  Once you complete a stay at any of our hotels, you can leave a verified review to help fellow travelers.
                </p>
              </div>
            )}
          </div>
        )}

        {/* TAB 6: PROFILE & SECURITY */}
        {currentTab === 'profile' && (
          <div className="max-w-2xl space-y-6">
            <div>
              <h2 className="font-serif text-2xl font-bold text-[#0F2942]">Profile & Identity</h2>
              <p className="text-xs text-slate-500">
                Manage your personal guest profile information and account security.
              </p>
            </div>

            <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-5">
              <div className="flex items-center gap-4 pb-4 border-b border-slate-100">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#0F2942] to-[#163859] text-white flex items-center justify-center font-serif text-xl font-bold">
                  {user?.fullName?.charAt(0).toUpperCase() || 'G'}
                </div>
                <div>
                  <h3 className="font-serif font-bold text-slate-900 text-lg">{user?.fullName}</h3>
                  <p className="text-xs text-slate-500">{user?.role} Account · Member since {formatDate(user?.createdAt || '')}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                    Full Legal Name
                  </label>
                  <input
                    type="text"
                    disabled
                    value={user?.fullName || ''}
                    className="w-full border border-slate-200 bg-slate-50 rounded-xl px-4 py-2.5 text-sm text-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    disabled
                    value={user?.email || ''}
                    className="w-full border border-slate-200 bg-slate-50 rounded-xl px-4 py-2.5 text-sm text-slate-700"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-slate-900">Sign Out of Session</div>
                  <div className="text-[11px] text-slate-500">Safely terminate active browser access.</div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    logout()
                    router.push('/')
                  }}
                  className="px-4 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition-colors cursor-pointer"
                >
                  Sign Out
                </button>
              </div>
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
                <ShieldAlert className="w-5 h-5" /> Cancel Reservation
              </div>
              <button
                onClick={() => setCancellingBooking(null)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 mb-4">
              Are you sure you want to cancel your stay at{' '}
              <strong>{cancellingBooking.hotel?.name || 'this hotel'}</strong>?
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
                      Refund Policy Eligibility
                    </span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
                      {refund.badge}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600">{refund.description}</p>
                  <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs">
                    <span className="text-slate-500">Estimated Refund:</span>
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
                Keep Stay
              </button>
              <button
                type="button"
                disabled={cancelBookingMutation.isPending}
                onClick={handleConfirmCancel}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-sm disabled:opacity-50 cursor-pointer"
              >
                {cancelBookingMutation.isPending ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Cancelling...
                  </>
                ) : (
                  'Confirm Cancellation'
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
              <h3 className="font-serif text-lg font-bold text-[#0F2942]">Special Stay Request</h3>
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
                  Request Type
                </label>
                <select
                  value={stayRequestType}
                  onChange={(e) => setStayRequestType(e.target.value as any)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#0F2942]"
                >
                  <option value="EARLY_CHECK_IN">Early Check-In</option>
                  <option value="LATE_CHECK_OUT">Late Check-Out</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Requested Time
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
                Special stay adjustments are subject to room housekeeping turnover and hotel manager approval.
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setStayRequestBooking(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createStayRequestMutation.isPending}
                  className="px-5 py-2 rounded-xl bg-[#0F2942] hover:bg-[#163859] text-white text-xs font-bold"
                >
                  {createStayRequestMutation.isPending ? 'Submitting...' : 'Submit Request'}
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
              <h3 className="font-serif text-lg font-bold text-[#0F2942]">Modify Stay Dates</h3>
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
                  New Check-In Date
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
                  New Check-Out Date
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
                  Reason for Modification (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Schedule adjustment"
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
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modifyBookingMutation.isPending}
                  className="px-5 py-2 rounded-xl bg-[#0F2942] hover:bg-[#163859] text-white text-xs font-bold"
                >
                  {modifyBookingMutation.isPending ? 'Saving...' : 'Apply Date Changes'}
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
              <h3 className="font-serif text-lg font-bold text-[#0F2942]">Verified Guest Review</h3>
              <button
                onClick={() => setReviewBooking(null)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500 mb-4">
              Share your experience for your completed stay at <strong>{reviewBooking.hotel?.name}</strong>.
            </p>

            <form onSubmit={handleReviewSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  Rating
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
                  Your Review Comments
                </label>
                <textarea
                  rows={4}
                  required
                  placeholder="Describe your hospitality experience, suite comfort, and cleanliness..."
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
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createReviewMutation.isPending || !reviewComment.trim()}
                  className="px-5 py-2 rounded-xl bg-[#0F2942] hover:bg-[#163859] text-white text-xs font-bold disabled:opacity-50 cursor-pointer"
                >
                  {createReviewMutation.isPending ? 'Publishing...' : 'Publish Review'}
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
  return (
    <AuthGate roles={['CUSTOMER']}>
      <Suspense
        fallback={
          <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 text-[#0F2942] animate-spin" />
              <span className="text-slate-500 text-sm">Loading guest dashboard...</span>
            </div>
          </div>
        }
      >
        <CustomerDashboardContent />
      </Suspense>
    </AuthGate>
  )
}
