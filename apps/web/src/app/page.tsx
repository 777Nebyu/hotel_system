'use client'

import * as React from 'react'
import Link from 'next/link'
import HeroAnimated from './HeroAnimated'
import { useHotelSearchQuery } from '@/hooks/use-catalog'
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
    country: 'Ethiopia',
    hotels: '12 Luxury Properties',
    img: 'https://images.unsplash.com/photo-1549294413-26f195200c16?w=600&h=400&fit=crop&auto=format',
  },
  {
    city: 'Dubai',
    country: 'UAE',
    hotels: '48 Grand Resorts',
    img: 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=600&h=400&fit=crop&auto=format',
  },
  {
    city: 'Paris',
    country: 'France',
    hotels: '34 Boutique Stays',
    img: 'https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=600&h=400&fit=crop&auto=format',
  },
  {
    city: 'Santorini',
    country: 'Greece',
    hotels: '19 Cliffside Villas',
    img: 'https://images.unsplash.com/photo-1623718649591-311775a30c43?w=600&h=400&fit=crop&auto=format',
  },
]

const VALUE_PROPS = [
  {
    icon: Building2,
    title: 'Curated Five-Star Stays',
    desc: 'Each hotel and private residence undergoes rigorous 150-point quality inspections before listing.',
  },
  {
    icon: ShieldCheck,
    title: 'Authoritative Reservation Hold',
    desc: 'Inventory is locked in atomic transactions directly with property systems. Zero double bookings.',
  },
  {
    icon: BadgeDollarSign,
    title: 'Transparent Pricing Guarantee',
    desc: 'No hidden resort fees or checkout surprises. The price you see is the authoritative total.',
  },
  {
    icon: Headphones,
    title: '24/7 Dedicated Concierge',
    desc: 'Direct front-desk messaging and 24/7 elite guest assistance for modifications and requests.',
  },
]

const TESTIMONIALS = [
  {
    quote:
      'The smoothest booking experience in luxury travel. Arrived at the suite and key assignment was instantaneous.',
    author: 'Eleanor Vance',
    role: 'Global Traveler',
    rating: 5,
  },
  {
    quote:
      'The transparent pricing and seamless Telebirr checkout made reserving our vacation villa effortless.',
    author: 'Kassahun Bekele',
    role: 'Executive Member',
    rating: 5,
  },
  {
    quote:
      'Exceptional properties. Every hotel on YayeTech feels hand-selected with unmatched architectural poise.',
    author: 'Marcus Chen',
    role: 'Architectural Director',
    rating: 5,
  },
]

export default function HomePage() {
  const { data: searchResult, isLoading, isError } = useHotelSearchQuery({ pageSize: 6 })
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
              <span>Hand-Picked Selections</span>
            </div>
            <h2 className="font-serif text-3xl sm:text-4xl font-bold text-[#0F2942]">
              Featured Luxury Stays
            </h2>
            <p className="text-sm text-slate-500 mt-2">
              Extraordinary hotels, architectural boutique lodges, and premier grand resorts.
            </p>
          </div>

          <Link href="/search">
            <Button variant="outline" rightIcon={<ArrowRight className="w-4 h-4" />}>
              Explore All Properties
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
              <HotelCard key={hotel.id} hotel={hotel} />
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && hotels.length === 0 && !isError && (
          <EmptyState
            title="Properties coming soon"
            description="Our curators are verifying new luxury properties. Check back shortly or search our full global catalog."
            actionLabel="Search Global Catalog"
            onAction={() => (window.location.href = '/search')}
          />
        )}
      </section>

      {/* 3. Popular Destinations */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="text-xs font-bold uppercase tracking-widest text-[#D4AF37]">
            Global Escapes
          </span>
          <h2 className="font-serif text-3xl sm:text-4xl font-bold text-[#0F2942] mt-2">
            Signature Destinations
          </h2>
          <p className="text-sm text-slate-500 mt-2">
            Immerse yourself in world-renowned cities and scenic retreat landscapes.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {DESTINATIONS.map((dest) => (
            <Link
              key={dest.city}
              href={`/search?city=${encodeURIComponent(dest.city)}`}
              className="group relative rounded-3xl overflow-hidden aspect-[4/5] shadow-md hover:shadow-2xl transition-all duration-300 block"
            >
              <img
                src={dest.img}
                alt={`${dest.city}, ${dest.country}`}
                className="w-full h-full object-cover group-hover:scale-108 transition-transform duration-700"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0B0F17]/90 via-[#0B0F17]/25 to-transparent" />
              <div className="absolute bottom-6 left-6 right-6 text-white">
                <span className="text-xs uppercase tracking-wider text-[#D4AF37] font-semibold">
                  {dest.country}
                </span>
                <h3 className="font-serif text-2xl font-bold mt-0.5">{dest.city}</h3>
                <p className="text-xs text-white/80 mt-1">{dest.hotels}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* 4. Value Propositions (The YayeTech Standard) */}
      <section className="bg-[#0F2942] text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-xs font-bold uppercase tracking-widest text-[#D4AF37]">
              The YayeTech Guarantee
            </span>
            <h2 className="font-serif text-3xl sm:text-4xl font-bold text-white mt-2">
              Uncompromising Hospitality Standards
            </h2>
            <p className="text-sm text-slate-300 mt-2">
              Enterprise reliability meets white-glove bespoke luxury.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {VALUE_PROPS.map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="rounded-3xl bg-white/5 border border-white/10 p-8 backdrop-blur-md hover:bg-white/8 transition-colors"
              >
                <div className="w-12 h-12 rounded-2xl bg-[#D4AF37]/15 border border-[#D4AF37]/30 flex items-center justify-center mb-5 text-[#D4AF37]">
                  <Icon className="w-6 h-6" />
                </div>
                <h3 className="font-serif text-lg font-bold mb-2">{title}</h3>
                <p className="text-xs text-slate-300 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. Verified Guest Social Proof */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="text-xs font-bold uppercase tracking-widest text-[#D4AF37]">
            Guest Impressions
          </span>
          <h2 className="font-serif text-3xl sm:text-4xl font-bold text-[#0F2942] mt-2">
            Stories from Our Distinguished Guests
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {TESTIMONIALS.map((t) => (
            <div
              key={t.author}
              className="rounded-3xl bg-white border border-slate-200/80 p-8 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex gap-1 text-amber-400 mb-4">
                  {Array.from({ length: t.rating }).map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-amber-400" />
                  ))}
                </div>
                <Quote className="w-8 h-8 text-[#D4AF37]/30 mb-2" />
                <p className="text-sm text-slate-600 leading-relaxed italic">
                  &ldquo;{t.quote}&rdquo;
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-100">
                <p className="text-sm font-bold text-[#0F2942]">{t.author}</p>
                <p className="text-xs text-slate-400">{t.role}</p>
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
              Start Your Journey
            </span>
            <h2 className="font-serif text-3xl sm:text-4xl font-bold text-white mt-2 mb-4">
              Reserve Your Next Extraordinary Escape Today
            </h2>
            <p className="text-sm text-slate-200 leading-relaxed mb-8">
              Join thousands of travelers who book exclusively with YayeTech Luxury Stays for verified five-star hospitality.
            </p>
            <Link href="/search">
              <Button variant="gold" size="lg" rightIcon={<ArrowRight className="w-4 h-4" />}>
                Explore All Suites & Resorts
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
