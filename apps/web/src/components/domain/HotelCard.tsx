'use client'

import * as React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { MapPin, Star, Heart } from 'lucide-react'
import type { HotelSummary } from '@/lib/types'
import { formatEthiopianBirr } from '@/lib/currency'
import { Badge } from '@/components/ui/Badge'
import { useAuth } from '@/lib/auth-store'
import { useFavoritesQuery, useToggleFavoriteMutation } from '@/hooks/use-catalog'
import { toast } from '@/components/ui/Toast'

export interface HotelCardProps {
  hotel: HotelSummary
  stayNights?: number
  searchQuery?: string
  className?: string
}

const FALLBACK_HOTEL_IMG =
  'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&h=600&fit=crop&auto=format'

export function HotelCard({
  hotel,
  stayNights = 1,
  searchQuery = '',
  className = '',
}: HotelCardProps) {
  const { user } = useAuth()
  const [imgSrc, setImgSrc] = React.useState(hotel.primaryImageUrl || FALLBACK_HOTEL_IMG)

  const { data: favorites } = useFavoritesQuery()
  const toggleFavorite = useToggleFavoriteMutation()

  const isFavorite = React.useMemo(() => {
    return favorites?.some((f) => f.id === hotel.id) ?? false
  }, [favorites, hotel.id])

  const handleHeartClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (!user) {
      toast.info('Sign in required', 'Please sign in to save properties to your wishlist.')
      return
    }

    toggleFavorite.mutate({ hotelId: hotel.id, isFavorite })
    toast.success(
      isFavorite ? 'Removed from favorites' : 'Saved to favorites',
      `${hotel.name} updated.`,
    )
  }

  const minPrice = hotel.minPricePerNight ?? 0
  const totalPrice = minPrice * stayNights
  const hotelHref = `/hotel/${hotel.id}${searchQuery ? `?${searchQuery}` : ''}`

  return (
    <article
      className={`group relative rounded-3xl bg-white border border-slate-200/80 shadow-sm hover:shadow-xl hover:border-[#0F2942]/20 transition-all duration-300 overflow-hidden flex flex-col ${className}`}
    >
      {/* Image Container */}
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-slate-100">
        <Link href={hotelHref} tabIndex={-1}>
          {/* Using img with fallback safety */}
          <img
            src={imgSrc}
            alt={hotel.name}
            onError={() => setImgSrc(FALLBACK_HOTEL_IMG)}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
          />
        </Link>

        {/* Floating Heart Button */}
        <button
          type="button"
          onClick={handleHeartClick}
          aria-label={isFavorite ? `Remove ${hotel.name} from favorites` : `Save ${hotel.name} to favorites`}
          className="absolute top-3.5 right-3.5 w-10 h-10 rounded-full bg-white/80 backdrop-blur-md border border-white/40 flex items-center justify-center text-slate-700 hover:text-red-600 hover:bg-white transition-all shadow-md cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]"
        >
          <Heart
            className={`w-5 h-5 transition-colors ${
              isFavorite ? 'fill-red-500 text-red-500' : 'text-slate-700'
            }`}
          />
        </button>

        {/* Star Rating Badge */}
        <div className="absolute bottom-3 left-3 flex items-center gap-1 bg-[#0F2942]/85 backdrop-blur-md px-2.5 py-1 rounded-xl text-white text-xs font-semibold">
          <Star className="w-3.5 h-3.5 text-[#D4AF37] fill-[#D4AF37]" />
          <span>{hotel.starRating} Stars</span>
        </div>
      </div>

      {/* Content Section */}
      <div className="p-5 flex-1 flex flex-col justify-between">
        <div>
          {/* Location */}
          <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1.5">
            <MapPin className="w-3.5 h-3.5 text-[#D4AF37] shrink-0" />
            <span className="truncate">
              {hotel.city?.name}, {hotel.city?.country?.name}
            </span>
          </div>

          {/* Hotel Name */}
          <Link href={hotelHref} className="focus-visible:outline-none">
            <h3 className="font-serif text-lg sm:text-xl font-bold text-[#0F2942] group-hover:text-[#163859] transition-colors line-clamp-1">
              {hotel.name}
            </h3>
          </Link>

          {/* Rating & Reviews */}
          <div className="flex items-center gap-2 mt-2">
            <span className="px-2 py-0.5 rounded-lg bg-[#FEF9E7] text-[#92400E] border border-[#D4AF37]/30 text-xs font-bold">
              {hotel.averageRating ? hotel.averageRating.toFixed(1) : 'New'}
            </span>
            <span className="text-xs text-slate-500">
              {hotel.reviewCount > 0 ? `${hotel.reviewCount} verified reviews` : 'Awaiting reviews'}
            </span>
          </div>

          {/* Amenities Chips */}
          {hotel.amenities && hotel.amenities.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {hotel.amenities.slice(0, 3).map((amenity) => (
                <span
                  key={amenity}
                  className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-600"
                >
                  {amenity}
                </span>
              ))}
              {hotel.amenities.length > 3 && (
                <span className="text-[11px] font-medium px-1.5 py-0.5 rounded-md text-slate-400">
                  +{hotel.amenities.length - 3}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Pricing Section (Transparent Pricing Contract) */}
        <div className="mt-5 pt-4 border-t border-slate-100 flex items-end justify-between">
          <div>
            <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold block">
              {stayNights > 1 ? `Total for ${stayNights} nights` : 'Starting nightly rate'}
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="font-serif text-xl font-bold text-[#0F2942]">
                {minPrice > 0 ? formatEthiopianBirr(stayNights > 1 ? totalPrice : minPrice) : 'Contact for rate'}
              </span>
              {minPrice > 0 && (
                <span className="text-xs text-slate-500">
                  {stayNights > 1 ? `(${formatEthiopianBirr(minPrice)}/nt)` : '/ night'}
                </span>
              )}
            </div>
          </div>

          <Link
            href={hotelHref}
            className="px-4 py-2 rounded-xl bg-[#0F2942] hover:bg-[#163859] text-white text-xs font-bold transition-all shadow-sm group-hover:shadow-md"
          >
            View Suites
          </Link>
        </div>
      </div>
    </article>
  )
}
