'use client'

import { useEffect, useMemo, useState, Suspense } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-store'
import { useHotelQuery, useHotelRoomsQuery } from '@/hooks/use-catalog'
import {
  useCheckoutQuoteQuery,
  useCreateBookingMutation,
  useCreateHoldMutation,
  useReleaseHoldMutation,
} from '@/hooks/use-booking'
import {
  useCreatePaymentIntentMutation,
  useMockPaymentCallbackMutation,
  usePaymentStatusPolling,
} from '@/hooks/use-payment'
import { CountdownTimer } from '@/components/domain/CountdownTimer'
import { PriceBreakdownCard } from '@/components/domain/PriceBreakdownCard'
import { ConfirmationPanel } from '@/components/domain/ConfirmationPanel'
import { toast } from '@/components/ui/Toast'
import { formatEthiopianBirr } from '@/lib/currency'
import { useLanguage } from '@/lib/i18n'
import { discoverApi, tripApi, type PlaceItem } from '@/lib/services'
import type { Booking, RoomAvailability } from '@/lib/types'
import type { PaymentMethod } from '@repo/shared-types'
import {
  CreditCard,
  Smartphone,
  Landmark,
  CircleDollarSign,
  Banknote,
  CheckCircle,
  AlertCircle,
  MapPin,
  Navigation,
  Loader2,
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  Tag,
  X,
} from 'lucide-react'

const STEPS = [
  { id: 0, titleKey: 'chooseSuite' },
  { id: 1, titleKey: 'guestInformation' },
  { id: 2, titleKey: 'stepPaymentConfirm' },
  { id: 3, titleKey: 'stepConfirmation' },
]

const FALLBACK_IMAGE =
  'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ef/Swimming_pool_and_main_building_of_Amantaka_luxury_Resort_%26_Hotel_in_Luang_Prabang_Laos.jpg/960px-Swimming_pool_and_main_building_of_Amantaka_luxury_Resort_%26_Hotel_in_Luang_Prabang_Laos.jpg'

function dayOffset(offset: number) {
  const date = new Date()
  date.setHours(12, 0, 0, 0)
  date.setDate(date.getDate() + offset)
  return date.toISOString().slice(0, 10)
}

type PaymentStateMachine =
  | 'idle'
  | 'validating'
  | 'processing'
  | 'awaiting_confirmation'
  | 'succeeded'
  | 'failed'

