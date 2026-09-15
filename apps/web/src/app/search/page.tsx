'use client'

import * as React from 'react'
import { Suspense } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useHotelSearchQuery, useAmenitiesQuery, useCitiesQuery } from '@/hooks/use-catalog'
import { HotelCard } from '@/components/domain/HotelCard'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Drawer } from '@/components/ui/Drawer'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { PriceRangeSlider } from '@/components/forms/PriceRangeSlider'
import { formatEthiopianBirr } from '@/lib/currency'
import {
  Search,
  SlidersHorizontal,
  X,
  MapPin,
  Star,
  ArrowUpDown,
  Building,
  RotateCcw,
} from 'lucide-react'

const SORT_OPTIONS = [
  { label: 'Most Popular', value: 'popularity' },
  { label: 'Price: Low to High', value: 'price_asc' },
  { label: 'Price: High to Low', value: 'price_desc' },
  { label: 'Top Guest Rating', value: 'rating_desc' },
]

function SearchContent() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // 1. Synchronized URL Search Parameters
  const cityParam = searchParams.get('city') || ''
  const countryParam = searchParams.get('country') || ''
  const checkInParam = searchParams.get('checkIn') || ''
  const checkOutParam = searchParams.get('checkOut') || ''
  const guestsParam = Number(searchParams.get('guests')) || 2
  const minPriceParam = Number(searchParams.get('minPrice')) || 0
  const maxPriceParam = Number(searchParams.get('maxPrice')) || 100000
  const starParam = searchParams.get('stars') ? searchParams.get('stars')!.split(',').map(Number) : []
  const amenitiesParam = searchParams.get('amenities') ? searchParams.get('amenities')!.split(',') : []
  const sortParam = searchParams.get('sort') || 'popularity'
  const pageParam = Number(searchParams.get('page')) || 1

  // Mobile drawer state
  const [mobileFilterOpen, setMobileFilterOpen] = React.useState(false)

  // Local filter inputs before applying to URL
  const [localCity, setLocalCity] = React.useState(cityParam)
  const [localPriceRange, setLocalPriceRange] = React.useState<[number, number]>([minPriceParam, maxPriceParam])

  // Sync local inputs when URL parameters change (e.g. Back/Forward button)
  React.useEffect(() => {
    setLocalCity(cityParam)
    setLocalPriceRange([minPriceParam, maxPriceParam])
  }, [cityParam, minPriceParam, maxPriceParam])

  // Helper to push new parameters into the URL
  const updateParams = React.useCallback(
    (updates: Record<string, string | number | Array<string | number> | undefined | null>) => {
      const current = new URLSearchParams(searchParams.toString())

      Object.entries(updates).forEach(([key, val]) => {
        if (val === undefined || val === null || val === '') {
          current.delete(key)
        } else if (Array.isArray(val)) {
          if (val.length === 0) current.delete(key)
          else current.set(key, val.join(','))
        } else {
          current.set(key, String(val))
        }
      })

      // Reset to page 1 on filter changes
      if (!updates.page && current.get('page') !== '1') {
        current.delete('page')
      }

      router.push(`${pathname}?${current.toString()}`)
    },
    [router, pathname, searchParams],
  )

  // Clear all filters
  const clearAllFilters = () => {
    router.push(pathname)
  }

  // Toggle star rating filter
  const toggleStar = (rating: number) => {
    const next = starParam.includes(rating)
      ? starParam.filter((r) => r !== rating)
      : [...starParam, rating]
    updateParams({ stars: next })
  }

  // Toggle amenity filter
  const toggleAmenity = (amenity: string) => {
    const next = amenitiesParam.includes(amenity)
      ? amenitiesParam.filter((a) => a !== amenity)
      : [...amenitiesParam, amenity]
    updateParams({ amenities: next })
  }

  // Calculate nights difference for transparent pricing math
  const stayNights = React.useMemo(() => {
    if (!checkInParam || !checkOutParam) return 1
    const diff = Math.ceil(
      (new Date(checkOutParam).getTime() - new Date(checkInParam).getTime()) / (1000 * 60 * 60 * 24),
    )
    return diff > 0 ? diff : 1
  }, [checkInParam, checkOutParam])

  // Execute TanStack Query with backend catalog
  const {
    data: searchResponse,
    isLoading,
    isError,
    error,
    refetch,
  } = useHotelSearchQuery({
    city: cityParam || undefined,
    country: countryParam || undefined,
    priceMin: minPriceParam > 0 ? minPriceParam : undefined,
    priceMax: maxPriceParam < 100000 ? maxPriceParam : undefined,
    minRating: starParam.length > 0 ? Math.min(...starParam) : undefined,
    amenities: amenitiesParam.length > 0 ? amenitiesParam : undefined,
    sort: sortParam as any,
    page: pageParam,
    pageSize: 12,
  })

  const { data: amenitiesList } = useAmenitiesQuery()
  const { data: citiesList } = useCitiesQuery()

  const hotels = searchResponse?.data || []
  const totalCount = searchResponse?.meta?.total || 0

  const activeFiltersCount =
    (cityParam ? 1 : 0) +
    (minPriceParam > 0 || maxPriceParam < 100000 ? 1 : 0) +
    starParam.length +
    amenitiesParam.length

  // Filter Panel Component (Shared between desktop sidebar & mobile drawer)
  const FilterPanelContent = (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-slate-100">
        <h3 className="font-serif text-lg font-bold text-[#0F2942]">Filter Stays</h3>
        {activeFiltersCount > 0 && (
          <button
            onClick={clearAllFilters}
            className="text-xs font-semibold text-[#D4AF37] hover:underline cursor-pointer flex items-center gap-1"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset All</span>
          </button>
        )}
      </div>

      {/* Destination / City */}
      <div>
        <label htmlFor="search-city-filter" className="block text-xs font-bold uppercase tracking-wider text-[#0F2942] mb-2">
          City
        </label>
        <div className="relative">
          <MapPin className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            id="search-city-filter"
            value={localCity}
            onChange={(e) => setLocalCity(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') updateParams({ city: localCity })
            }}
            placeholder="Filter by city..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-[#0F2942] focus:ring-1 focus:ring-[#0F2942]"
          />
        </div>
      </div>

      {/* Nightly Price Range */}
      <div>
        <h4 className="text-xs font-bold uppercase tracking-wider text-[#0F2942] mb-2">
          Nightly Rate
        </h4>
        <PriceRangeSlider
          min={0}
          max={100000}
          step={1000}
          value={localPriceRange}
          onChange={(newRange) => {
            setLocalPriceRange(newRange)
            updateParams({ minPrice: newRange[0], maxPrice: newRange[1] })
          }}
        />
      </div>

      {/* Star Rating */}
      <div>
        <h4 className="text-xs font-bold uppercase tracking-wider text-[#0F2942] mb-2">
          Property Rating
        </h4>
        <div className="space-y-1.5">
          {[5, 4, 3].map((stars) => (
            <label
              key={stars}
              className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 cursor-pointer transition-colors"
            >
              <input
                type="checkbox"
                checked={starParam.includes(stars)}
                onChange={() => toggleStar(stars)}
                className="w-4 h-4 rounded text-[#0F2942] accent-[#0F2942] focus:ring-[#D4AF37]"
              />
              <div className="flex items-center gap-1">
                {Array.from({ length: stars }).map((_, i) => (
                  <Star key={i} className="w-3.5 h-3.5 text-[#D4AF37] fill-[#D4AF37]" />
                ))}
              </div>
              <span className="text-xs text-slate-500 font-medium">
                {stars === 5 ? '5-Star Grand Luxury' : `${stars} Stars & Above`}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Standard Amenities */}
      <div>
        <h4 className="text-xs font-bold uppercase tracking-wider text-[#0F2942] mb-2">
          Amenities
        </h4>
        <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
          {amenitiesList && amenitiesList.length > 0 ? (
            amenitiesList.map((amenity) => (
              <label
                key={amenity.id}
                className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 cursor-pointer transition-colors"
              >
                <input
                  type="checkbox"
                  checked={amenitiesParam.includes(amenity.name)}
                  onChange={() => toggleAmenity(amenity.name)}
                  className="w-4 h-4 rounded text-[#0F2942] accent-[#0F2942] focus:ring-[#D4AF37]"
                />
                <span className="text-xs font-medium text-slate-700">{amenity.name}</span>
              </label>
            ))
          ) : (
            ['Pool', 'Spa & Wellness', 'Fine Dining', 'Private Beach', 'High-speed WiFi', 'Valet Parking', 'Airport Shuttle'].map(
              (amenity) => (
                <label
                  key={amenity}
                  className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={amenitiesParam.includes(amenity)}
                    onChange={() => toggleAmenity(amenity)}
                    className="w-4 h-4 rounded text-[#0F2942] accent-[#0F2942] focus:ring-[#D4AF37]"
                  />
                  <span className="text-xs font-medium text-slate-700">{amenity}</span>
                </label>
              ),
            )
          )}
        </div>
      </div>
    </div>
  )

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
      {/* Top Search Controls Header */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/80 mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-[#D4AF37]">
              Discovery Catalog
            </span>
            <h1 className="font-serif text-2xl sm:text-3xl font-bold text-[#0F2942] mt-1">
              {cityParam ? `Luxury Stays in ${cityParam}` : 'Explore Luxury Stays & Grand Resorts'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              {isLoading ? 'Searching authoritative property inventory...' : `Found ${totalCount} verified luxury properties`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Mobile Filter Trigger */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setMobileFilterOpen(true)}
              className="lg:hidden"
              leftIcon={<SlidersHorizontal className="w-4 h-4" />}
            >
              Filters {activeFiltersCount > 0 && `(${activeFiltersCount})`}
            </Button>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 text-xs">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
              <span className="font-semibold text-slate-500">Sort:</span>
              <select
                value={sortParam}
                onChange={(e) => updateParams({ sort: e.target.value })}
                className="bg-transparent font-bold text-[#0F2942] focus:outline-none cursor-pointer"
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Active Filter Chips */}
        {activeFiltersCount > 0 && (
          <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-slate-100">
            <span className="text-xs font-semibold text-slate-400">Active filters:</span>
            {cityParam && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                <span>City: {cityParam}</span>
                <button onClick={() => updateParams({ city: undefined })} className="hover:text-red-500">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {(minPriceParam > 0 || maxPriceParam < 100000) && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                <span>
                  {formatEthiopianBirr(minPriceParam)} – {formatEthiopianBirr(maxPriceParam)}
                </span>
                <button
                  onClick={() => updateParams({ minPrice: undefined, maxPrice: undefined })}
                  className="hover:text-red-500"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {starParam.map((s) => (
              <span
                key={s}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200"
              >
                <span>{s} Stars</span>
                <button onClick={() => toggleStar(s)} className="hover:text-red-500">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            {amenitiesParam.map((a) => (
              <span
                key={a}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700"
              >
                <span>{a}</span>
                <button onClick={() => toggleAmenity(a)} className="hover:text-red-500">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            <button
              onClick={clearAllFilters}
              className="text-xs font-bold text-[#D4AF37] hover:underline ml-2 cursor-pointer"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* Main Grid: Sidebar Filters + Results */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Desktop Sidebar Filters */}
        <div className="hidden lg:block lg:col-span-1">
          <div className="sticky top-24 bg-white rounded-3xl p-6 shadow-sm border border-slate-200/80">
            {FilterPanelContent}
          </div>
        </div>

        {/* Results Area */}
        <div className="lg:col-span-3">
          {/* Loading Skeletons */}
          {isLoading && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="rounded-3xl border border-slate-200 bg-white p-4 space-y-4">
                  <Skeleton className="aspect-[16/10] w-full rounded-2xl" />
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                  <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
                    <Skeleton className="h-6 w-20" />
                    <Skeleton className="h-8 w-24 rounded-xl" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Error State */}
          {isError && (
            <ErrorState
              title="Unable to load hotel catalog"
              message={error instanceof Error ? error.message : 'Please check your connection and try again.'}
              onRetry={() => refetch()}
            />
          )}

          {/* Loaded Hotel Cards */}
          {!isLoading && !isError && hotels.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {hotels.map((hotel) => (
                <HotelCard
                  key={hotel.id}
                  hotel={hotel}
                  stayNights={stayNights}
                  searchQuery={searchParams.toString()}
                />
              ))}
            </div>
          )}

          {/* Empty State */}
          {!isLoading && !isError && hotels.length === 0 && (
            <EmptyState
              title="No luxury properties found"
              description="No properties match your exact search criteria. Try expanding your price range, clearing amenities, or choosing a different city."
              actionLabel="Clear Filters"
              onAction={clearAllFilters}
            />
          )}
        </div>
      </div>

      {/* Mobile Filters Drawer */}
      <Drawer
        isOpen={mobileFilterOpen}
        onClose={() => setMobileFilterOpen(false)}
        title="Filter Stays"
        position="bottom"
      >
        <div className="pb-6">
          {FilterPanelContent}
          <div className="mt-6 pt-4 border-t border-slate-100">
            <Button
              variant="primary"
              className="w-full"
              onClick={() => setMobileFilterOpen(false)}
            >
              Show {totalCount} Properties
            </Button>
          </div>
        </div>
      </Drawer>
    </div>
  )
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[80vh] flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-[#D4AF37] border-t-transparent animate-spin" />
        </div>
      }
    >
      <SearchContent />
    </Suspense>
  )
}
