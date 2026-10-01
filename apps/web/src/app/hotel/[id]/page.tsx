'use client'

import * as React from 'react'
import { Suspense } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
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
import { useLanguage } from '@/lib/i18n'
import { apiClient } from '@/lib/axios'
import { discoverApi, tripApi, type PlaceItem } from '@/lib/services'
import {
  MapPin,
  Star,
  Heart,
  MessageSquare,
  Navigation,
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
  'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ef/Swimming_pool_and_main_building_of_Amantaka_luxury_Resort_%26_Hotel_in_Luang_Prabang_Laos.jpg/960px-Swimming_pool_and_main_building_of_Amantaka_luxury_Resort_%26_Hotel_in_Luang_Prabang_Laos.jpg'

type NearbyCategory = 'ALL' | 'CAFE' | 'RESTAURANT' | 'HERITAGE' | 'MUSEUM' | 'ATTRACTION'

function dayOffset(offset: number) {
  const value = new Date()
  value.setHours(12, 0, 0, 0)
  value.setDate(value.getDate() + offset)
  return value.toISOString().slice(0, 10)
}

function HotelDetailsContent() {
  const params = useParams()
  const { t } = useLanguage()
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
  const [nearbyPlaces, setNearbyPlaces] = React.useState<PlaceItem[]>([])
  const [nearbyLoading, setNearbyLoading] = React.useState(false)
  const [nearbyError, setNearbyError] = React.useState<string | null>(null)
  const [nearbyCategory, setNearbyCategory] = React.useState<NearbyCategory>('ALL')
  const [savingPlaceId, setSavingPlaceId] = React.useState<string | null>(null)
  const culturePlaces = React.useMemo(() => {
    const filtered = nearbyPlaces.filter((place) => {
      const category = place.category.toUpperCase()
      if (nearbyCategory === 'ALL') {
        return ['CAFE', 'COFFEE', 'RESTAURANT', 'DINING', 'HERITAGE', 'MUSEUM', 'ATTRACTION'].includes(category)
      }
      if (nearbyCategory === 'CAFE') return category === 'CAFE' || category === 'COFFEE'
      return category === nearbyCategory
    })
    return filtered.slice(0, 6)
  }, [nearbyPlaces, nearbyCategory])

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

  const loadNearbyPlaces = React.useCallback(async () => {
    if (hotel?.lat == null || hotel?.lng == null) {
      setNearbyPlaces([])
      setNearbyError(null)
      return
    }
    setNearbyLoading(true)
    setNearbyError(null)
    try {
      const response = await discoverApi.nearby({ lat: hotel.lat, lng: hotel.lng, radiusKm: 10, limit: 30 })
      setNearbyPlaces(response.data)
    } catch (err) {
      setNearbyPlaces([])
      setNearbyError(err instanceof Error ? err.message : t('hotel', 'nearbyLoadError'))
    } finally {
      setNearbyLoading(false)
    }
  }, [hotel?.lat, hotel?.lng, t])

  React.useEffect(() => {
    void loadNearbyPlaces()
  }, [loadNearbyPlaces])

  const { data: favorites } = useFavoritesQuery()
  const toggleFavorite = useToggleFavoriteMutation()

  const isFavorite = React.useMemo(() => {
    return favorites?.some((f) => f.id === id) ?? false
  }, [favorites, id])

  const handleFavoriteClick = () => {
    if (!user) {
      toast.info(t('hotel', 'signInRequiredTitle'), t('hotel', 'signInRequiredWishlistMsg'))
      return
    }
    toggleFavorite.mutate({ hotelId: id, isFavorite })
    toast.success(
      isFavorite ? t('hotel', 'removedFromFavorites') : t('hotel', 'savedToFavorites'),
      t('hotel', 'hotelUpdated', { name: hotel?.name ?? '' }),
    )
  }

  const handleSavePlaceToTrip = async (place: PlaceItem) => {
    if (!user) {
      toast.info(t('hotel', 'signInRequiredTitle'), t('hotel', 'signInRequiredTripPleaseMsg'))
      return
    }
    setSavingPlaceId(place.id)
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
      setSavingPlaceId(null)
    }
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
      toast.info(t('hotel', 'signInRequiredTitle'), t('hotel', 'signInRequiredContactMsg'))
      return
    }
    if (!contactSubject.trim() || !contactMessage.trim()) return

    setContactSending(true)
    try {
      await apiClient.post(`/hotels/${id}/contact`, {
        subject: contactSubject.trim(),
        message: contactMessage.trim(),
      })
      toast.success(t('hotel', 'messageSentTitle'), t('hotel', 'messageSentMsg'))
      setContactSubject('')
      setContactMessage('')
      setContactOpen(false)
    } catch (err: any) {
      toast.error(t('hotel', 'unableToSendMessage'), err?.message || t('hotel', 'pleaseTryAgainLater'))
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
          title={t('hotel', 'unableToLoadDetails')}
          message={error instanceof Error ? error.message : t('hotel', 'hotelNotFoundMsg')}
          onRetry={() => router.refresh()}
        />
        <div className="mt-6 text-center">
          <Link href="/search">
            <Button variant="primary" leftIcon={<ArrowLeft className="w-4 h-4" />}>
              {t('hotel', 'backToSearch')}
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
          <span>{t('hotel', 'backToSearchResults')}</span>
        </Link>

        <button
          onClick={handleFavoriteClick}
          aria-label={isFavorite ? t('hotel', 'removeFromWishlist') : t('hotel', 'saveToWishlist')}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 transition-colors cursor-pointer"
        >
          <Heart
            className={`w-4 h-4 ${isFavorite ? 'fill-red-500 text-red-500' : 'text-slate-400'}`}
          />
          <span>{isFavorite ? t('hotel', 'savedLabel') : t('hotel', 'saveLabel')}</span>
        </button>
      </div>

      {/* Property Header */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1 bg-[#FEF9E7] text-[#92400E] border border-[#D4AF37]/35 px-2.5 py-0.5 rounded-lg text-xs font-bold">
            <Star className="w-3.5 h-3.5 fill-[#D4AF37] text-[#D4AF37]" />
            <span>{t('hotel', 'starLuxury', { rating: hotel.starRating })}</span>
          </div>
          {hotel.averageRating && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold">
              <span>{hotel.averageRating.toFixed(1)}</span>
              <Star className="w-3 h-3 fill-emerald-600 text-emerald-600 inline" />
              <span>{t('hotel', 'excellentReviews', { count: hotel.reviewCount })}</span>
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
          <Image
            src={images[activeImgIndex] || images[0]}
            alt={hotel.name}
            fill
            priority
            sizes="(min-width: 1024px) 75vw, 100vw"
            className="object-cover transition-all duration-300"
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
              <Image src={img} alt={t('hotel', 'imageViewAlt', { number: idx + 1 })} fill sizes="(min-width: 1024px) 22vw, 100vw" className="object-cover" />
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
              { id: 'suites', label: t('hotel', 'availableSuitesTab', { count: rooms?.length || 0 }) },
              { id: 'amenities', label: t('hotel', 'amenitiesTab') },
              { id: 'policies', label: t('hotel', 'hotelPoliciesTab') },
              { id: 'reviews', label: t('hotel', 'guestReviewsTab', { count: reviews.length }) },
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
                  <h3 className="font-serif text-2xl font-bold text-[#0F2942]">{t('hotel', 'selectYourSuite')}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {t('hotel', nights === 1 ? 'availabilityOne' : 'availabilityMany', { nights, checkIn, checkOut })}
                  </p>
                </div>
                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                  {t('hotel', 'suitesAvailable', { count: availableSuitesCount })}
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
                    title={t('hotel', 'noSuitesForDatesTitle')}
                    description={t('hotel', 'noSuitesForDatesDesc')}
                  />
                )
              )}
            </div>
          )}

          {/* Neighborhood & Culture */}
          {activeTab === 'suites' && (nearbyLoading || nearbyError || culturePlaces.length > 0) && (
            <section className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm sm:p-8">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#D4AF37]">{t('hotel', 'neighborhoodCulture')}</p>
                  <h3 className="mt-1 font-serif text-2xl font-bold text-[#0F2942]">{t('hotel', 'exploreNearHotel', { name: hotel.name })}</h3>
                  <p className="mt-1 text-xs text-slate-500">{t('hotel', 'verifiedPlacesNearby')}</p>
                </div>
                <Link href="/discover" className="text-xs font-bold text-[#2563EB] hover:underline">{t('hotel', 'viewAllDiscoverPlaces')}</Link>
              </div>

              <div className="mt-5 flex flex-wrap gap-2" role="group" aria-label={t('hotel', 'nearbyCategoriesLabel')}>
                {([
                  ['ALL', t('hotel', 'catAll')],
                  ['CAFE', t('hotel', 'catCoffee')],
                  ['RESTAURANT', t('hotel', 'catDining')],
                  ['HERITAGE', t('hotel', 'catHeritage')],
                  ['MUSEUM', t('hotel', 'catMuseums')],
                  ['ATTRACTION', t('hotel', 'catAttractions')],
                ] as const).map(([category, label]) => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setNearbyCategory(category)}
                    aria-pressed={nearbyCategory === category}
                    className={'rounded-full border px-3 py-1.5 text-xs font-bold transition ' + (
                      nearbyCategory === category
                        ? 'border-[#0F2942] bg-[#0F2942] text-white'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-[#D4AF37]'
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {nearbyLoading && (
                <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {[1, 2, 3].map((item) => <Skeleton key={item} className="h-64 rounded-2xl" />)}
                </div>
              )}

              {!nearbyLoading && nearbyError && (
                <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-center">
                  <p className="text-sm font-semibold text-amber-900">{nearbyError}</p>
                  <button type="button" onClick={() => void loadNearbyPlaces()} className="mt-3 rounded-xl bg-[#0F2942] px-4 py-2 text-xs font-bold text-white hover:bg-[#1E3A5F]">
                    {t('hotel', 'tryAgain')}
                  </button>
                </div>
              )}

              {!nearbyLoading && !nearbyError && culturePlaces.length === 0 && (
                <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center">
                  <p className="text-sm font-semibold text-[#0F2942]">{t('hotel', 'noPlacesInCategory')}</p>
                  <p className="mt-1 text-xs text-slate-500">{t('hotel', 'tryAnotherCategory')}</p>
                </div>
              )}

              {!nearbyLoading && !nearbyError && culturePlaces.length > 0 && (
                <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {culturePlaces.map((place) => {
                    const distance = place.distanceKm ?? 0
                    const distanceLabel = distance < 1 ? Math.round(distance * 1000) + 'm' : distance.toFixed(1) + ' km'
                    const navigationUrl = 'https://www.google.com/maps/dir/?api=1&destination=' + place.lat + ',' + place.lng
                    return (
                      <article key={place.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                        <Link href={'/discover/' + place.id} className="group block">
                          <div className="relative aspect-[16/9] overflow-hidden bg-slate-200">
                            <Image src={place.images?.[0] || FALLBACK_IMAGE} alt={place.name} fill sizes="(min-width: 768px) 33vw, 100vw" className="object-cover transition duration-300 group-hover:scale-105" />
                            <span className="absolute right-2 top-2 rounded-full bg-white/95 px-2 py-1 text-[10px] font-bold text-[#0F2942]">{t('hotel', 'distanceFromHotel', { distance: distanceLabel })}</span>
                          </div>
                          <div className="p-4">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-[#D4AF37]">{place.category}</p>
                            <h4 className="mt-1 line-clamp-1 font-serif font-bold text-[#0F2942]">{place.name}</h4>
                            <p className="mt-1 line-clamp-1 text-xs text-slate-500">{place.source?.name || t('hotel', 'verifiedRecords')} · {t('hotel', 'verifiedWord')} {place.lastVerifiedAt ? new Date(place.lastVerifiedAt).toLocaleDateString() : t('hotel', 'onPublication')}</p>
                          </div>
                        </Link>
                        <div className="flex gap-2 border-t border-slate-200 bg-white p-3">
                          <button type="button" onClick={() => void handleSavePlaceToTrip(place)} disabled={savingPlaceId === place.id} className="inline-flex flex-1 items-center justify-center rounded-xl bg-[#0F2942] px-3 py-2 text-xs font-bold text-white transition hover:bg-[#1E3A5F] disabled:opacity-50">
                            {savingPlaceId === place.id ? t('hotel', 'savingEllipsis') : t('hotel', 'saveToMyTrip')}
                          </button>
                          <a href={navigationUrl} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50" aria-label={t('hotel', 'navigateTo', { name: place.name })}>
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


          {/* Tab 2: Amenities */}
          {activeTab === 'amenities' && (
            <div className="bg-white rounded-3xl p-8 border border-slate-200/80 shadow-sm space-y-6">
              <h3 className="font-serif text-2xl font-bold text-[#0F2942]">
                {t('hotel', 'propertyAmenitiesTitle')}
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
                  <p className="text-sm text-slate-400">{t('hotel', 'standardAmenitiesMsg')}</p>
                )}
              </div>
            </div>
          )}

          {/* Tab 3: Policies */}
          {activeTab === 'policies' && (
            <div className="bg-white rounded-3xl p-8 border border-slate-200/80 shadow-sm space-y-6">
              <h3 className="font-serif text-2xl font-bold text-[#0F2942]">
                {t('hotel', 'hotelPoliciesTitle')}
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex items-start gap-3">
                  <Clock className="w-5 h-5 text-[#0F2942] shrink-0 mt-0.5" />
                  <div>
                    <h5 className="text-sm font-bold text-[#0F2942]">{t('hotel', 'checkInOutTitle')}</h5>
                    <p className="text-xs text-slate-500 mt-1">
                      {t('hotel', 'checkInFrom')} <span className="font-semibold text-slate-800">{policy?.checkInTime || '14:00'}</span>
                    </p>
                    <p className="text-xs text-slate-500">
                      {t('hotel', 'checkOutBy')} <span className="font-semibold text-slate-800">{policy?.checkOutTime || '11:00'}</span>
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex items-start gap-3">
                  <Shield className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <h5 className="text-sm font-bold text-[#0F2942]">{t('hotel', 'cancellationTerms')}</h5>
                    <p className="text-xs text-slate-500 mt-1">
                      {t('hotel', 'freeCancellationPrefix')}{' '}
                      <span className="font-semibold text-slate-800">
                        {t('hotel', (policy?.cancellationWindowDays ?? 3) === 1 ? 'dayCountOne' : 'dayCountMany', { days: policy?.cancellationWindowDays ?? 3 })}
                      </span>{' '}
                      {t('hotel', 'beforeArrival')}
                    </p>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div className="pt-4 border-t border-slate-100">
                <h5 className="text-sm font-bold text-[#0F2942] mb-2">{t('hotel', 'aboutProperty')}</h5>
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
                    {t('hotel', 'verifiedGuestReviews')}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {t('hotel', 'ratingsFeedbackSubtitle')}
                  </p>
                </div>
                {hotel.averageRating && (
                  <div className="text-right">
                    <span className="text-3xl font-serif font-bold text-[#0F2942]">
                      {hotel.averageRating.toFixed(1)}
                    </span>
                    <span className="text-xs text-slate-400 block">{t('hotel', 'outOfFive')}</span>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                {reviews.length > 0 ? (
                  reviews.map((rev) => (
                    <div key={rev.id} className="p-5 rounded-2xl bg-slate-50 border border-slate-100 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-[#0F2942]">
                          {rev.user?.fullName || t('hotel', 'verifiedGuest')}
                        </span>
                        <div className="flex gap-0.5 text-amber-400">
                          {Array.from({ length: rev.rating }).map((_, i) => (
                            <Star key={i} className="w-3.5 h-3.5 fill-amber-400" />
                          ))}
                        </div>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">{rev.comment}</p>
                      <span className="text-[10px] text-slate-400 block">
                        {t('hotel', 'stayCompletedOn', { date: new Date(rev.createdAt).toLocaleDateString() })}
                      </span>

                      {rev.response && (
                        <div className="mt-3 ml-4 pl-4 border-l-2 border-[#D4AF37] bg-amber-50/50 rounded-r-xl p-3.5 space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-1.5 font-semibold text-[#0F2942]">
                              <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-[#0F2942] text-[#D4AF37] text-[10px] font-bold">
                                H
                              </span>
                              <span>{t('hotel', 'responseFromHotel')}</span>
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
                    title={t('hotel', 'noReviewsTitle')}
                    description={t('hotel', 'noReviewsDescription')}
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
                {t('hotel', 'liveStayPreview')}
              </span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="font-serif text-3xl font-bold text-[#0F2942]">
                  {effectiveMinPrice > 0 ? formatEthiopianBirr(effectiveMinPrice) : '—'}
                </span>
                <span className="text-xs text-slate-500 font-medium">{t('hotel', 'perNightSlash')}</span>
              </div>
            </div>

            <div className="space-y-3">
              {/* Check-in input */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#0F2942] mb-1">
                  {t('hotel', 'checkInLabel')}
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
                  {t('hotel', 'checkOutLabel')}
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
                  {t('hotel', 'occupancyLabel')}
                </label>
                <GuestSelector value={guests} onChange={setGuests} />
              </div>
            </div>

            {/* Transparent Calculation (Section 8.B.3) */}
            {effectiveMinPrice > 0 && (
              <div className="pt-4 border-t border-slate-100 space-y-2 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>
                    {t('hotel', nights === 1 ? 'nightlyCalcOne' : 'nightlyCalcMany', { price: formatEthiopianBirr(effectiveMinPrice), nights })}
                  </span>
                  <span className="font-semibold text-slate-800">
                    {formatEthiopianBirr(effectiveMinPrice * nights)}
                  </span>
                </div>
                <div className="flex justify-between text-slate-400 text-[11px]">
                  <span>{t('hotel', 'taxesServiceFees')}</span>
                  <span>{t('hotel', 'calculatedAtCheckout')}</span>
                </div>
              </div>
            )}

            <Button
              variant="gold"
              size="lg"
              className="w-full font-bold shadow-lg"
              onClick={() => setActiveTab('suites')}
            >
              {t('hotel', 'chooseSuite')}
            </Button>

            <button
              onClick={() => setContactOpen(true)}
              className="w-full text-center text-xs font-semibold text-[#0F2942] hover:text-[#D4AF37] transition-colors flex items-center justify-center gap-1.5 pt-1 cursor-pointer"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>{t('hotel', 'contactConcierge')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Contact Concierge Modal */}
      <Modal
        isOpen={contactOpen}
        onClose={() => setContactOpen(false)}
        title={t('hotel', 'contactFrontDesk')}
        description={t('hotel', 'contactFrontDeskDesc')}
      >
        <form onSubmit={handleContactSubmit} className="space-y-4 pt-2">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
              {t('hotel', 'subjectLabel')}
            </label>
            <input
              required
              value={contactSubject}
              onChange={(e) => setContactSubject(e.target.value)}
              placeholder={t('hotel', 'subjectPlaceholder')}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-[#0F2942]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
              {t('hotel', 'messageLabel')}
            </label>
            <textarea
              required
              rows={4}
              value={contactMessage}
              onChange={(e) => setContactMessage(e.target.value)}
              placeholder={t('hotel', 'messagePlaceholder')}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-[#0F2942]"
            />
          </div>

          <div className="pt-2 flex justify-end gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setContactOpen(false)}
            >
              {t('hotel', 'cancelLabel')}
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={contactSending}
              leftIcon={<Send className="w-4 h-4" />}
            >
              {t('hotel', 'sendMessage')}
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