function BookingWizardContent() {
  const params = useParams()
  const { t } = useLanguage()
  const hotelId = typeof params.hotelId === 'string' ? params.hotelId : ''
  const router = useRouter()
  const searchParams = useSearchParams()
  const user = useAuth((s) => s.user)

  // Step state
  const [step, setStep] = useState(0)

  // Booking parameters
  const [checkIn, setCheckIn] = useState(searchParams.get('checkIn') || dayOffset(1))
  const [checkOut, setCheckOut] = useState(searchParams.get('checkOut') || dayOffset(2))
  const [adults, setAdults] = useState(Math.max(1, Number(searchParams.get('guests') || 2)))
  const [children, setChildren] = useState(0)
  const [selectedRoomId, setSelectedRoomId] = useState(searchParams.get('room') ?? '')
  const [promoCodeInput, setPromoCodeInput] = useState('')
  const [appliedPromo, setAppliedPromo] = useState('')
  const [nearbyPlaces, setNearbyPlaces] = useState<PlaceItem[]>([])
  const [nearbyLoading, setNearbyLoading] = useState(false)
  const [nearbyError, setNearbyError] = useState<string | null>(null)
  const [savingNearbyPlaceId, setSavingNearbyPlaceId] = useState<string | null>(null)

  // Guest Information (preserved on 409 conflict)
  const [guestName, setGuestName] = useState(user?.fullName ?? '')
  const [guestEmail, setGuestEmail] = useState(user?.email ?? '')
  const [guestPhone, setGuestPhone] = useState(user?.phone ?? '')

  // Payment State
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CREDIT_CARD')
  const [paymentStatus, setPaymentStatus] = useState<PaymentStateMachine>('idle')
  const [createdBooking, setCreatedBooking] = useState<Booking | null>(null)

  // Simulated gateway fields
  const [cardNumber, setCardNumber] = useState('4242 •••• •••• 4242')
  const [cardExpiry, setCardExpiry] = useState('12/28')
  const [cardCvc, setCardCvc] = useState('123')
  const [telebirrPhone, setTelebirrPhone] = useState(user?.phone || '0911234567')
  const [cbeAccount, setCbeAccount] = useState('100023456789')
  const [paypalEmail, setPaypalEmail] = useState(user?.email || 'guest@example.com')

  // Hold timer state
  const [activeHoldId, setActiveHoldId] = useState<string | null>(null)
  const [holdExpired, setHoldExpired] = useState(false)
  const [isRefreshingHold, setIsRefreshingHold] = useState(false)

  // General error state
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [conflictMessage, setConflictMessage] = useState<string | null>(null)

  // Auto-dismiss conflict and error banners
  useEffect(() => {
    if (!conflictMessage) return
    const timer = setTimeout(() => setConflictMessage(null), 7000)
    return () => clearTimeout(timer)
  }, [conflictMessage])

  useEffect(() => {
    if (!errorMessage) return
    const timer = setTimeout(() => setErrorMessage(null), 7000)
    return () => clearTimeout(timer)
  }, [errorMessage])

  // Query: Hotel Details
  const { data: hotel, isLoading: isHotelLoading } = useHotelQuery(hotelId)

  useEffect(() => {
    if (hotel?.lat == null || hotel?.lng == null) {
      setNearbyPlaces([])
      return
    }
    let active = true
    setNearbyLoading(true)
    setNearbyError(null)
    discoverApi.nearby({ lat: hotel.lat, lng: hotel.lng, radiusKm: 10, limit: 6 })
      .then((response) => {
        if (active) setNearbyPlaces(response.data)
      })
      .catch((err) => {
        if (active) {
          setNearbyPlaces([])
          setNearbyError(err instanceof Error ? err.message : t('hotel', 'nearbyUnavailable'))
        }
      })
      .finally(() => {
        if (active) setNearbyLoading(false)
      })
    return () => {
      active = false
    }
  }, [hotel?.lat, hotel?.lng])

  // Query: Rooms Availability for given dates
  const {
    data: roomsData,
    isLoading: isRoomsLoading,
    refetch: refetchRooms,
  } = useHotelRoomsQuery(hotelId, {
    startDate: checkIn,
    endDate: checkOut,
  })

  // Filter available rooms
  const availableRooms: RoomAvailability[] = useMemo(() => {
    if (!roomsData) return []
    return roomsData.filter((r) => r.availableAcrossRange)
  }, [roomsData])

  // Select initial room when roomsData loads
  useEffect(() => {
    if (availableRooms.length > 0) {
      if (!selectedRoomId || !availableRooms.some((r) => r.id === selectedRoomId)) {
        setSelectedRoomId(availableRooms[0].id)
      }
    }
  }, [availableRooms, selectedRoomId])

  // Selected Room Object
  const selectedRoom = useMemo(() => {
    return availableRooms.find((r) => r.id === selectedRoomId) ?? null
  }, [availableRooms, selectedRoomId])

  // Query: Authoritative Price Quote
  const quoteInput = useMemo(() => {
    if (!hotelId || !selectedRoomId || !checkIn || !checkOut || checkOut <= checkIn) {
      return null
    }
    return {
      hotelId,
      roomIds: [selectedRoomId],
      checkIn,
      checkOut,
      guests: { adults, children },
      promoCode: appliedPromo || undefined,
    }
  }, [hotelId, selectedRoomId, checkIn, checkOut, adults, children, appliedPromo])

  const {
    data: quote,
    isLoading: isQuoteLoading,
    error: quoteError,
  } = useCheckoutQuoteQuery(quoteInput, Boolean(quoteInput))

  // Mutations
  const createHoldMutation = useCreateHoldMutation()
  const releaseHoldMutation = useReleaseHoldMutation()
  const createBookingMutation = useCreateBookingMutation()
  const createIntentMutation = useCreatePaymentIntentMutation()
  const mockPaymentMutation = useMockPaymentCallbackMutation()

  // Polling query for async payments (Telebirr, CBE Birr)
  const isPollingPayment = paymentStatus === 'awaiting_confirmation' && Boolean(createdBooking?.id)
  const { data: pollingPayment } = usePaymentStatusPolling(
    createdBooking?.id ?? null,
    isPollingPayment,
  )

  // Watch polling status transitions
  useEffect(() => {
    if (isPollingPayment && pollingPayment) {
      if (pollingPayment.status === 'SUCCEEDED') {
        setPaymentStatus('succeeded')
        setHoldExpired(false)
        setStep(3)
      } else if (pollingPayment.status === 'FAILED') {
        setPaymentStatus('failed')
        setErrorMessage(t('hotel', 'paymentFailedMobile'))
      }
    }
  }, [isPollingPayment, pollingPayment, t])

  // Auth Guard
  useEffect(() => {
    if (!user && !isHotelLoading) {
      const returnTo = encodeURIComponent(
        typeof window !== 'undefined'
          ? window.location.pathname + window.location.search
          : `/booking/${hotelId}`,
      )
      router.replace(`/auth?returnTo=${returnTo}`)
    }
  }, [user, isHotelLoading, router, hotelId])

  // Room Hold handlers
  const handleHoldExpire = () => {
    setHoldExpired(true)
    setErrorMessage(t('hotel', 'holdExpiredMessage'))
  }

  const handleRefreshHold = async () => {
    if (!selectedRoomId || !checkIn || !checkOut) return
    setIsRefreshingHold(true)
    setErrorMessage(null)
    try {
      if (activeHoldId) {
        await releaseHoldMutation.mutateAsync(activeHoldId).catch(() => undefined)
      }
      const newHold = await createHoldMutation.mutateAsync({
        roomId: selectedRoomId,
        checkIn,
        checkOut,
      })
      setActiveHoldId(newHold.id)
      setHoldExpired(false)
    } catch {
      // Allow user to proceed with optimistic hold
      setHoldExpired(false)
    } finally {
      setIsRefreshingHold(false)
    }
  }

  // Step 0 -> Step 1
  const proceedToGuestInfo = async () => {
    if (!selectedRoomId) {
      setErrorMessage(t('hotel', 'selectSuiteToContinue'))
      return
    }
    setErrorMessage(null)
    setConflictMessage(null)

    // Acquire 15-min hold
    try {
      const hold = await createHoldMutation.mutateAsync({
        roomId: selectedRoomId,
        checkIn,
        checkOut,
      })
      setActiveHoldId(hold.id)
      setHoldExpired(false)
    } catch {
      // If hold endpoint fails non-critically, still proceed
      setHoldExpired(false)
    }
    setStep(1)
  }

  // Step 1 -> Step 2
  const proceedToPayment = () => {
    if (!guestName.trim()) {
      setErrorMessage(t('hotel', 'guestNameRequired'))
      return
    }
    if (!guestEmail.trim() || !guestEmail.includes('@')) {
      setErrorMessage(t('hotel', 'guestEmailRequired'))
      return
    }
    setErrorMessage(null)
    setStep(2)
  }

  // Apply promo code to quote
  const handleApplyPromo = () => {
    if (!promoCodeInput.trim()) {
      setAppliedPromo('')
      return
    }
    setAppliedPromo(promoCodeInput.trim().toUpperCase())
  }

  // Step 2: Final Submission (Payment & Idempotency)
  const handleFinalPayment = async () => {
    if (paymentStatus === 'processing' || paymentStatus === 'validating') return
    if (holdExpired) {
      setErrorMessage(t('hotel', 'holdExpiredPayment'))
      return
    }

    setPaymentStatus('processing')
    setErrorMessage(null)
    setConflictMessage(null)

    try {
      // 1. Atomic Booking Creation
      const newBooking = await createBookingMutation.mutateAsync({
        hotelId,
        roomIds: [selectedRoomId],
        checkIn,
        checkOut,
        guests: { adults, children },
        guestInfos: [
          {
            fullName: guestName.trim(),
            email: guestEmail.trim(),
            phone: guestPhone.trim() || 'N/A',
          },
        ],
        paymentMethod,
        bookingSource: 'ONLINE',
        ...(quote?.couponCode ? { promoCode: quote.couponCode } : {}),
      })

      setCreatedBooking(newBooking)

      // 2. Payment Intent Initiation
      await createIntentMutation.mutateAsync({
        bookingId: newBooking.id,
        method: paymentMethod,
      })

      // 3. Gateway handling by method
      if (paymentMethod === 'CASH') {
        // Cash bookings are confirmed immediately on front-desk terms
        setPaymentStatus('succeeded')
        setStep(3)
      } else if (paymentMethod === 'TELEBIRR' || paymentMethod === 'CBE_BIRR') {
        // Mobile money: enter polling state
        setPaymentStatus('awaiting_confirmation')
      } else {
        // Credit Card / PayPal: execute mock gateway authorization
        const txnId = `TXN-${Date.now()}`
        await mockPaymentMutation.mutateAsync({
          bookingId: newBooking.id,
          reference: txnId,
          transactionId: `GW-${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
          message: 'Payment completed successfully through secure gateway',
        })

        setPaymentStatus('succeeded')
        setStep(3)
      }
    } catch (err: any) {
      setPaymentStatus('failed')

      // Contract Section 2.A: 409 Conflict Recovery
      // "If inventory is taken by another user during checkout, display conflict alert,
      // preserve non-sensitive guest fields (fullName, email, phone), and return to Step 1"
      if (err?.status === 409 || err?.response?.status === 409) {
        setConflictMessage(t('hotel', 'conflictRoomUnavailable'))
        // Refetch fresh rooms
        void refetchRooms()
        // Send user back to suite selection
        setStep(0)
      } else {
        setErrorMessage(
          err?.message || t('hotel', 'paymentAuthFailed'),
        )
      }
    }
  }

  const handleSaveNearbyPlace = async (place: PlaceItem) => {
    if (!user) {
      toast.info(t('hotel', 'signInRequiredTitle'), t('hotel', 'signInRequiredTripMsg'))
      return
    }
    setSavingNearbyPlaceId(place.id)
    try {
      const trips = await tripApi.list()
      const trip = trips.data[0]
      if (!trip) {
        toast.info(t('hotel', 'createTripFirstTitle'), t('hotel', 'createTripFirstMsg'))
        router.push('/trips')
        return
      }
      const tripStart = trip.startDate.slice(0, 10)
      const tripEnd = trip.endDate.slice(0, 10)
      const dayDate = checkIn >= tripStart && checkIn <= tripEnd ? checkIn : tripStart
      const result = await tripApi.addItem(trip.id, {
        itemType: 'PLACE',
        placeId: place.id,
        title: t('hotel', 'visitPlace', { name: place.name }),
        dayDate,
        startTime: '10:00',
        durationMin: 90,
        currency: 'ETB',
      })
      toast.success(
        result.hasConflict ? t('hotel', 'savedWithConflict') : t('hotel', 'savedToMyTrip'),
        result.hasConflict
          ? t('hotel', 'reviewConflictMsg')
          : t('hotel', 'placeAddedToTripMsg', { name: place.name, trip: trip.title }),
      )
    } catch (err) {
      toast.error(t('hotel', 'unableToSavePlace'), err instanceof Error ? err.message : t('hotel', 'pleaseTryAgain'))
    } finally {
      setSavingNearbyPlaceId(null)
    }
  }

  // For testing: Quick mock trigger when awaiting mobile confirmation
  const handleSimulateMobileApproval = async () => {
    if (!createdBooking?.id) return
    try {
      await mockPaymentMutation.mutateAsync({
        bookingId: createdBooking.id,
        reference: `MOB-${Date.now()}`,
        transactionId: `GW-TEL-${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
        message: 'Simulated mobile wallet pin confirmation approved',
      })
      setPaymentStatus('succeeded')
      setStep(3)
    } catch {
      // Poller will catch it if backend updated
    }
  }

  if (isHotelLoading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] py-12">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="h-10 w-48 bg-slate-200 rounded-xl animate-pulse mb-8" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-4">
              <div className="h-64 bg-white rounded-2xl border border-slate-200 animate-pulse" />
              <div className="h-48 bg-white rounded-2xl border border-slate-200 animate-pulse" />
            </div>
            <div className="h-80 bg-white rounded-2xl border border-slate-200 animate-pulse" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] py-10">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        {/* Step Progress Bar */}
        <div className="flex items-center justify-between mb-8 overflow-x-auto pb-2">
          {STEPS.map((s, idx) => {
            const isActive = step === s.id
            const isDone = step > s.id
            return (
              <div key={s.id} className="flex items-center flex-1 last:flex-none">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                      isDone
                        ? 'bg-emerald-600 text-white'
                        : isActive
                          ? 'bg-[#0F2942] text-[#D4AF37] ring-2 ring-[#D4AF37]/50 ring-offset-2'
                          : 'bg-slate-200 text-slate-500'
                    }`}
                  >
                    {isDone ? <CheckCircle className="w-4 h-4" /> : s.id + 1}
                  </div>
                  <span
                    className={`text-xs font-semibold whitespace-nowrap hidden sm:inline ${
                      isActive
                        ? 'text-[#0F2942]'
                        : isDone
                          ? 'text-emerald-700'
                          : 'text-slate-400'
                    }`}
                  >
                    {t('hotel', s.titleKey)}
                  </span>
                </div>
                {idx < STEPS.length - 1 && (
                  <div
                    className={`h-0.5 flex-1 mx-3 sm:mx-4 transition-colors ${
                      step > idx ? 'bg-emerald-600' : 'bg-slate-200'
                    }`}
                  />
                )}
              </div>
            )
          })}
        </div>

        {/* 15-Minute Room Hold Countdown Timer */}
        {step > 0 && step < 3 && (
          <div className="mb-6">
            <CountdownTimer
              initialSeconds={15 * 60}
              onExpire={handleHoldExpire}
              onRefresh={handleRefreshHold}
              isRefreshing={isRefreshingHold}
            />
          </div>
        )}

        {/* 409 Conflict Banner (Contract 2.A) */}
        {conflictMessage && (
          <div className="mb-6 p-4 rounded-2xl bg-amber-50 border border-amber-300 text-amber-950 text-sm flex items-start justify-between gap-3 shadow-sm animate-in fade-in">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold">{t('hotel', 'inventoryConflictTitle')}</div>
                <p className="mt-0.5 text-xs text-amber-800">{conflictMessage}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setConflictMessage(null)}
              className="text-amber-700 hover:text-amber-950 p-1 rounded-lg hover:bg-amber-100/60 transition-colors shrink-0"
              aria-label={t('hotel', 'dismissNotification')}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* General Error Alert */}
        {errorMessage && !conflictMessage && (
          <div className="mb-6 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center justify-between gap-3 shadow-sm animate-in fade-in">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="text-rose-700 hover:text-rose-900 p-1 rounded-lg hover:bg-rose-100/60 transition-colors shrink-0"
              aria-label={t('hotel', 'dismissNotification')}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* STEP 3: Confirmation Screen */}
        {step === 3 && createdBooking ? (
          <ConfirmationPanel
            booking={createdBooking}
            hotel={hotel}
            roomType={selectedRoom?.type}
            paymentMethod={paymentMethod}
          />
        ) : (
          /* STEP 0, 1, 2 Layout */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              {/* STEP 0: REVIEW SUITE & DATES */}
              {step === 0 && (
                <div className="space-y-6">
                  <div>
                    <h1 className="font-serif text-3xl font-bold text-[#0F2942] mb-1">
                      {t('hotel', 'chooseYourSuite')}
                    </h1>
                    <p className="text-sm text-slate-600">
                      {t('hotel', 'selectRoomAt', { name: hotel?.name || t('hotel', 'thisProperty') })}
                    </p>
                  </div>

                  {/* Dates & Guests Modifier */}
                  <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm grid grid-cols-1 sm:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                        {t('hotel', 'checkInLabel')}
                      </label>
                      <input
                        type="date"
                        min={dayOffset(0)}
                        value={checkIn}
                        onChange={(e) => setCheckIn(e.target.value)}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#0F2942]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                        {t('hotel', 'checkOutLabel')}
                      </label>
                      <input
                        type="date"
                        min={checkIn}
                        value={checkOut}
                        onChange={(e) => setCheckOut(e.target.value)}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#0F2942]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                        {t('hotel', 'adultsLabel')}
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={10}
                        value={adults}
                        onChange={(e) => setAdults(Math.max(1, Number(e.target.value)))}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#0F2942]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                        {t('hotel', 'childrenLabel')}
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={10}
                        value={children}
                        onChange={(e) => setChildren(Math.max(0, Number(e.target.value)))}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#0F2942]"
                      />
                    </div>
                  </div>

                  {/* Promo Code Input */}
                  <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm flex flex-col sm:flex-row gap-2.5">
                    <div className="relative flex-1">
                      <Tag className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                      <input
                        type="text"
                        placeholder={t('hotel', 'promoPlaceholder')}
                        value={promoCodeInput}
                        onChange={(e) => setPromoCodeInput(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-sm uppercase focus:outline-none focus:border-[#0F2942]"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleApplyPromo}
                      className="px-5 py-2 bg-[#0F2942] hover:bg-[#163859] text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer shrink-0"
                    >
                      {t('hotel', 'applyCode')}
                    </button>
                  </div>

                  {/* Room Selection List */}
                  <div className="space-y-4">
                    {isRoomsLoading ? (
                      <div className="space-y-3">
                        {[1, 2].map((i) => (
                          <div
                            key={i}
                            className="h-32 bg-white rounded-2xl border border-slate-200 animate-pulse"
                          />
                        ))}
                      </div>
                    ) : availableRooms.length > 0 ? (
                      availableRooms.map((room) => {
                        const isSelected = selectedRoomId === room.id
                        return (
                          <div
                            key={room.id}
                            onClick={() => setSelectedRoomId(room.id)}
                            className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col sm:flex-row gap-4 items-center bg-white ${
                              isSelected
                                ? 'border-[#0F2942] ring-1 ring-[#0F2942] shadow-md'
                                : 'border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            <div className="relative w-full sm:w-36 h-28 rounded-xl overflow-hidden bg-slate-100 shrink-0">
                              <Image
                                src={room.primaryImageUrl || FALLBACK_IMAGE}
                                alt={room.type}
                                fill
                                className="object-cover"
                              />
                            </div>
                            <div className="flex-1 text-left w-full">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <h3 className="font-bold text-slate-900 capitalize text-base">
                                    {room.type.replace(/_/g, ' ')}
                                  </h3>
                                  <div className="text-xs text-slate-500 mt-0.5">
                                    {t('hotel', room.beds === 1 ? 'roomSpecsSingleBed' : 'roomSpecsMultiBed', { number: room.roomNumber, beds: room.beds, guests: room.capacity })}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="text-base font-bold text-[#0F2942]">
                                    {formatEthiopianBirr(room.basePrice)}
                                  </div>
                                  <div className="text-[11px] text-slate-400">{t('hotel', 'perNight')}</div>
                                </div>
                              </div>

                              <div className="flex flex-wrap gap-1.5 mt-3">
                                {room.amenities.slice(0, 4).map((am) => (
                                  <span
                                    key={am}
                                    className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[11px]"
                                  >
                                    {am}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        )
                      })
                    ) : (
                      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-500">
                        {t('hotel', 'noSuitesSelectedDates')}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* What's around this hotel? */}
              {(nearbyLoading || nearbyError || nearbyPlaces.length > 0) && (
                <section className="mt-8 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm" aria-labelledby="booking-nearby-title">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#D4AF37]">{t('hotel', 'stayExplore')}</p>
                      <h2 id="booking-nearby-title" className="mt-1 font-serif text-xl font-bold text-[#0F2942]">{t('hotel', 'whatsAroundHotel')}</h2>
                      <p className="mt-1 text-xs text-slate-500">{t('hotel', 'whatsAroundDesc')}</p>
                    </div>
                    <Link href="/discover" className="text-xs font-bold text-[#2563EB] hover:underline">{t('hotel', 'browseAll')}</Link>
                  </div>

                  {nearbyLoading && (
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      {[1, 2].map((item) => <div key={item} className="h-28 animate-pulse rounded-xl bg-slate-100" />)}
                    </div>
                  )}

                  {!nearbyLoading && nearbyError && (
                    <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
                      {t('hotel', 'nearbyErrorSuffix', { error: nearbyError })}
                    </div>
                  )}

                  {!nearbyLoading && !nearbyError && nearbyPlaces.length > 0 && (
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      {nearbyPlaces.map((place) => {
                        const distance = place.distanceKm ?? 0
                        const distanceLabel = distance < 1 ? Math.round(distance * 1000) + 'm' : distance.toFixed(1) + ' km'
                        const navigationUrl = 'https://www.google.com/maps/dir/?api=1&destination=' + place.lat + ',' + place.lng
                        return (
                          <article key={place.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                            <div className="flex items-start gap-3">
                              <div className="mt-0.5 rounded-lg bg-[#0F2942]/5 p-2 text-[#0F2942]">
                                <MapPin className="h-4 w-4" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <Link href={'/discover/' + place.id} className="truncate text-sm font-bold text-[#0F2942] hover:text-[#2563EB]">
                                  {place.name}
                                </Link>
                                <p className="mt-1 text-[11px] text-slate-500">{place.category} · {distanceLabel} · {place.source?.name || t('hotel', 'verifiedSource')}</p>
                              </div>
                            </div>
                            <div className="mt-3 flex items-center gap-2 border-t border-slate-200 pt-3">
                              <button
                                type="button"
                                onClick={() => void handleSaveNearbyPlace(place)}
                                disabled={savingNearbyPlaceId === place.id}
                                className="inline-flex flex-1 items-center justify-center rounded-lg bg-[#0F2942] px-2.5 py-2 text-[11px] font-bold text-white hover:bg-[#1E3A5F] disabled:opacity-50"
                              >
                                {savingNearbyPlaceId === place.id ? t('hotel', 'savingEllipsis') : t('hotel', 'saveToTrip')}
                              </button>
                              <a
                                href={navigationUrl}
                                target="_blank"
                                rel="noreferrer"
                                aria-label={t('hotel', 'navigateTo', { name: place.name })}
                                className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[11px] font-bold text-slate-700 hover:bg-slate-100"
                              >
                                <Navigation className="mr-1 h-3.5 w-3.5 text-[#D4AF37]" /> {t('hotel', 'goLabel')}
                              </a>
                            </div>
                          </article>
                        )
                      })}
                    </div>
                  )}
                </section>
              )}

              {/* STEP 1: GUEST INFORMATION */}
              {step === 1 && (
                <div className="space-y-6">
                  <div>
                    <h1 className="font-serif text-3xl font-bold text-[#0F2942] mb-1">
                      {t('hotel', 'guestInformation')}
                    </h1>
                    <p className="text-sm text-slate-600">
                      {t('hotel', 'guestInfoSubtitle')}
                    </p>
                  </div>

                  <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                        {t('hotel', 'fullNameLabel')}
                      </label>
                      <input
                        type="text"
                        value={guestName}
                        onChange={(e) => setGuestName(e.target.value)}
                        placeholder={t('hotel', 'fullNamePlaceholder')}
                        className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#0F2942]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                        {t('hotel', 'emailLabel')}
                      </label>
                      <input
                        type="email"
                        value={guestEmail}
                        onChange={(e) => setGuestEmail(e.target.value)}
                        placeholder={t('hotel', 'emailPlaceholder')}
                        className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#0F2942]"
                      />
                      <p className="text-[11px] text-slate-400 mt-1">
                        {t('hotel', 'emailHelper')}
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                        {t('hotel', 'phoneLabel')}
                      </label>
                      <input
                        type="tel"
                        value={guestPhone}
                        onChange={(e) => setGuestPhone(e.target.value)}
                        placeholder={t('hotel', 'phonePlaceholder')}
                        className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#0F2942]"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 2: PAYMENT & IDEMPOTENCY */}
              {step === 2 && (
                <div className="space-y-6">
                  <div>
                    <h1 className="font-serif text-3xl font-bold text-[#0F2942] mb-1">
                      {t('hotel', 'paymentMethodLabel')}
                    </h1>
                    <p className="text-sm text-slate-600">
                      {t('hotel', 'paymentMethodSubtitle')}
                    </p>
                  </div>

                  {/* Payment Gateway Selector */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {[
                      { id: 'CREDIT_CARD', label: t('hotel', 'creditCardLabel'), icon: CreditCard },
                      { id: 'TELEBIRR', label: t('hotel', 'telebirrLabel'), icon: Smartphone },
                      { id: 'CBE_BIRR', label: t('hotel', 'cbeBirrLabel'), icon: Landmark },
                      { id: 'PAYPAL', label: t('hotel', 'paypalLabel'), icon: CircleDollarSign },
                      { id: 'CASH', label: t('hotel', 'cashAtHotelLabel'), icon: Banknote },
                    ].map((method) => {
                      const Icon = method.icon
                      const isSelected = paymentMethod === method.id
                      return (
                        <button
                          key={method.id}
                          type="button"
                          onClick={() => setPaymentMethod(method.id as PaymentMethod)}
                          className={`p-4 rounded-2xl border-2 text-center transition-all cursor-pointer ${
                            isSelected
                              ? 'border-[#0F2942] bg-[#0F2942]/5 text-[#0F2942]'
                              : 'border-slate-200 hover:border-slate-300 text-slate-600 bg-white'
                          }`}
                        >
                          <Icon
                            className={`w-6 h-6 mx-auto mb-1.5 ${
                              isSelected ? 'text-[#0F2942]' : 'text-slate-400'
                            }`}
                          />
                          <div className="text-xs font-bold">{method.label}</div>
                        </button>
                      )
                    })}
                  </div>

                  {/* Dynamic Gateway Inputs */}
                  <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-4">
                    {paymentMethod === 'CREDIT_CARD' && (
                      <div className="space-y-4">
                        <div className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                          {t('hotel', 'cardholderDetails')}
                        </div>
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">{t('hotel', 'cardNumberLabel')}</label>
                          <input
                            type="text"
                            value={cardNumber}
                            onChange={(e) => setCardNumber(e.target.value)}
                            className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-mono focus:outline-none focus:border-[#0F2942]"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs text-slate-500 mb-1">{t('hotel', 'expiryLabel')}</label>
                            <input
                              type="text"
                              value={cardExpiry}
                              onChange={(e) => setCardExpiry(e.target.value)}
                              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-mono focus:outline-none focus:border-[#0F2942]"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-slate-500 mb-1">{t('hotel', 'cvcLabel')}</label>
                            <input
                              type="text"
                              value={cardCvc}
                              onChange={(e) => setCardCvc(e.target.value)}
                              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-mono focus:outline-none focus:border-[#0F2942]"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {paymentMethod === 'TELEBIRR' && (
                      <div className="space-y-3">
                        <div className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                          {t('hotel', 'telebirrMobilePayment')}
                        </div>
                        <p className="text-xs text-slate-500">
                          {t('hotel', 'telebirrDesc')}
                        </p>
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">
                            {t('hotel', 'telebirrPhoneLabel')}
                          </label>
                          <input
                            type="tel"
                            value={telebirrPhone}
                            onChange={(e) => setTelebirrPhone(e.target.value)}
                            className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-mono focus:outline-none focus:border-[#0F2942]"
                          />
                        </div>
                      </div>
                    )}

                    {paymentMethod === 'CBE_BIRR' && (
                      <div className="space-y-3">
                        <div className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                          {t('hotel', 'cbeBirrTitle')}
                        </div>
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">
                            {t('hotel', 'cbeAccountLabel')}
                          </label>
                          <input
                            type="text"
                            value={cbeAccount}
                            onChange={(e) => setCbeAccount(e.target.value)}
                            className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-mono focus:outline-none focus:border-[#0F2942]"
                          />
                        </div>
                      </div>
                    )}

                    {paymentMethod === 'PAYPAL' && (
                      <div className="space-y-3">
                        <div className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                          {t('hotel', 'paypalAccountTitle')}
                        </div>
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">{t('hotel', 'paypalEmailLabel')}</label>
                          <input
                            type="email"
                            value={paypalEmail}
                            onChange={(e) => setPaypalEmail(e.target.value)}
                            className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#0F2942]"
                          />
                        </div>
                      </div>
                    )}

                    {paymentMethod === 'CASH' && (
                      <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs leading-relaxed">
                        <div className="font-bold mb-1">{t('hotel', 'payAtFrontDesk')}</div>
                        {t('hotel', 'cashNotice')}
                      </div>
                    )}
                  </div>

                  {/* Telebirr / CBE Birr Polling Modal / Status Notice */}
                  {paymentStatus === 'awaiting_confirmation' && (
                    <div className="p-5 rounded-2xl bg-[#0F2942]/5 border border-[#0F2942]/20 text-center space-y-3 animate-in fade-in">
                      <div className="w-10 h-10 rounded-full bg-[#0F2942] text-white flex items-center justify-center mx-auto">
                        <Loader2 className="w-5 h-5 animate-spin text-[#D4AF37]" />
                      </div>
                      <div className="font-semibold text-sm text-[#0F2942]">
                        {t('hotel', 'awaitingMobileConfirmation')}
                      </div>
                      <p className="text-xs text-slate-500 max-w-sm mx-auto">
                        {t('hotel', 'pollingStatusMsg')}
                      </p>
                      <button
                        type="button"
                        onClick={handleSimulateMobileApproval}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                      >
                        {t('hotel', 'simulateApproval')}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Wizard Nav Controls */}
              <div className="flex items-center justify-between mt-8 pt-4 border-t border-slate-200">
                {step > 0 ? (
                  <button
                    type="button"
                    onClick={() => {
                      setErrorMessage(null)
                      setStep((s) => Math.max(0, s - 1))
                    }}
                    disabled={paymentStatus === 'processing'}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 text-sm font-semibold transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <ArrowLeft className="w-4 h-4" /> {t('hotel', 'backLabel')}
                  </button>
                ) : (
                  <div />
                )}

                {step === 0 && (
                  <button
                    type="button"
                    onClick={proceedToGuestInfo}
                    disabled={!selectedRoomId || isQuoteLoading}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#0F2942] hover:bg-[#163859] text-white text-sm font-bold transition-colors shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    {t('hotel', 'continueToGuestInfo')} <ArrowRight className="w-4 h-4" />
                  </button>
                )}

                {step === 1 && (
                  <button
                    type="button"
                    onClick={proceedToPayment}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#0F2942] hover:bg-[#163859] text-white text-sm font-bold transition-colors shadow-sm cursor-pointer"
                  >
                    {t('hotel', 'continueToPayment')} <ArrowRight className="w-4 h-4" />
                  </button>
                )}

                {step === 2 && (
                  <button
                    type="button"
                    onClick={handleFinalPayment}
                    disabled={
                      paymentStatus === 'processing' ||
                      paymentStatus === 'awaiting_confirmation' ||
                      holdExpired
                    }
                    className="inline-flex items-center gap-2 px-8 py-3 rounded-xl bg-[#0F2942] hover:bg-[#163859] text-white text-sm font-bold transition-colors shadow-md shadow-[#0F2942]/10 cursor-pointer disabled:opacity-50"
                  >
                    {paymentStatus === 'processing' ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-[#D4AF37]" />
                        {t('hotel', 'authorizingPayment')}
                      </>
                    ) : (
                      <>
                        {t('hotel', 'confirmAndPay', { amount: quote?.total ? formatEthiopianBirr(quote.total) : '' })}
                        <ShieldCheck className="w-4 h-4 text-[#D4AF37]" />
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Authoritative Price Breakdown Sidebar */}
            <div className="lg:col-span-1">
              <PriceBreakdownCard
                quote={quote ?? null}
                hotel={hotel ?? null}
                roomType={selectedRoom?.type}
                checkIn={checkIn}
                checkOut={checkOut}
                guests={{ adults, children }}
                isLoading={isQuoteLoading}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function BookingFlowPage() {
  const { t } = useLanguage()
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 text-[#0F2942] animate-spin" />
            <span className="text-slate-500 text-sm">{t('hotel', 'preparingCheckout')}</span>
          </div>
        </div>
      }
    >
      <BookingWizardContent />
    </Suspense>
  )
}
