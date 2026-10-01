'use client'

import * as React from 'react'
import Image from 'next/image'
import { Users, Bed, Bath, CheckCircle2, XCircle, ArrowRight } from 'lucide-react'
import type { Room, RoomAvailability } from '@/lib/types'
import { formatEthiopianBirr } from '@/lib/currency'
import { Button } from '@/components/ui/Button'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { useLanguage } from '@/lib/i18n'

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
  'https://upload.wikimedia.org/wikipedia/commons/thumb/4/42/Canopy_bed_of_Amantaka_Suite_in_Amantaka_luxury_Resort_%26_Hotel_in_Luang_Prabang_Laos.jpg/960px-Canopy_bed_of_Amantaka_Suite_in_Amantaka_luxury_Resort_%26_Hotel_in_Luang_Prabang_Laos.jpg'

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
  const { t } = useLanguage()
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
        <Image
          src={imgSrc}
          alt={t('hotel', 'roomImageAlt', { number: room.roomNumber, type: room.type })}
          onError={() => setImgSrc(FALLBACK_ROOM_IMG)}
          width={640}
          height={400}
          className="h-full w-full object-cover"
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
                {t('hotel', 'suiteNumber', { number: room.roomNumber })}
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                {t('hotel', 'suiteExecutiveFloor', { type: room.type })}
              </p>
            </div>

            {/* Availability Indicator */}
            <div>
              {isAvailable ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{t('hotel', 'availableLabel')}</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
                  <XCircle className="w-3.5 h-3.5" />
                  <span>{t('hotel', 'unavailableLabel')}</span>
                </span>
              )}
            </div>
          </div>

          {/* Key Specs */}
          <div className="flex flex-wrap gap-4 mt-4 text-xs font-medium text-slate-600">
            <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100">
              <Users className="w-3.5 h-3.5 text-slate-400" />
              <span>{t('hotel', 'upToGuests', { count: room.capacity })}</span>
            </div>
            <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100">
              <Bed className="w-3.5 h-3.5 text-slate-400" />
              <span>{t('hotel', room.beds === 1 ? 'bedCountOne' : 'bedCountMany', { count: room.beds })}</span>
            </div>
            <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100">
              <Bath className="w-3.5 h-3.5 text-slate-400" />
              <span>{t('hotel', room.bathroom === 1 ? 'bathCountOne' : 'bathCountMany', { count: room.bathroom })}</span>
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
              {t('hotel', 'nightlyRate')}
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="font-serif text-2xl font-bold text-[#0F2942]">
                {formatEthiopianBirr(price)}
              </span>
              <span className="text-xs text-slate-400">{t('hotel', 'perNightSlash')}</span>
            </div>
          </div>

          {onSelect ? (
            <Button
              variant={isSelected ? 'primary' : 'gold'}
              disabled={!isAvailable}
              onClick={() => onSelect(room)}
            >
              {isSelected ? t('hotel', 'selectedLabel') : t('hotel', 'selectSuite')}
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
                  {t('hotel', 'reserveSuite')}
                </Button>
              </a>
            )
          )}
        </div>
      </div>
    </div>
  )
}
