'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import {
  Compass,
  CloudOff,
  MapPin,
  Clock,
  ShieldCheck,
  Search,
  Phone,
  Landmark,
  UtensilsCrossed,
  Coffee,
  AlertTriangle,
  HeartPulse,
  Sparkles,
  Info,
  ChevronRight,
  ShieldAlert,
  Map as MapIcon,
  List,
  Plus,
  Calendar,
  Layers,
  Check,
  X,
  SlidersHorizontal,
} from 'lucide-react'
import {
  discoverApi,
  tripApi,
  type PlaceItem,
  type EmergencyContactItem,
  type DestinationItem,
  type DestinationDetail,
  type Trip,
} from '@/lib/services'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { toast } from '@/components/ui/Toast'
import { useAuth } from '@/lib/auth-store'
import { useLanguage } from '@/lib/i18n'
import { formatCacheAge, readCachedValue, writeCachedValue } from '@/lib/offline-cache'

type Tab = 'all' | 'heritage' | 'dining' | 'attractions' | 'emergency'
type ViewMode = 'list' | 'map'

interface DiscoverSnapshot {
  places?: PlaceItem[]
  emergencyContacts?: EmergencyContactItem[]
  destinationDetail?: DestinationDetail | null
}

interface Neighborhood {
  id: string
  name: string
  nameAm: string
  lat: number
  lng: number
  description: string
}

const NEIGHBORHOODS: Neighborhood[] = [
  {
    id: 'all',
    name: 'Addis Ababa (Center)',
    nameAm: 'አዲስ አበባ',
    lat: 9.0105,
    lng: 38.7612,
    description: 'City center & Meskel Square hub',
  },
  {
    id: 'bole',
    name: 'Bole',
    nameAm: 'ቦሌ',
    lat: 8.9950,
    lng: 38.7880,
    description: 'Airport corridor, modern cafes & nightlife',
  },
  {
    id: 'kazanchis',
    name: 'Kazanchis',
    nameAm: 'ካዛንቺስ',
    lat: 9.0175,
    lng: 38.7680,
    description: 'UNECA district, jazz clubs & dining',
  },
  {
    id: 'piazza',
    name: 'Piazza',
    nameAm: 'ፒያሳ',
    lat: 9.0350,
    lng: 38.7520,
    description: 'Historic architecture, Tomoca & jewelers',
  },
  {
    id: 'arat_kilo',
    name: 'Arat Kilo',
    nameAm: 'አራት ኪሎ',
    lat: 9.0380,
    lng: 38.7630,
    description: 'National Museum, palaces & universities',
  },
  {
    id: 'old-airport',
    name: 'Old Airport',
    nameAm: 'አሮጌ አየር ማረፊያ',
    lat: 8.9975,
    lng: 38.7805,
    description: 'Quiet residential streets, galleries & local dining',
  },
  {
    id: 'entoto',
    name: 'Entoto Park',
    nameAm: 'እንጦጦ',
    lat: 9.0850,
    lng: 38.7600,
    description: 'Panoramic mountain viewpoints & eucalyptus forests',
  },
]

const CATEGORY_ICONS: Record<string, any> = {
  HERITAGE: Landmark,
  MUSEUM: Landmark,
  RESTAURANT: UtensilsCrossed,
  CAFE: Coffee,
  COFFEE: Coffee,
  ATTRACTION: Compass,
  SHOPPING: Sparkles,
  HOSPITAL: HeartPulse,
  EMERGENCY: ShieldAlert,
}

function projectPlace(place: PlaceItem, places: PlaceItem[]) {
  const located = places.filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lng))
  const latitudes = located.map((item) => item.lat)
  const longitudes = located.map((item) => item.lng)
  const minLat = Math.min(...latitudes, 8.98)
  const maxLat = Math.max(...latitudes, 9.09)
  const minLng = Math.min(...longitudes, 38.73)
  const maxLng = Math.max(...longitudes, 38.80)
  const latRange = Math.max(maxLat - minLat, 0.01)
  const lngRange = Math.max(maxLng - minLng, 0.01)
  const left = 8 + ((place.lng - minLng) / lngRange) * 84
  const top = 8 + ((maxLat - place.lat) / latRange) * 84
  return {
    left: `${Math.min(92, Math.max(8, left))}%`,
    top: `${Math.min(92, Math.max(8, top))}%`,
  }
}

