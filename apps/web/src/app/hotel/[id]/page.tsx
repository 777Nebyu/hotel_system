'use client'

import * as React from 'react'
import { Suspense } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  useHotelQuery,
  useHotelRoomsQuery,
  useHotelPolicyQuery,
  useHotelReviewsQuery,
  useFavoritesQuery,
  useToggleFavoriteMutation,
} from '@/hooks/use-catalog'
import { useAuth } from '@/lib/auth-store'
import { RoomCard } from '@/components/domain/RoomCard'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Skeleton } from '@/components/ui/Skeleton'
import { ErrorState } from '@/components/ui/ErrorState'
import { EmptyState } from '@/components/ui/EmptyState'
import { toast } from '@/components/ui/Toast'
import { GuestSelector, GuestCount } from '@/components/forms/GuestSelector'
import { formatEthiopianBirr } from '@/lib/currency'
import { apiClient } from '@/lib/axios'
import {
  MapPin,
  Star,
  Heart,
  MessageSquare,
  Shield,
  Clock,
  CheckCircle2,
  Calendar,
  Sparkles,
  ArrowLeft,
  Images,
  Send,
} from 'lucide-react'

const FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1200&h=800&fit=crop&auto=format'

function dayOffset(offset: number) {
  const value = new Date()
  value.setHours(12, 0, 0, 0)
  value.setDate(value.getDate() + offset)
  return value.toISOString().slice(0, 10)
}

