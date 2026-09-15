'use client'

import Image from 'next/image'
import type { BookingQuote, Hotel } from '@/lib/types'
import { formatEthiopianBirr } from '@/lib/currency'
import { Calendar, Users, Bed, ShieldCheck, Tag } from 'lucide-react'

interface PriceBreakdownCardProps {
  quote: BookingQuote | null
  hotel: Hotel | null
  roomType?: string
  checkIn: string
  checkOut: string
  guests: { adults: number; children: number }
  isLoading?: boolean
}

function formatDate(val: string) {
  if (!val) return '—'
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(`${val}T00:00:00`))
  } catch {
    return val
  }
}

export function PriceBreakdownCard({
  quote,
  hotel,
  roomType,
  checkIn,
  checkOut,
  guests,
  isLoading = false,
}: PriceBreakdownCardProps) {
  const primaryImage =
    hotel?.images?.find((img) => img.isPrimary)?.url ||
    hotel?.images?.[0]?.url ||
    'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=600&h=400&fit=crop&auto=format'

  const nights = quote?.nights ?? 1
  const subtotal = quote?.subtotal ?? 0
  const taxAmount = quote?.taxAmount ?? 0
  const taxRate = quote?.taxRate ? Math.round(quote.taxRate * 100) : 15
  const serviceFee = quote?.serviceFee ?? 0
  const discount = quote?.discount ?? 0
  const total = quote?.total ?? 0

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden sticky top-24">
      {/* Header hotel banner */}
      <div className="relative h-36 w-full overflow-hidden bg-slate-900">
        <Image
          src={primaryImage}
          alt={hotel?.name ?? 'Luxury Hotel'}
          fill
          className="object-cover opacity-90"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent" />
        <div className="absolute bottom-3 left-4 right-4 text-white">
          <div className="font-serif text-lg font-bold leading-tight drop-shadow-sm line-clamp-1">
            {hotel?.name ?? 'Selected Hotel'}
          </div>
          <div className="text-xs text-slate-200 line-clamp-1">
            {hotel?.city?.name ? `${hotel.city.name}, ${hotel.city.country?.name ?? ''}` : 'Ethiopia'}
          </div>
        </div>
      </div>

      <div className="p-5 space-y-4">
        {/* Reservation specs */}
        <div className="space-y-2.5 pb-4 border-b border-slate-100 text-xs text-slate-600">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-slate-500">
              <Calendar className="w-3.5 h-3.5 text-[#D4AF37]" /> Stay Dates
            </span>
            <span className="font-medium text-slate-900">
              {formatDate(checkIn)} – {formatDate(checkOut)} ({nights} {nights === 1 ? 'night' : 'nights'})
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-slate-500">
              <Users className="w-3.5 h-3.5 text-[#D4AF37]" /> Guests
            </span>
            <span className="font-medium text-slate-900">
              {guests.adults} {guests.adults === 1 ? 'Adult' : 'Adults'}
              {guests.children > 0 ? `, ${guests.children} ${guests.children === 1 ? 'Child' : 'Children'}` : ''}
            </span>
          </div>

          {roomType && (
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-slate-500">
                <Bed className="w-3.5 h-3.5 text-[#D4AF37]" /> Suite Type
              </span>
              <span className="font-medium text-slate-900 capitalize">
                {roomType.replace(/_/g, ' ')}
              </span>
            </div>
          )}
        </div>

        {/* Financial calculation breakdown (authoritative from API) */}
        {isLoading ? (
          <div className="space-y-3 py-2 animate-pulse">
            <div className="h-4 bg-slate-100 rounded w-full" />
            <div className="h-4 bg-slate-100 rounded w-3/4" />
            <div className="h-4 bg-slate-100 rounded w-5/6" />
            <div className="h-6 bg-slate-200 rounded w-1/2 pt-2" />
          </div>
        ) : (
          <div className="space-y-2.5 text-sm">
            <div className="flex items-center justify-between text-slate-600">
              <span>Room Subtotal</span>
              <span className="font-medium text-slate-900">{formatEthiopianBirr(subtotal)}</span>
            </div>

            {taxAmount > 0 && (
              <div className="flex items-center justify-between text-slate-600">
                <span>Value Added Tax ({taxRate}%)</span>
                <span className="font-medium text-slate-900">{formatEthiopianBirr(taxAmount)}</span>
              </div>
            )}

            {serviceFee > 0 && (
              <div className="flex items-center justify-between text-slate-600">
                <span>Hotel Hospitality Fee (5%)</span>
                <span className="font-medium text-slate-900">{formatEthiopianBirr(serviceFee)}</span>
              </div>
            )}

            {discount > 0 && (
              <div className="flex items-center justify-between text-emerald-700 bg-emerald-50 px-2.5 py-1.5 rounded-lg">
                <span className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider">
                  <Tag className="w-3 h-3" />
                  {quote?.couponCode || 'Promotion'}
                </span>
                <span className="font-bold text-xs">-{formatEthiopianBirr(discount)}</span>
              </div>
            )}

            {/* Total */}
            <div className="pt-3 border-t border-slate-200 flex items-baseline justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-900">Total Price</div>
                <div className="text-[11px] text-slate-500">Taxes & fees included</div>
              </div>
              <div className="text-right">
                <span className="font-serif text-2xl font-bold text-[#0F2942]">
                  {formatEthiopianBirr(total)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Security / Trust badge */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2 text-[11px] text-slate-500">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Guaranteed booking with 256-bit encrypted checkout.</span>
        </div>
      </div>
    </div>
  )
}
