'use client'

import * as React from 'react'
import { Users, Bed, Bath, CheckCircle2, XCircle, ArrowRight } from 'lucide-react'
import type { Room, RoomAvailability } from '@/lib/types'
import { formatEthiopianBirr } from '@/lib/currency'
import { Button } from '@/components/ui/Button'
import { StatusBadge } from '@/components/ui/StatusBadge'

export interface RoomCardProps {
  room: RoomAvailability | Room
  onSelect?: (room: Room) => void
  isSelected?: boolean
  hotelId?: string
  checkIn?: string
  checkOut?: string
  guests?: number
  className?: string
}

const FALLBACK_ROOM_IMG =
  'https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=800&h=600&fit=crop&auto=format'

export function RoomCard({
  room,
  onSelect,
  isSelected = false,
  hotelId,
  checkIn,
  checkOut,
  guests = 2,
  className = '',
}: RoomCardProps) {
  const [imgSrc, setImgSrc] = React.useState(room.primaryImageUrl || FALLBACK_ROOM_IMG)

  const isAvailable =
    'availableAcrossRange' in room ? room.availableAcrossRange : room.status === 'AVAILABLE'

  const price = typeof room.basePrice === 'number' ? room.basePrice : Number(room.basePrice) || 0

  return (
    <div
      className={`rounded-3xl bg-white border transition-all duration-300 overflow-hidden flex flex-col md:flex-row ${
        isSelected
          ? 'border-[#D4AF37] ring-2 ring-[#D4AF37]/30 shadow-xl'
          : 'border-slate-200/80 hover:border-slate-300 shadow-sm hover:shadow-md'
      } ${className}`}
    >
      {/* Room Image */}
      <div className="relative md:w-72 lg:w-80 shrink-0 aspect-[16/10] md:aspect-auto bg-slate-100 overflow-hidden">
        <img
          src={imgSrc}
          alt={`Suite ${room.roomNumber} - ${room.type}`}
          onError={() => setImgSrc(FALLBACK_ROOM_IMG)}
          className="w-full h-full object-cover"
          loading="lazy"
        />
        <div className="absolute top-3 left-3">
          <span className="px-2.5 py-1 rounded-xl bg-[#0F2942]/90 backdrop-blur-md text-white text-xs font-bold uppercase tracking-wider">
            {room.type}
          </span>
        </div>
      </div>

      {/* Room Details */}
      <div className="p-6 flex-1 flex flex-col justify-between">
        <div>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h4 className="font-serif text-xl font-bold text-[#0F2942]">
                Suite {room.roomNumber}
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                {room.type} Suite — Executive Floor
              </p>
            </div>

            {/* Availability Indicator */}
            <div>
              {isAvailable ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Available</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Unavailable</span>
                </span>
              )}
            </div>
          </div>

          {/* Key Specs */}
          <div className="flex flex-wrap gap-4 mt-4 text-xs font-medium text-slate-600">
            <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100">
              <Users className="w-3.5 h-3.5 text-slate-400" />
              <span>Up to {room.capacity} Guests</span>
            </div>
            <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100">
              <Bed className="w-3.5 h-3.5 text-slate-400" />
              <span>{room.beds} {room.beds === 1 ? 'Bed' : 'Beds'}</span>
            </div>
            <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100">
              <Bath className="w-3.5 h-3.5 text-slate-400" />
              <span>{room.bathroom} {room.bathroom === 1 ? 'Bath' : 'Baths'}</span>
            </div>
          </div>

          {/* Description */}
          {room.description && (
            <p className="text-xs text-slate-500 mt-3 line-clamp-2 leading-relaxed">
              {room.description}
            </p>
          )}

          {/* Amenities */}
          {room.amenities && room.amenities.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {room.amenities.map((amenity) => (
                <span
                  key={amenity}
                  className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-600"
                >
                  {amenity}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Action & Price Footer */}
        <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
          <div>
            <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold block">
              Nightly Rate
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="font-serif text-2xl font-bold text-[#0F2942]">
                {formatEthiopianBirr(price)}
              </span>
              <span className="text-xs text-slate-400">/ night</span>
            </div>
          </div>

          {onSelect ? (
            <Button
              variant={isSelected ? 'primary' : 'gold'}
              disabled={!isAvailable}
              onClick={() => onSelect(room)}
            >
              {isSelected ? 'Selected' : 'Select Suite'}
            </Button>
          ) : (
            hotelId && (
              <a
                href={`/booking/${hotelId}?room=${room.id}${checkIn ? `&checkIn=${checkIn}` : ''}${checkOut ? `&checkOut=${checkOut}` : ''}&guests=${guests}`}
              >
                <Button
                  variant="gold"
                  disabled={!isAvailable}
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                >
                  Reserve Suite
                </Button>
              </a>
            )
          )}
        </div>
      </div>
    </div>
  )
}