function HotelDetailsContent() {
  const params = useParams()
  const id = typeof params.id === 'string' ? params.id : ''
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useAuth()

  // Stay dates & occupancy state
  const [checkIn, setCheckIn] = React.useState(searchParams.get('checkIn') || dayOffset(1))
  const [checkOut, setCheckOut] = React.useState(searchParams.get('checkOut') || dayOffset(3))
  const [guests, setGuests] = React.useState<GuestCount>({
    adults: Math.max(1, Number(searchParams.get('guests') || 2)),
    children: 0,
  })

  const [activeTab, setActiveTab] = React.useState<'suites' | 'amenities' | 'policies' | 'reviews'>('suites')
  const [activeImgIndex, setActiveImgIndex] = React.useState(0)

  // Contact Concierge Modal
  const [contactOpen, setContactOpen] = React.useState(false)
  const [contactSubject, setContactSubject] = React.useState('')
  const [contactMessage, setContactMessage] = React.useState('')
  const [contactSending, setContactSending] = React.useState(false)

  // TanStack Query Hooks
  const { data: hotel, isLoading: hotelLoading, isError: hotelError, error } = useHotelQuery(id)
  const { data: rooms, isLoading: roomsLoading } = useHotelRoomsQuery(id, {
    startDate: checkIn,
    endDate: checkOut,
  })
  const { data: policy } = useHotelPolicyQuery(id)
  const { data: reviewsResponse } = useHotelReviewsQuery(id)

  const { data: favorites } = useFavoritesQuery()
  const toggleFavorite = useToggleFavoriteMutation()

  const isFavorite = React.useMemo(() => {
    return favorites?.some((f) => f.id === id) ?? false
  }, [favorites, id])

  const handleFavoriteClick = () => {
    if (!user) {
      toast.info('Sign in required', 'Please sign in to add hotels to your wishlist.')
      return
    }
    toggleFavorite.mutate({ hotelId: id, isFavorite })
    toast.success(
      isFavorite ? 'Removed from favorites' : 'Saved to favorites',
      `${hotel?.name} updated.`,
    )
  }

  // Calculate stay nights
  const nights = React.useMemo(() => {
    if (!checkIn || !checkOut) return 1
    const diff = Math.ceil(
      (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / (1000 * 60 * 60 * 24),
    )
    return diff > 0 ? diff : 1
  }, [checkIn, checkOut])

  // Images list
  const images = React.useMemo(() => {
    if (hotel?.images && hotel.images.length > 0) {
      return hotel.images.map((img) => img.url)
    }
    return [FALLBACK_IMAGE]
  }, [hotel])

  const effectiveMinPrice = React.useMemo(() => {
    if (!rooms || rooms.length === 0) return 0
    const prices = rooms
      .map((r) => (typeof r.basePrice === 'number' ? r.basePrice : Number(r.basePrice)))
      .filter((p) => !isNaN(p) && p > 0)
    return prices.length > 0 ? Math.min(...prices) : 0
  }, [rooms])

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) {
      toast.info('Sign in required', 'Please sign in to contact the front desk.')
      return
    }
    if (!contactSubject.trim() || !contactMessage.trim()) return

    setContactSending(true)
    try {
      await apiClient.post(`/hotels/${id}/contact`, {
        subject: contactSubject.trim(),
        message: contactMessage.trim(),
      })
      toast.success('Message sent', 'The front desk team has received your message.')
      setContactSubject('')
      setContactMessage('')
      setContactOpen(false)
    } catch (err: any) {
      toast.error('Unable to send message', err?.message || 'Please try again later.')
    } finally {
      setContactSending(false)
    }
  }

  if (hotelLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 space-y-8">
        <Skeleton className="h-6 w-36" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="lg:col-span-2 aspect-[16/10] w-full rounded-3xl" />
          <div className="space-y-4">
            <Skeleton className="h-32 rounded-2xl" />
            <Skeleton className="h-48 rounded-2xl" />
            <Skeleton className="h-40 rounded-2xl" />
          </div>
        </div>
        <Skeleton className="h-12 w-full max-w-md rounded-xl" />
        <div className="space-y-4">
          <Skeleton className="h-48 rounded-3xl" />
          <Skeleton className="h-48 rounded-3xl" />
        </div>
      </div>
    )
  }

  if (hotelError || !hotel) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16">
        <ErrorState
          title="Unable to load property details"
          message={error instanceof Error ? error.message : 'The requested hotel could not be found.'}
          onRetry={() => router.refresh()}
        />
        <div className="mt-6 text-center">
          <Link href="/search">
            <Button variant="primary" leftIcon={<ArrowLeft className="w-4 h-4" />}>
              Back to Search
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  const reviews = reviewsResponse?.data || []
  const availableSuitesCount = rooms?.filter((r) => r.availableAcrossRange ?? true).length || 0

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-10">
      {/* Wayfinding Back Navigation */}
      <div className="flex items-center justify-between">
        <Link
          href="/search"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-[#0F2942] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Search Results</span>
        </Link>

        <button
          onClick={handleFavoriteClick}
          aria-label={isFavorite ? 'Remove from wishlist' : 'Save to wishlist'}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 transition-colors cursor-pointer"
        >
          <Heart
            className={`w-4 h-4 ${isFavorite ? 'fill-red-500 text-red-500' : 'text-slate-400'}`}
          />
          <span>{isFavorite ? 'Saved' : 'Save'}</span>
        </button>
      </div>

      {/* Property Header */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1 bg-[#FEF9E7] text-[#92400E] border border-[#D4AF37]/35 px-2.5 py-0.5 rounded-lg text-xs font-bold">
            <Star className="w-3.5 h-3.5 fill-[#D4AF37] text-[#D4AF37]" />
            <span>{hotel.starRating} Star Luxury</span>
          </div>
          {hotel.averageRating && (
            <span className="px-2.5 py-0.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold">
              {hotel.averageRating.toFixed(1)} ★ Excellent ({hotel.reviewCount} reviews)
            </span>
          )}
        </div>

        <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-[#0F2942]">
          {hotel.name}
        </h1>

        <div className="flex items-center gap-1.5 text-sm text-slate-500">
          <MapPin className="w-4 h-4 text-[#D4AF37] shrink-0" />
          <span>
            {hotel.address}, {hotel.city?.name}, {hotel.city?.country?.name}
          </span>
        </div>
      </div>

      {/* Photo Showcase Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 rounded-3xl overflow-hidden shadow-sm">
        {/* Main Feature Photo */}
        <div className="lg:col-span-3 aspect-[16/10] bg-slate-100 relative overflow-hidden">
          <img
            src={images[activeImgIndex] || images[0]}
            alt={hotel.name}
            className="w-full h-full object-cover transition-all duration-300"
          />
        </div>

        {/* Thumbnail Selector Column */}
        <div className="hidden lg:flex flex-col gap-3 max-h-[500px] overflow-y-auto pr-1">
          {images.map((img, idx) => (
            <button
              key={idx}
              onClick={() => setActiveImgIndex(idx)}
              className={`relative rounded-2xl overflow-hidden aspect-[16/10] shrink-0 border-2 transition-all cursor-pointer ${
                activeImgIndex === idx
                  ? 'border-[#D4AF37] ring-2 ring-[#D4AF37]/30 scale-[1.02]'
                  : 'border-transparent opacity-75 hover:opacity-100'
              }`}
            >
              <img src={img} alt={`View ${idx + 1}`} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      </div>

      {/* Main Grid: Content Tabs + Sticky Reservation Bar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Left 2 Cols: Tabs and Details */}
        <div className="lg:col-span-2 space-y-8">
          {/* Nav Tabs */}
          <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
            {[
              { id: 'suites', label: `Available Suites (${rooms?.length || 0})` },
              { id: 'amenities', label: 'Amenities' },
              { id: 'policies', label: 'Hotel Policies' },
              { id: 'reviews', label: `Guest Reviews (${reviews.length})` },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all cursor-pointer ${
                  activeTab === tab.id
                    ? 'bg-[#0F2942] text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab 1: Available Suites */}
          {activeTab === 'suites' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-serif text-2xl font-bold text-[#0F2942]">Select Your Suite</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Showing availability for {nights} {nights === 1 ? 'night' : 'nights'} ({checkIn} to {checkOut})
                  </p>
                </div>
                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                  {availableSuitesCount} Suites Available
                </span>
              </div>

              {roomsLoading && (
                <div className="space-y-4">
                  {[1, 2].map((i) => (
                    <Skeleton key={i} className="h-44 rounded-3xl" />
                  ))}
                </div>
              )}

              {!roomsLoading && rooms && rooms.length > 0 ? (
                <div className="space-y-4">
                  {rooms.map((room) => (
                    <RoomCard
                      key={room.id}
                      room={room}
                      hotelId={id}
                      checkIn={checkIn}
                      checkOut={checkOut}
                      guests={guests.adults + guests.children}
                    />
                  ))}
                </div>
              ) : (
                !roomsLoading && (
                  <EmptyState
                    title="No suites available for these dates"
                    description="All rooms are reserved across your selected stay window. Please try adjusting your check-in or check-out dates."
                  />
                )
              )}
            </div>
          )}

          {/* Tab 2: Amenities */}
          {activeTab === 'amenities' && (
            <div className="bg-white rounded-3xl p-8 border border-slate-200/80 shadow-sm space-y-6">
              <h3 className="font-serif text-2xl font-bold text-[#0F2942]">
                Property Amenities & Services
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {hotel.amenities && hotel.amenities.length > 0 ? (
                  hotel.amenities.map((amenity) => (
                    <div
                      key={amenity}
                      className="flex items-center gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-100 text-sm font-semibold text-slate-700"
                    >
                      <Sparkles className="w-4 h-4 text-[#D4AF37]" />
                      <span>{amenity}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-400">Standard luxury amenities included.</p>
                )}
              </div>
            </div>
          )}

          {/* Tab 3: Policies */}
          {activeTab === 'policies' && (
            <div className="bg-white rounded-3xl p-8 border border-slate-200/80 shadow-sm space-y-6">
              <h3 className="font-serif text-2xl font-bold text-[#0F2942]">
                Hotel Policies & Guest Rules
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex items-start gap-3">
                  <Clock className="w-5 h-5 text-[#0F2942] shrink-0 mt-0.5" />
                  <div>
                    <h5 className="text-sm font-bold text-[#0F2942]">Check-In / Check-Out</h5>
                    <p className="text-xs text-slate-500 mt-1">
                      Check-in from: <span className="font-semibold text-slate-800">{policy?.checkInTime || '14:00'}</span>
                    </p>
                    <p className="text-xs text-slate-500">
                      Check-out by: <span className="font-semibold text-slate-800">{policy?.checkOutTime || '11:00'}</span>
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex items-start gap-3">
                  <Shield className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <h5 className="text-sm font-bold text-[#0F2942]">Cancellation Terms</h5>
                    <p className="text-xs text-slate-500 mt-1">
                      Free cancellation up to{' '}
                      <span className="font-semibold text-slate-800">
                        {policy?.cancellationWindowDays ?? 3} days
                      </span>{' '}
                      before arrival.
                    </p>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div className="pt-4 border-t border-slate-100">
                <h5 className="text-sm font-bold text-[#0F2942] mb-2">About This Property</h5>
                <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">
                  {hotel.description}
                </p>
              </div>
            </div>
          )}

          {/* Tab 4: Reviews */}
          {activeTab === 'reviews' && (
            <div className="bg-white rounded-3xl p-8 border border-slate-200/80 shadow-sm space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-serif text-2xl font-bold text-[#0F2942]">
                    Verified Guest Reviews
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Ratings and feedback from verified stays
                  </p>
                </div>
                {hotel.averageRating && (
                  <div className="text-right">
                    <span className="text-3xl font-serif font-bold text-[#0F2942]">
                      {hotel.averageRating.toFixed(1)}
                    </span>
                    <span className="text-xs text-slate-400 block">out of 5.0</span>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                {reviews.length > 0 ? (
                  reviews.map((rev) => (
                    <div key={rev.id} className="p-5 rounded-2xl bg-slate-50 border border-slate-100 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-[#0F2942]">
                          {rev.user?.fullName || 'Verified Guest'}
                        </span>
                        <div className="flex gap-0.5 text-amber-400">
                          {Array.from({ length: rev.rating }).map((_, i) => (
                            <Star key={i} className="w-3.5 h-3.5 fill-amber-400" />
                          ))}
                        </div>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">{rev.comment}</p>
                      <span className="text-[10px] text-slate-400 block">
                        Stay completed on {new Date(rev.createdAt).toLocaleDateString()}
                      </span>

                      {rev.response && (
                        <div className="mt-3 ml-4 pl-4 border-l-2 border-[#D4AF37] bg-amber-50/50 rounded-r-xl p-3.5 space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-1.5 font-semibold text-[#0F2942]">
                              <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-[#0F2942] text-[#D4AF37] text-[10px] font-bold">
                                H
                              </span>
                              <span>Response from Hotel Management</span>
                              {rev.respondedBy?.fullName && (
                                <span className="text-slate-400 font-normal">
                                  ({rev.respondedBy.fullName})
                                </span>
                              )}
                            </div>
                            {rev.respondedAt && (
                              <span className="text-[10px] text-slate-400">
                                {new Date(rev.respondedAt).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-700 leading-relaxed italic">
                            &ldquo;{rev.response}&rdquo;
                          </p>
                        </div>
                      )}
                    </div>
                  ))

                ) : (
                  <EmptyState
                    title="No reviews published yet"
                    description="Be the first guest to complete a stay and share your experience."
                  />
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right 1 Col: Sticky Stay Booking Widget */}
        <div className="lg:col-span-1">
          <div className="sticky top-24 bg-white rounded-3xl p-6 shadow-xl border border-slate-200/80 space-y-5">
            <div>
              <span className="text-xs uppercase font-bold tracking-wider text-[#D4AF37]">
                Live Stay Preview
              </span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="font-serif text-3xl font-bold text-[#0F2942]">
                  {effectiveMinPrice > 0 ? formatEthiopianBirr(effectiveMinPrice) : '—'}
                </span>
                <span className="text-xs text-slate-500 font-medium">/ night</span>
              </div>
            </div>

            <div className="space-y-3">
              {/* Check-in input */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#0F2942] mb-1">
                  Check-in
                </label>
                <input
                  type="date"
                  value={checkIn}
                  onChange={(e) => setCheckIn(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-800"
                />
              </div>

              {/* Check-out input */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#0F2942] mb-1">
                  Check-out
                </label>
                <input
                  type="date"
                  min={checkIn}
                  value={checkOut}
                  onChange={(e) => setCheckOut(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-800"
                />
              </div>

              {/* Guest Selector */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#0F2942] mb-1">
                  Occupancy
                </label>
                <GuestSelector value={guests} onChange={setGuests} />
              </div>
            </div>

            {/* Transparent Calculation (Section 8.B.3) */}
            {effectiveMinPrice > 0 && (
              <div className="pt-4 border-t border-slate-100 space-y-2 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>
                    {formatEthiopianBirr(effectiveMinPrice)} × {nights} {nights === 1 ? 'night' : 'nights'}
                  </span>
                  <span className="font-semibold text-slate-800">
                    {formatEthiopianBirr(effectiveMinPrice * nights)}
                  </span>
                </div>
                <div className="flex justify-between text-slate-400 text-[11px]">
                  <span>Taxes & service fees</span>
                  <span>Calculated at checkout</span>
                </div>
              </div>
            )}

            <Button
              variant="gold"
              size="lg"
              className="w-full font-bold shadow-lg"
              onClick={() => setActiveTab('suites')}
            >
              Choose Suite
            </Button>

            <button
              onClick={() => setContactOpen(true)}
              className="w-full text-center text-xs font-semibold text-[#0F2942] hover:text-[#D4AF37] transition-colors flex items-center justify-center gap-1.5 pt-1 cursor-pointer"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Contact Hotel Concierge</span>
            </button>
          </div>
        </div>
      </div>

      {/* Contact Concierge Modal */}
      <Modal
        isOpen={contactOpen}
        onClose={() => setContactOpen(false)}
        title="Contact Front Desk"
        description="Direct dispatch to the hotel management and concierge team."
      >
        <form onSubmit={handleContactSubmit} className="space-y-4 pt-2">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
              Subject
            </label>
            <input
              required
              value={contactSubject}
              onChange={(e) => setContactSubject(e.target.value)}
              placeholder="e.g. Airport Transfer, Early Arrival"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-[#0F2942]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
              Message
            </label>
            <textarea
              required
              rows={4}
              value={contactMessage}
              onChange={(e) => setContactMessage(e.target.value)}
              placeholder="Please state any special inquiries or requests..."
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-[#0F2942]"
            />
          </div>

          <div className="pt-2 flex justify-end gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setContactOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={contactSending}
              leftIcon={<Send className="w-4 h-4" />}
            >
              Send Message
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

export default function HotelDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[80vh] flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-[#D4AF37] border-t-transparent animate-spin" />
        </div>
      }
    >
      <HotelDetailsContent />
    </Suspense>
  )
}
