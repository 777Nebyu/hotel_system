'use client'

import * as React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import HeroAnimated from './HeroAnimated'
import { useFavoritesQuery, useHotelSearchQuery } from '@/hooks/use-catalog'
import { useLanguage } from '@/lib/i18n'
import { HotelCard } from '@/components/domain/HotelCard'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/Button'
import {
  Building2,
  ShieldCheck,
  Headphones,
  BadgeDollarSign,
  MapPin,
  Sparkles,
  ArrowRight,
  Star,
  Quote,
} from 'lucide-react'

const DESTINATIONS = [
  {
    city: 'Addis Ababa',
    cityKey: 'destAddisCity',
    countryKey: 'countryEthiopia',
    hotelsKey: 'destAddisHotels',
    img: 'https://upload.wikimedia.org/wikipedia/commons/6/63/Night_view_of_Meskel_Square.jpg',
  },
  {
    city: 'Dubai',
    cityKey: 'destDubaiCity',
    countryKey: 'countryUae',
    hotelsKey: 'destDubaiHotels',
    img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/Dubai_Skyline_and_Burj_Khalifa_-_25072008.jpg/960px-Dubai_Skyline_and_Burj_Khalifa_-_25072008.jpg',
  },
  {
    city: 'Paris',
    cityKey: 'destParisCity',
    countryKey: 'countryFrance',
    hotelsKey: 'destParisHotels',
    img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/90/Eiffel_Tower_sunset_skyline_%28Unsplash%29.jpg/960px-Eiffel_Tower_sunset_skyline_%28Unsplash%29.jpg',
  },
  {
    city: 'Santorini',
    cityKey: 'destSantoriniCity',
    countryKey: 'countryGreece',
    hotelsKey: 'destSantoriniHotels',
    img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c9/Oia_-_Santorini_-_Greece_-_11.jpg/960px-Oia_-_Santorini_-_Greece_-_11.jpg',
  },
]

const VALUE_PROPS = [
  {
    icon: Building2,
    titleKey: 'valueOneTitle',
    descKey: 'valueOneDesc',
  },
  {
    icon: ShieldCheck,
    titleKey: 'valueTwoTitle',
    descKey: 'valueTwoDesc',
  },
  {
    icon: BadgeDollarSign,
    titleKey: 'valueThreeTitle',
    descKey: 'valueThreeDesc',
  },
  {
    icon: Headphones,
    titleKey: 'valueFourTitle',
    descKey: 'valueFourDesc',
  },
]

const TESTIMONIALS = [
  {
    quoteKey: 'testimonialOneQuote',
    authorKey: 'testimonialOneAuthor',
    roleKey: 'testimonialOneRole',
    rating: 5,
  },
  {
    quoteKey: 'testimonialTwoQuote',
    authorKey: 'testimonialTwoAuthor',
    roleKey: 'testimonialTwoRole',
    rating: 5,
  },
  {
    quoteKey: 'testimonialThreeQuote',
    authorKey: 'testimonialThreeAuthor',
    roleKey: 'testimonialThreeRole',
    rating: 5,
  },
]

