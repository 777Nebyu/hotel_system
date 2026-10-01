'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Calendar,
  Clock,
  Compass,
  ExternalLink,
  Heart,
  Landmark,
  MapPin,
  Navigation,
  Phone,
  Plus,
  ShieldCheck,
  Sparkles,
  Star,
  UtensilsCrossed,
  X,
} from 'lucide-react'
import { discoverApi, tripApi, type PlaceItem, type Trip } from '@/lib/services'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { toast } from '@/components/ui/Toast'
import { useAuth } from '@/lib/auth-store'
import { useLanguage } from '@/lib/i18n'

const FALLBACK_IMAGE =
  'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9d/Addis_Ababa_from_Entoto_Mountains.jpg/960px-Addis_Ababa_from_Entoto_Mountains.jpg'

export default function DiscoverPlacePage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const { t } = useLanguage()
  const id = typeof params.placeId === 'string' ? params.placeId : ''

  const [place, setPlace] = useState<PlaceItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Add to Itinerary Modal State
  const [modalOpen, setModalOpen] = useState(false)
  const [userTrips, setUserTrips] = useState<Trip[]>([])
  const [selectedTripId, setSelectedTripId] = useState<string>('')
  const [dayDate, setDayDate] = useState<string>('')
  const [startTime, setStartTime] = useState<string>('10:00')
  const [notes, setNotes] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!id) return
    discoverApi
      .place(id)
      .then((res) => {
        setPlace(res)
        setNotes(t('discover', 'exploreNote', { name: res.name }))
      })
      .catch((err) => setError(err?.message || t('discover', 'placeLoadError')))
      .finally(() => setLoading(false))
  }, [id])

  const handleOpenAddModal = async () => {
    if (!user) {
      toast.info(t('discover', 'signInRequired'), t('discover', 'signInToSchedule'))
      return
    }
    setModalOpen(true)
    try {
      const res = await tripApi.list()
      setUserTrips(res.data)
      if (res.data.length > 0) {
        setSelectedTripId(res.data[0].id)
        setDayDate(res.data[0].startDate.slice(0, 10))
      }
    } catch {
      setUserTrips([])
    }
  }

  const handleAddToTrip = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedTripId || !place || !dayDate) return

    setSubmitting(true)
    try {
      await tripApi.addItem(selectedTripId, {
        placeId: place.id,
        title: t('discover', 'visit', { name: place.name }),
        dayDate,
        startTime: startTime || undefined,
        durationMin: 90,
        notes,
        itemType: 'PLACE',
        currency: 'ETB',
      })
      toast.success(t('discover', 'addedTitle'), t('discover', 'addedToTripBody', { name: place.name }))
      setModalOpen(false)
    } catch (err) {
      toast.error(t('discover', 'failedAddPlace'), err instanceof Error ? err.message : t('discover', 'checkTripDates'))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-5xl space-y-6 px-4 py-10 sm:px-6">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="aspect-[16/8] w-full rounded-3xl" />
        <Skeleton className="h-48 w-full rounded-3xl" />
      </main>
    )
  }

  if (error || !place) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16 text-center">
        <p className="text-sm text-red-600">{error || t('discover', 'placeNotFound')}</p>
        <Button className="mt-5" onClick={() => router.push('/discover')}>
          {t('discover', 'backToDiscover')}
        </Button>
      </main>
    )
  }

  const primaryImage = place.images?.[0] || FALLBACK_IMAGE

  return (
    <main className="min-h-[85vh] bg-[#F8FAFC] px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-5xl">
        {/* Navigation Bar */}
        <div className="flex items-center justify-between">
          <Link
            href="/discover"
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#0F2942] hover:text-[#D4AF37] transition"
          >
            <ArrowLeft className="h-4 w-4" /> {t('discover', 'backToDiscover')}
          </Link>
          <Button
            size="sm"
            onClick={handleOpenAddModal}
            className="bg-[#0F2942] text-xs font-bold text-white hover:bg-[#1E3A5F]"
          >
            <Plus className="mr-1 h-3.5 w-3.5 text-[#D4AF37]" /> {t('discover', 'addToItinerary')}
          </Button>
        </div>

        {/* Hero Card */}
        <div className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          {/* Main Photo Banner */}
          <div className="relative aspect-[16/8] bg-slate-100 overflow-hidden">
            <Image
              src={primaryImage}
              alt={place.name}
              fill
              priority
              sizes="(min-width: 1024px) 900px, 100vw"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
            <div className="absolute bottom-6 left-6 right-6 flex flex-wrap items-end justify-between gap-4 text-white">
              <div>
                <span className="rounded-full bg-[#D4AF37] px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[#0F2942]">
                  {place.category}
                </span>
                <h1 className="mt-2 font-serif text-3xl font-bold sm:text-5xl">
                  {place.name}
                </h1>
                {place.amharicName && (
                  <p className="text-base font-semibold text-[#D4AF37] mt-1">
                    {place.amharicName}
                  </p>
                )}
              </div>

              {place.distanceKm !== undefined && (
                <div className="rounded-xl bg-white/20 backdrop-blur-md px-3.5 py-1.5 text-xs font-bold text-white border border-white/30">
                  {t('discover', 'distanceAway', { km: place.distanceKm })}
                </div>
              )}
            </div>
          </div>

          {/* Details Content */}
          <div className="p-6 sm:p-10">
            <div className="flex flex-wrap items-center gap-3">
              {place.hoursVerified && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 border border-emerald-200">
                  <ShieldCheck className="h-3.5 w-3.5" /> {t('discover', 'verifiedHours')}
                </span>
              )}
              {place.priceLevel && (
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                  {t('discover', 'priceLabel', { level: Array(place.priceLevel).fill('$').join('') })}
                </span>
              )}
            </div>

            {/* Description Narrative */}
            <div className="mt-6 space-y-4">
              <h2 className="font-serif text-xl font-bold text-[#0F2942]">{t('discover', 'aboutLandmark')}</h2>
              <p className="max-w-3xl text-sm leading-7 text-slate-700">
                {place.description}
              </p>
              {place.amharicDescription && (
                <p className="max-w-3xl text-sm leading-7 text-slate-500 italic border-l-2 border-[#D4AF37] pl-4">
                  {place.amharicDescription}
                </p>
              )}
            </div>

            {/* Metadata Grid */}
            <div className="mt-8 grid gap-4 border-t border-slate-100 pt-6 text-sm text-slate-600 sm:grid-cols-2">
              <div className="flex items-start gap-2.5">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#D4AF37]" />
                <div>
                  <span className="font-semibold text-slate-800">{t('discover', 'address')}</span>
                  <p className="text-xs text-slate-500 mt-0.5">{place.address}</p>
                </div>
              </div>

              {place.openingHours && (
                <div className="flex items-start gap-2.5">
                  <Clock className="mt-0.5 h-4 w-4 shrink-0 text-[#D4AF37]" />
                  <div>
                    <span className="font-semibold text-slate-800">{t('discover', 'hours')}</span>
                    <p className="text-xs text-slate-500 mt-0.5">{place.openingHours}</p>
                  </div>
                </div>
              )}

              {place.phone && (
                <div className="flex items-start gap-2.5">
                  <Phone className="mt-0.5 h-4 w-4 shrink-0 text-[#D4AF37]" />
                  <div>
                    <span className="font-semibold text-slate-800">{t('discover', 'phone')}</span>
                    <a href={`tel:${place.phone}`} className="block text-xs font-bold text-[#2563EB] hover:underline mt-0.5">
                      {place.phone}
                    </a>
                  </div>
                </div>
              )}

              {place.website && (
                <div className="flex items-start gap-2.5">
                  <ExternalLink className="mt-0.5 h-4 w-4 shrink-0 text-[#D4AF37]" />
                  <div>
                    <span className="font-semibold text-slate-800">{t('discover', 'website')}</span>
                    <a
                      href={place.website}
                      target="_blank"
                      rel="noreferrer"
                      className="block text-xs font-bold text-[#2563EB] hover:underline mt-0.5"
                    >
                      {t('discover', 'visitPortal')}
                    </a>
                  </div>
                </div>
              )}
            </div>

            {/* Authority Licensing & Attribution Box (ROAD-001) */}
            <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-slate-50 p-4 text-xs text-slate-500 border border-slate-200">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                <span>
                  {t('discover', 'sourceLabel')} <strong className="text-[#0F2942]">{place.source?.name || t('discover', 'verifiedOfficialRecords')}</strong>
                  {place.source?.license ? ` · ${place.source.license}` : ` · ${t('discover', 'osmContributors')}`}
                </span>
              </div>
              {place.rating != null && (
                <span className="inline-flex items-center gap-1 font-bold text-amber-600">
                  <Star className="h-3.5 w-3.5 fill-current" /> {t('discover', 'ratingLabel', { rating: place.rating.toFixed(1) })}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Add to Itinerary Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between bg-[#0F2942] px-6 py-4 text-white">
              <h3 className="font-serif text-lg font-bold">{t('discover', 'scheduleLandmark')}</h3>
              <button onClick={() => setModalOpen(false)} className="rounded-lg p-1 text-white/70 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAddToTrip} className="p-6 space-y-4">
              <div className="rounded-2xl bg-slate-50 p-3.5 border border-slate-200">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#D4AF37]">{t('discover', 'selectedPlace')}</p>
                <h4 className="font-serif text-base font-bold text-[#0F2942]">{place.name}</h4>
              </div>

              {userTrips.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-xs text-slate-500 mb-3">{t('discover', 'noItineraryYet')}</p>
                  <Link href="/trips" className="inline-flex items-center gap-1.5 rounded-xl bg-[#0F2942] px-4 py-2 text-xs font-bold text-white">
                    <Plus className="h-3.5 w-3.5" /> {t('discover', 'createTripFirst')}
                  </Link>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-500">{t('discover', 'tripItinerary')}</label>
                    <select
                      value={selectedTripId}
                      onChange={(e) => {
                        setSelectedTripId(e.target.value)
                        const foundTrip = userTrips.find((item) => item.id === e.target.value)
                        if (foundTrip) setDayDate(foundTrip.startDate.slice(0, 10))
                      }}
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-[#D4AF37]"
                      required
                    >
                      {userTrips.map((trip) => (
                        <option key={trip.id} value={trip.id}>
                          {t('discover', 'tripOption', { title: trip.title, from: trip.startDate.slice(0, 10), to: trip.endDate.slice(0, 10) })}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold uppercase text-slate-500">{t('discover', 'date')}</label>
                      <input
                        type="date"
                        value={dayDate}
                        onChange={(e) => setDayDate(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-[#D4AF37]"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase text-slate-500">{t('discover', 'timeSlot')}</label>
                      <input
                        type="time"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-[#D4AF37]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-500">{t('discover', 'note')}</label>
                    <input
                      type="text"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-[#D4AF37]"
                    />
                  </div>

                  <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setModalOpen(false)}
                      className="px-4 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-100 rounded-xl"
                    >
                      {t('discover', 'cancel')}
                    </button>
                    <Button type="submit" loading={submitting} className="bg-[#0F2942] text-xs font-bold text-white hover:bg-[#1E3A5F]">
                      {t('discover', 'confirmAdd')}
                    </Button>
                  </div>
                </>
              )}
            </form>
          </div>
        </div>
      )}
    </main>
  )
}