export default function DiscoverPage() {
  const { user } = useAuth()
  const { t } = useLanguage()
  const [tab, setTab] = useState<Tab>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedNeighborhood, setSelectedNeighborhood] = useState<Neighborhood>(NEIGHBORHOODS[0])
  const [radiusKm, setRadiusKm] = useState<number>(10)
  const [places, setPlaces] = useState<PlaceItem[]>([])
  const [destinations, setDestinations] = useState<DestinationItem[]>([])
  const [selectedDestination, setSelectedDestination] = useState<DestinationItem | null>(null)
  const [destinationDetail, setDestinationDetail] = useState<DestinationDetail | null>(null)
  const [emergencyContacts, setEmergencyContacts] = useState<EmergencyContactItem[]>([])
  const [sources, setSources] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [staleAt, setStaleAt] = useState<number | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null)

  // "Add to Itinerary" Modal State
  const [addToTripModalOpen, setAddToTripModalOpen] = useState(false)
  const [placeToAddToTrip, setPlaceToAddToTrip] = useState<PlaceItem | null>(null)
  const [userTrips, setUserTrips] = useState<Trip[]>([])
  const [selectedTripId, setSelectedTripId] = useState<string>('')
  const [tripItemDate, setTripItemDate] = useState<string>('')
  const [tripItemTime, setTripItemTime] = useState<string>('10:00')
  const [tripItemNotes, setTripItemNotes] = useState<string>('')
  const [addingToTrip, setAddingToTrip] = useState(false)

  const selectedPlace = useMemo(
    () => places.find((place) => place.id === selectedPlaceId) ?? null,
    [places, selectedPlaceId]
  )

  const cacheKey = useMemo(
    () => [
      'discover',
      tab,
      searchQuery.trim().toLowerCase(),
      selectedDestination?.id || 'nearby',
      selectedNeighborhood.id,
      radiusKm,
    ].join(':'),
    [tab, searchQuery, selectedDestination, selectedNeighborhood.id, radiusKm],
  )

  const fetchPlaces = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    setStaleAt(null)
    try {
      if (tab === 'emergency') {
        const res = await discoverApi.emergency({ city: 'Addis Ababa' })
        setEmergencyContacts(res.data)
        writeCachedValue(cacheKey, { emergencyContacts: res.data } satisfies DiscoverSnapshot)
      } else if (searchQuery.trim().length > 1) {
        const res = await discoverApi.search({
          q: searchQuery.trim(),
          cityId: selectedDestination?.id,
        })
        setPlaces(res.data)
        writeCachedValue(cacheKey, { places: res.data } satisfies DiscoverSnapshot)
      } else if (selectedDestination) {
        const res = await discoverApi.destination(selectedDestination.id)
        setDestinationDetail(res)
        const filteredPlaces =
          tab === 'heritage'
            ? res.places.filter((place) => place.category === 'HERITAGE' || place.category === 'MUSEUM')
            : tab === 'dining'
            ? res.places.filter((place) => place.category === 'RESTAURANT' || place.category === 'CAFE')
            : tab === 'attractions'
            ? res.places.filter((place) => place.category === 'ATTRACTION')
            : res.places
        setPlaces(filteredPlaces)
        writeCachedValue(cacheKey, { places: filteredPlaces, destinationDetail: res } satisfies DiscoverSnapshot)
      } else if (tab === 'heritage') {
        const res = await discoverApi.heritage()
        setPlaces(res.data)
        writeCachedValue(cacheKey, { places: res.data } satisfies DiscoverSnapshot)
      } else {
        const res = await discoverApi.nearby({
          lat: selectedNeighborhood.lat,
          lng: selectedNeighborhood.lng,
          radiusKm,
          category:
            tab === 'dining'
              ? 'RESTAURANT'
              : tab === 'attractions'
              ? 'ATTRACTION'
              : undefined,
          limit: 30,
        })
        setPlaces(res.data)
        writeCachedValue(cacheKey, { places: res.data } satisfies DiscoverSnapshot)
      }
    } catch (err) {
      console.error('Failed to load discover data:', err)
      const cached = readCachedValue<DiscoverSnapshot>(cacheKey)
      if (cached) {
        setPlaces(cached.value.places || [])
        setEmergencyContacts(cached.value.emergencyContacts || [])
        setDestinationDetail(cached.value.destinationDetail || null)
        setStaleAt(cached.savedAt)
      } else {
        setLoadError(t('discover', 'loadErrorMessage'))
        setPlaces([])
        setEmergencyContacts([])
        setDestinationDetail(null)
      }
    } finally {
      setLoading(false)
    }
  }, [tab, searchQuery, selectedDestination, selectedNeighborhood, radiusKm, cacheKey])

  useEffect(() => {
    fetchPlaces()
  }, [fetchPlaces])

  useEffect(() => {
    let cancelled = false
    discoverApi.destinations().then((data) => {
      if (!cancelled) {
        const next = Array.isArray(data) ? data : []
        setDestinations(next)
        writeCachedValue('discover:destinations', next)
      }
    }).catch(() => {
      const cached = readCachedValue<DestinationItem[]>('discover:destinations')
      if (!cancelled && cached) setDestinations(cached.value)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    discoverApi.sources().then((data) => {
      setSources(data)
      writeCachedValue('discover:sources', data)
    }).catch(() => {
      const cached = readCachedValue<any[]>('discover:sources')
      if (cached) setSources(cached.value)
    })
  }, [])

  // Open "Add to Itinerary" Modal
  const handleOpenAddModal = async (place: PlaceItem) => {
    if (!user) {
      toast.info(t('discover', 'signInRequired'), t('discover', 'signInToAddPlaces'))
      return
    }
    setPlaceToAddToTrip(place)
    setTripItemNotes(t('discover', 'visitTo', { name: place.name }))
    setAddToTripModalOpen(true)

    try {
      const res = await tripApi.list()
      setUserTrips(res.data)
      if (res.data.length > 0) {
        setSelectedTripId(res.data[0].id)
        setTripItemDate(res.data[0].startDate.slice(0, 10))
      }
    } catch {
      setUserTrips([])
    }
  }

  // Submit "Add to Itinerary"
  const handleConfirmAddToTrip = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedTripId || !placeToAddToTrip || !tripItemDate) return

    setAddingToTrip(true)
    try {
      await tripApi.addItem(selectedTripId, {
        placeId: placeToAddToTrip.id,
        title: t('discover', 'visit', { name: placeToAddToTrip.name }),
        dayDate: tripItemDate,
        startTime: tripItemTime || undefined,
        durationMin: 90,
        notes: tripItemNotes,
        itemType: 'PLACE',
        currency: 'ETB',
      })
      toast.success(
        t('discover', 'addedTitle'),
        t('discover', 'addedBody', { name: placeToAddToTrip.name })
      )
      setAddToTripModalOpen(false)
      setPlaceToAddToTrip(null)
    } catch (err) {
      toast.error(t('discover', 'failedAddPlace'), err instanceof Error ? err.message : t('discover', 'checkTripDates'))
    } finally {
      setAddingToTrip(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* 1. Hero Header */}
      <div className="relative overflow-hidden bg-[#0F2942] text-white pt-24 pb-20 px-4 sm:px-6">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#D4AF37_1px,transparent_1px)] [background-size:16px_16px]" />
        <div className="relative max-w-7xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#D4AF37]/15 border border-[#D4AF37]/30 text-[#D4AF37] text-xs font-semibold uppercase tracking-wider mb-4">
            <Compass className="w-3.5 h-3.5" />
            {t('discover', 'heroBadge')}
          </div>
          <h1 className="font-serif text-3xl sm:text-5xl font-bold tracking-tight text-white mb-4">
            {t('discover', 'title')}
          </h1>
          <p className="text-sm sm:text-base text-slate-300 max-w-2xl leading-relaxed">
            {t('discover', 'heroSubtitle')}
          </p>

          {/* Search bar */}
          <div className="mt-8 max-w-xl relative">
            <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={t('discover', 'searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-white text-[#0F2942] placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-[#D4AF37] shadow-xl"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 hover:text-slate-600"
              >
                {t('discover', 'clear')}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. Destination selector */}
      {destinations.length > 0 && (
        <section className="border-b border-slate-200 bg-white px-4 py-6 sm:px-6" aria-labelledby="destination-selector-title">
          <div className="mx-auto max-w-7xl">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#D4AF37]">{t('discover', 'exploreEthiopia')}</p>
                <h2 id="destination-selector-title" className="mt-1 font-serif text-xl font-bold text-[#0F2942]">
                  {t('discover', 'chooseDestination')}
                </h2>
              </div>
              {selectedDestination && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedDestination(null)
                    setDestinationDetail(null)
                    setPlaces([])
                  }}
                  className="text-xs font-bold text-[#0F2942] underline underline-offset-4 hover:text-[#D4AF37]"
                >
                  {t('discover', 'allDestinations')}
                </button>
              )}
            </div>
            <div className="mt-4 flex gap-3 overflow-x-auto pb-1" role="list" aria-label={t('discover', 'availableDestinations')}>
              {destinations.map((destination) => {
                const selected = selectedDestination?.id === destination.id
                return (
                  <button
                    key={destination.id}
                    type="button"
                    role="listitem"
                    aria-pressed={selected}
                    onClick={() => {
                      setSelectedDestination(destination)
                      setDestinationDetail(null)
                      setTab('all')
                      setSearchQuery('')
                      setViewMode('list')
                    }}
                    className={'relative h-24 min-w-[190px] overflow-hidden rounded-2xl border text-left shadow-sm transition ' + (
                      selected ? 'border-[#D4AF37] ring-2 ring-[#D4AF37]/30' : 'border-slate-200 hover:border-[#D4AF37]'
                    )}
                  >
                    <Image
                      src={
                        destination.heroImage ||
                        'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8b/Sunset_on_the_rising_city%2C_Addis_Ababa_-_Flickr_-_jeanotr.jpg/960px-Sunset_on_the_rising_city%2C_Addis_Ababa_-_Flickr_-_jeanotr.jpg'
                      }
                      alt=""
                      fill
                      sizes="220px"
                      className="object-cover"
                    />
                    <span className="absolute inset-0 bg-[#0F2942]/65" />
                    <span className="absolute inset-x-3 bottom-2 text-white">
                      <span className="block text-sm font-bold">{destination.name}</span>
                      <span className="block text-[10px] text-white/80">
                        {t('discover', 'destinationStats', { hotels: destination.hotelCount, places: destination.placeCount })}
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* 3. Main Content & Filters */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Category Pills */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5">
          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: 'all', label: t('discover', 'tabAll'), icon: Sparkles },
              { id: 'heritage', label: t('discover', 'tabHeritage'), icon: Landmark },
              { id: 'dining', label: t('discover', 'tabDining'), icon: UtensilsCrossed },
              { id: 'attractions', label: t('discover', 'tabAttractions'), icon: Compass },
              { id: 'emergency', label: t('discover', 'tabEmergency'), icon: ShieldAlert },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => {
                  setTab(id as Tab)
                  setSearchQuery('')
                }}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  tab === id
                    ? 'bg-[#0F2942] text-white shadow-md'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>

          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>{t('discover', 'licensingStandard')} <strong>ROAD-001</strong></span>
          </div>
        </div>

        {/* Neighborhood Selector & Radius Slider (When in Places Mode) */}
        {tab !== 'emergency' && !searchQuery && !selectedDestination && (
          <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              {/* Neighborhood Selector Pills */}
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  {t('discover', 'selectNeighborhood')}
                </span>
                <div className="mt-2 flex flex-wrap gap-2">
                  {NEIGHBORHOODS.map((nh) => {
                    const isSelected = selectedNeighborhood.id === nh.id
                    return (
                      <button
                        key={nh.id}
                        onClick={() => setSelectedNeighborhood(nh)}
                        className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
                          isSelected
                            ? 'bg-[#0F2942] text-white shadow-sm'
                            : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
                        }`}
                      >
                        {nh.name}{' '}
                        <span className={`text-[10px] font-normal ${isSelected ? 'text-white/70' : 'text-slate-400'}`}>
                          ({nh.nameAm})
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Radius Slider */}
              <div className="lg:w-64 border-t border-slate-100 pt-3 lg:border-t-0 lg:pt-0">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                  <span>{t('discover', 'radius')}</span>
                  <span className="text-[#0F2942]">{t('discover', 'kilometers', { km: radiusKm })}</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="15"
                  step="1"
                  value={radiusKm}
                  onChange={(e) => setRadiusKm(Number(e.target.value))}
                  className="mt-2 w-full accent-[#0F2942]"
                />
                <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                  <span>{t('discover', 'kilometers', { km: 1 })}</span>
                  <span>{t('discover', 'kilometers', { km: 10 })}</span>
                  <span>{t('discover', 'kilometers', { km: 15 })}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {selectedDestination && destinationDetail && destinationDetail.hotels.length > 0 && tab !== 'emergency' && !searchQuery && (
          <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm" aria-labelledby="destination-hotels-title">
            <div className="flex items-center justify-between gap-3">
              <h2 id="destination-hotels-title" className="font-serif text-lg font-bold text-[#0F2942]">
                {t('discover', 'hotelsIn', { destination: selectedDestination.name })}
              </h2>
              <span className="text-xs text-slate-500">{t('discover', 'activeHotels', { count: destinationDetail.hotels.length })}</span>
            </div>
            <div className="mt-4 flex gap-3 overflow-x-auto pb-1">
              {destinationDetail.hotels.slice(0, 8).map((hotel) => (
                <Link
                  key={hotel.id}
                  href={'/hotel/' + hotel.id}
                  className="min-w-[220px] rounded-2xl border border-slate-200 bg-slate-50 p-3 transition hover:border-[#D4AF37] hover:bg-white"
                >
                  <div className="flex items-center gap-3">
                    <Image
                      src={
                        hotel.images?.[0] ||
                        'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ef/Swimming_pool_and_main_building_of_Amantaka_luxury_Resort_%26_Hotel_in_Luang_Prabang_Laos.jpg/960px-Swimming_pool_and_main_building_of_Amantaka_luxury_Resort_%26_Hotel_in_Luang_Prabang_Laos.jpg'
                      }
                      alt=""
                      width={64}
                      height={56}
                      className="h-14 w-16 rounded-xl object-cover"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-[#0F2942]">{hotel.name}</p>
                      <p className="mt-1 truncate text-[11px] text-slate-500">{'★'.repeat(Math.max(1, hotel.starRating))} · {hotel.address}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Dual View Toggle */}
        {tab !== 'emergency' && (
          <div className="mt-6 flex items-center justify-between gap-3">
            <p className="text-xs text-slate-500">
              {selectedDestination ? t('discover', 'showingIn', { count: places.length, area: selectedDestination.name }) : t('discover', 'showingNear', { count: places.length, area: selectedNeighborhood.name })}
            </p>
            <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm" role="group">
              <button
                type="button"
                aria-pressed={viewMode === 'list'}
                onClick={() => setViewMode('list')}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                  viewMode === 'list' ? 'bg-[#0F2942] text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <List className="h-3.5 w-3.5" /> {t('discover', 'gridView')}
              </button>
              <button
                type="button"
                aria-pressed={viewMode === 'map'}
                onClick={() => setViewMode('map')}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                  viewMode === 'map' ? 'bg-[#0F2942] text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <MapIcon className="h-3.5 w-3.5" /> {t('discover', 'mapView')}
              </button>
            </div>
          </div>
        )}

        {/* 3. Results Section */}
        <div className="mt-6">
          {loading && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((idx) => (
                <div key={idx} className="rounded-3xl bg-white border border-slate-200 p-5 space-y-4">
                  <Skeleton className="aspect-[16/10] w-full rounded-2xl" />
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ))}
            </div>
          )}

          {!loading && staleAt && (
            <div className='mb-5 flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between'>
              <div className='flex items-start gap-2'>
                <CloudOff className='mt-0.5 h-4 w-4 shrink-0 text-amber-700' />
                <span>{t('discover', 'staleBanner', { age: formatCacheAge(staleAt) })}</span>
              </div>
              <Button size='sm' variant='outline' onClick={fetchPlaces}>{t('discover', 'refresh')}</Button>
            </div>
          )}

          {!loading && loadError && (
            <div className="rounded-3xl border border-amber-200 bg-amber-50 p-8 text-center">
              <CloudOff className="mx-auto h-10 w-10 text-amber-700" />
              <h3 className="mt-3 font-serif text-xl font-bold text-[#0F2942]">{t('discover', 'unavailableTitle')}</h3>
              <p className="mx-auto mt-2 max-w-md text-sm text-amber-900">{loadError}</p>
              <Button className="mt-5 bg-[#0F2942] text-white hover:bg-[#1E3A5F]" onClick={fetchPlaces}>{t('discover', 'tryAgain')}</Button>
            </div>
          )}

          {/* EMERGENCY CONTACTS TAB */}
          {!loading && !loadError && tab === 'emergency' && (
            <div className="space-y-6">
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-900 leading-relaxed">
                  <strong>{t('discover', 'safetyDirectoryCode')}</strong> {t('discover', 'contactEntriesNote')} {t('discover', 'visitHubPrefix')} <Link href="/emergency" className="font-bold underline">{t('discover', 'emergencyHubLink')}</Link>{t('discover', 'visitHubSuffix')}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {emergencyContacts.map((contact) => (
                  <div
                    key={contact.id}
                    className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-red-100 text-red-800">
                          {contact.kind}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {contact.city || t('discover', 'national')}
                        </span>
                      </div>
                      <h3 className="font-serif text-lg font-bold text-[#0F2942]">
                        {contact.name}
                      </h3>
                    </div>

                    <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                      <a
                        href={`tel:${contact.phone}`}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-colors"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        {t('discover', 'callNumber', { phone: contact.phone })}
                      </a>
                      <span className="text-[10px] text-slate-400 italic">
                        {contact.source?.name || t('discover', 'verifiedOfficial')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* INTERACTIVE MAP VIEW */}
          {!loading && !loadError && tab !== 'emergency' && places.length > 0 && viewMode === 'map' && (
            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              <div className="relative h-[32rem] overflow-hidden bg-[#e6edf0]" aria-label={t('discover', 'mapAriaLabel')}>
                <div className="absolute inset-0 opacity-50 [background-image:radial-gradient(#0F2942_1px,transparent_1px)] [background-size:24px_24px]" />
                <div className="absolute left-4 top-4 rounded-xl bg-white/90 backdrop-blur-md px-3 py-1.5 text-xs font-bold text-[#0F2942] shadow-sm">
                  {t('discover', 'radiusMapLabel', { area: selectedNeighborhood.name })}
                </div>

                {places.map((place) => {
                  const CategoryIcon = CATEGORY_ICONS[place.category] || Compass
                  const active = selectedPlaceId === place.id
                  return (
                    <button
                      key={place.id}
                      type="button"
                      title={place.name}
                      onClick={() => setSelectedPlaceId(place.id)}
                      style={{ ...projectPlace(place, places), transform: 'translate(-50%, -50%)' }}
                      className={`absolute z-10 flex h-10 w-10 items-center justify-center rounded-full border-2 shadow-lg transition-all ${
                        active
                          ? 'scale-125 border-[#0F2942] bg-[#0F2942] text-white'
                          : 'border-white bg-[#D4AF37] text-[#0F2942] hover:scale-110'
                      }`}
                    >
                      <CategoryIcon className="h-4 w-4" />
                    </button>
                  )
                })}
              </div>

              {selectedPlace && (
                <div className="flex flex-col gap-3 border-t border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between bg-white">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#D4AF37]">
                      {selectedPlace.category} · {selectedPlace.address}
                    </p>
                    <h3 className="truncate font-serif text-xl font-bold text-[#0F2942]">
                      {selectedPlace.name} {selectedPlace.amharicName && `(${selectedPlace.amharicName})`}
                    </h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleOpenAddModal(selectedPlace)}
                      className="bg-[#0F2942] text-xs font-bold text-white hover:bg-[#1E3A5F]"
                    >
                      <Plus className="mr-1 h-3.5 w-3.5 text-[#D4AF37]" /> {t('discover', 'addToItinerary')}
                    </Button>
                    <Link
                      href={`/discover/${selectedPlace.id}`}
                      className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                    >
                      {t('discover', 'details')} <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* PLACES CSS GRID */}
          {!loading && !loadError && tab !== 'emergency' && places.length > 0 && viewMode === 'list' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {places.map((place) => {
                const CategoryIcon = CATEGORY_ICONS[place.category] || Compass
                const primaryImage =
                  place.images && place.images.length > 0
                    ? place.images[0]
                    : 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9d/Addis_Ababa_from_Entoto_Mountains.jpg/960px-Addis_Ababa_from_Entoto_Mountains.jpg'

                return (
                  <div
                    key={place.id}
                    className="group bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between"
                  >
                    <div>
                      {/* Image */}
                      <div className="relative aspect-[16/10] overflow-hidden bg-slate-100">
                        <Image
                          src={primaryImage}
                          alt={place.name}
                          fill
                          sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                          className="object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        <div className="absolute top-3 left-3 flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/60 backdrop-blur-md text-white text-[11px] font-semibold">
                          <CategoryIcon className="w-3.5 h-3.5 text-[#D4AF37]" />
                          <span>{place.category}</span>
                        </div>
                        {place.distanceKm !== undefined && (
                          <div className="absolute bottom-3 right-3 px-2.5 py-1 rounded-full bg-white/90 backdrop-blur-md text-[#0F2942] text-xs font-bold shadow-md">
                            {t('discover', 'kilometers', { km: place.distanceKm })}
                          </div>
                        )}
                      </div>

                      {/* Content */}
                      <div className="p-6">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-serif text-xl font-bold text-[#0F2942] group-hover:text-[#2563EB] transition-colors">
                            {place.name}
                          </h3>
                        </div>

                        {place.amharicName && (
                          <p className="text-xs text-[#D4AF37] font-semibold mt-0.5">
                            {place.amharicName}
                          </p>
                        )}

                        <p className="text-xs text-slate-600 line-clamp-3 mt-3 leading-relaxed">
                          {place.description}
                        </p>

                        <div className="mt-4 pt-4 border-t border-slate-100 space-y-2 text-xs text-slate-500">
                          <div className="flex items-center gap-2">
                            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="truncate">{place.address}</span>
                          </div>

                          {place.openingHours && (
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 truncate">
                                <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span className="truncate">{place.openingHours}</span>
                              </div>
                              <span
                                className={`text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0 ${
                                  place.hoursVerified
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : 'bg-amber-50 text-amber-700'
                                }`}
                              >
                                {place.hoursVerified ? t('discover', 'verified') : t('discover', 'hoursMayVary')}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actions & Attribution (ROAD-001) */}
                    <div className="p-5 bg-slate-50 border-t border-slate-100 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleOpenAddModal(place)}
                          className="flex-1 bg-[#0F2942] text-xs font-bold text-white hover:bg-[#1E3A5F]"
                        >
                          <Plus className="mr-1 h-3.5 w-3.5 text-[#D4AF37]" /> {t('discover', 'addToTrip')}
                        </Button>
                        <Link
                          href={`/discover/${place.id}`}
                          className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100"
                        >
                          {t('discover', 'details')}
                        </Link>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                        <span
                          className="truncate cursor-help underline decoration-dotted underline-offset-2"
                          title={`${place.source?.license || t('discover', 'verifiedPublicSource')} · ${place.source?.verifiedBy || t('discover', 'sourceAuthority')} · ${t('discover', 'lastChecked', { date: place.lastVerifiedAt ? new Date(place.lastVerifiedAt).toLocaleDateString() : t('discover', 'onPublication') })}`}
                        >
                          {t('discover', 'sourceLabel')} <strong>{place.source?.name || t('discover', 'verifiedRecords')}</strong>
                        </span>
                        <span title={t('discover', 'osmTitle')}>© OSM (ODbL) · EHA</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Empty State */}
          {!loading && !loadError && tab !== 'emergency' && places.length === 0 && (
            <div className="text-center py-16 bg-white rounded-3xl border border-slate-200 p-8">
              <Compass className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="font-serif text-xl font-bold text-[#0F2942]">{t('discover', 'noPlacesTitle')}</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                {t('discover', 'noPlacesBody')}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => {
                  setSelectedNeighborhood(NEIGHBORHOODS[0])
                  setRadiusKm(10)
                  setTab('all')
                  setSearchQuery('')
                }}
              >
                {t('discover', 'resetFilters')}
              </Button>
            </div>
          )}
        </div>

        {/* 4. Verified Sources Section (ROAD-001) */}
        <div className="mt-16 bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4 mb-6">
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-[#D4AF37]">
                {t('discover', 'governance')}
              </span>
              <h2 className="font-serif text-2xl font-bold text-[#0F2942] mt-1">
                {t('discover', 'authorityStandards')}
              </h2>
            </div>
            <p className="text-xs text-slate-500 max-w-md">
              {t('discover', 'licensingPolicy')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {sources.map((src) => (
              <div key={src.id} className="rounded-2xl bg-slate-50 p-5 border border-slate-200">
                <div className="flex items-center gap-2 mb-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <h4 className="font-serif text-sm font-bold text-[#0F2942]">{src.name}</h4>
                </div>
                <p className="text-xs text-slate-500 mb-3">{src.license || t('discover', 'officialPublicRegistry')}</p>
                <p className="text-[11px] text-slate-500" title={t('discover', 'attributionTitle')}>{t('discover', 'verifiedSourceRoad')}</p>
                <div className="text-[11px] text-slate-400 flex items-center justify-between pt-2 border-t border-slate-200">
                  <span>{t('discover', 'placesCount', { count: src._count?.places ?? 0 })}</span>
                  <span>{t('discover', 'contactsCount', { count: src._count?.emergencyContacts ?? 0 })}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* ADD TO ITINERARY MODAL DIALOG                                        */}
      {/* ==================================================================== */}
      {addToTripModalOpen && placeToAddToTrip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between bg-[#0F2942] px-6 py-4 text-white">
              <div className="flex items-center gap-2">
                <Compass className="h-5 w-5 text-[#D4AF37]" />
                <h3 className="font-serif text-lg font-bold">{t('discover', 'addToYourItinerary')}</h3>
              </div>
              <button
                onClick={() => setAddToTripModalOpen(false)}
                className="rounded-lg p-1 text-white/70 hover:bg-white/10 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmAddToTrip} className="p-6 space-y-4">
              <div className="rounded-2xl bg-slate-50 p-3.5 border border-slate-200">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#D4AF37]">{t('discover', 'selectedLandmark')}</p>
                <h4 className="font-serif text-base font-bold text-[#0F2942]">{placeToAddToTrip.name}</h4>
                <p className="text-xs text-slate-500">{placeToAddToTrip.address}</p>
              </div>

              {userTrips.length === 0 ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-center">
                  <p className="text-xs text-amber-900 font-semibold">{t('discover', 'noItineraries')}</p>
                  <Link
                    href="/trips"
                    className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-[#0F2942] px-4 py-2 text-xs font-bold text-white"
                  >
                    <Plus className="h-3.5 w-3.5" /> {t('discover', 'createTripFirst')}
                  </Link>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-500">{t('discover', 'selectTrip')}</label>
                    <select
                      value={selectedTripId}
                      onChange={(e) => {
                        setSelectedTripId(e.target.value)
                        const foundTrip = userTrips.find((trip) => trip.id === e.target.value)
                        if (foundTrip) setTripItemDate(foundTrip.startDate.slice(0, 10))
                      }}
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-semibold text-slate-800 outline-none focus:border-[#D4AF37]"
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
                        value={tripItemDate}
                        onChange={(e) => setTripItemDate(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-[#D4AF37]"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase text-slate-500">{t('discover', 'timeSlot')}</label>
                      <input
                        type="time"
                        value={tripItemTime}
                        onChange={(e) => setTripItemTime(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-[#D4AF37]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-500">{t('discover', 'activityNote')}</label>
                    <input
                      type="text"
                      value={tripItemNotes}
                      onChange={(e) => setTripItemNotes(e.target.value)}
                      placeholder={t('discover', 'activityNotePlaceholder')}
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-[#D4AF37]"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setAddToTripModalOpen(false)}
                      className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-100"
                    >
                      {t('discover', 'cancel')}
                    </button>
                    <Button
                      type="submit"
                      loading={addingToTrip}
                      className="bg-[#0F2942] text-xs font-bold text-white hover:bg-[#1E3A5F]"
                    >
                      {t('discover', 'confirmAddSchedule')}
                    </Button>
                  </div>
                </>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