export default function HomePage() {
  const { t } = useLanguage()
  const { data: searchResult, isLoading, isError } = useHotelSearchQuery({ pageSize: 6 })
  const { data: favorites } = useFavoritesQuery()
  const favoriteIds = React.useMemo(() => new Set((favorites ?? []).map((favorite) => favorite.id)), [favorites])
  const hotels = searchResult?.data || []

  return (
    <div className="space-y-24 pb-20">
      {/* 1. Hero Section */}
      <HeroAnimated />

      {/* 2. Featured Curated Properties */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-10 gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FEF9E7] text-[#92400E] border border-[#D4AF37]/30 text-xs font-bold uppercase tracking-wider mb-2">
              <Sparkles className="w-3.5 h-3.5" />
              <span>{t('home', 'featuredBadge')}</span>
            </div>
            <h2 className="font-serif text-3xl sm:text-4xl font-bold text-[#0F2942]">
              {t('home', 'featuredTitle')}
            </h2>
            <p className="text-sm text-slate-500 mt-2">
              {t('home', 'featuredSubtitle')}
            </p>
          </div>

          <Link href="/search">
            <Button variant="outline" rightIcon={<ArrowRight className="w-4 h-4" />}>
              {t('home', 'exploreAllProperties')}
            </Button>
          </Link>
        </div>

        {/* Loading Skeletons */}
        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[1, 2, 3, 4, 5, 6].map((idx) => (
              <div key={idx} className="rounded-3xl border border-slate-200 bg-white p-4 space-y-4">
                <Skeleton className="aspect-[16/10] w-full rounded-2xl" />
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
                  <Skeleton className="h-6 w-24" />
                  <Skeleton className="h-8 w-24 rounded-xl" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Loaded Hotel Cards */}
        {!isLoading && hotels.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {hotels.map((hotel) => (
              <HotelCard key={hotel.id} hotel={hotel} isFavorite={favoriteIds.has(hotel.id)} />
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && hotels.length === 0 && !isError && (
          <EmptyState
            title={t('home', 'emptyTitle')}
            description={t('home', 'emptyDescription')}
            actionLabel={t('home', 'emptyActionLabel')}
            onAction={() => (window.location.href = '/search')}
          />
        )}
      </section>

      {/* 3. Popular Destinations */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="text-xs font-bold uppercase tracking-widest text-[#D4AF37]">
            {t('home', 'destinationsBadge')}
          </span>
          <h2 className="font-serif text-3xl sm:text-4xl font-bold text-[#0F2942] mt-2">
            {t('home', 'destinationsTitle')}
          </h2>
          <p className="text-sm text-slate-500 mt-2">
            {t('home', 'destinationsSubtitle')}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {DESTINATIONS.map((dest) => (
            <Link
              key={dest.city}
              href={`/search?city=${encodeURIComponent(dest.city)}`}
              className="group relative rounded-3xl overflow-hidden aspect-[4/5] shadow-md hover:shadow-2xl transition-all duration-300 block"
            >
              <Image
                src={dest.img}
                alt={`${t('home', dest.cityKey)}, ${t('home', dest.countryKey)}`}
                fill
                sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                className="object-cover group-hover:scale-108 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0B0F17]/90 via-[#0B0F17]/25 to-transparent" />
              <div className="absolute bottom-6 left-6 right-6 text-white">
                <span className="text-xs uppercase tracking-wider text-[#D4AF37] font-semibold">
                  {t('home', dest.countryKey)}
                </span>
                <h3 className="font-serif text-2xl font-bold mt-0.5">{t('home', dest.cityKey)}</h3>
                <p className="text-xs text-white/80 mt-1">{t('home', dest.hotelsKey)}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* 4. Value Propositions (The LuxStay Standard) */}
      <section className="bg-[#0F2942] text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-xs font-bold uppercase tracking-widest text-[#D4AF37]">
              {t('home', 'valueBadge')}
            </span>
            <h2 className="font-serif text-3xl sm:text-4xl font-bold text-white mt-2">
              {t('home', 'valueTitle')}
            </h2>
            <p className="text-sm text-slate-300 mt-2">
              {t('home', 'valueSubtitle')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {VALUE_PROPS.map(({ icon: Icon, titleKey, descKey }) => (
              <div
                key={titleKey}
                className="rounded-3xl bg-white/5 border border-white/10 p-8 backdrop-blur-md hover:bg-white/8 transition-colors"
              >
                <div className="w-12 h-12 rounded-2xl bg-[#D4AF37]/15 border border-[#D4AF37]/30 flex items-center justify-center mb-5 text-[#D4AF37]">
                  <Icon className="w-6 h-6" />
                </div>
                <h3 className="font-serif text-lg font-bold mb-2">{t('home', titleKey)}</h3>
                <p className="text-xs text-slate-300 leading-relaxed">{t('home', descKey)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. Verified Guest Social Proof */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="text-xs font-bold uppercase tracking-widest text-[#D4AF37]">
            {t('home', 'testimonialsBadge')}
          </span>
          <h2 className="font-serif text-3xl sm:text-4xl font-bold text-[#0F2942] mt-2">
            {t('home', 'testimonialsTitle')}
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {TESTIMONIALS.map((item) => (
            <div
              key={item.authorKey}
              className="rounded-3xl bg-white border border-slate-200/80 p-8 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex gap-1 text-amber-400 mb-4">
                  {Array.from({ length: item.rating }).map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-amber-400" />
                  ))}
                </div>
                <Quote className="w-8 h-8 text-[#D4AF37]/30 mb-2" />
                <p className="text-sm text-slate-600 leading-relaxed italic">
                  &ldquo;{t('home', item.quoteKey)}&rdquo;
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-100">
                <p className="text-sm font-bold text-[#0F2942]">{t('home', item.authorKey)}</p>
                <p className="text-xs text-slate-400">{t('home', item.roleKey)}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 6. Pre-Footer Call to Action */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="relative rounded-3xl overflow-hidden bg-gradient-to-r from-[#0F2942] to-[#1E3A8A] text-white p-10 sm:p-16 shadow-2xl border border-white/10">
          <div className="max-w-xl">
            <span className="text-xs uppercase font-bold tracking-widest text-[#D4AF37]">
              {t('home', 'ctaBadge')}
            </span>
            <h2 className="font-serif text-3xl sm:text-4xl font-bold text-white mt-2 mb-4">
              {t('home', 'ctaTitle')}
            </h2>
            <p className="text-sm text-slate-200 leading-relaxed mb-8">
              {t('home', 'ctaDescription')}
            </p>
            <Link href="/search">
              <Button variant="gold" size="lg" rightIcon={<ArrowRight className="w-4 h-4" />}>
                {t('home', 'ctaButton')}
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
