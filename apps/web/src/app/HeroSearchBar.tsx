'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Search, MapPin, Calendar, Users } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { GuestSelector, GuestCount } from '@/components/forms/GuestSelector'

export default function HeroSearchBar() {
  const router = useRouter()
  const [isPending, startTransition] = React.useTransition()
  const [destination, setDestination] = React.useState('')
  const [checkIn, setCheckIn] = React.useState('')
  const [checkOut, setCheckOut] = React.useState('')
  const [guests, setGuests] = React.useState<GuestCount>({ adults: 2, children: 0 })

  // Auto-calculate minimum dates
  const todayStr = React.useMemo(() => new Date().toISOString().slice(0, 10), [])

  const handleSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const query = new URLSearchParams()
    if (destination.trim()) query.set('city', destination.trim())
    if (checkIn) query.set('checkIn', checkIn)
    if (checkOut) query.set('checkOut', checkOut)
    query.set('guests', String(guests.adults + guests.children))
    startTransition(() => {
      router.push(`/search?${query.toString()}`)
    })
  }

  return (
    <form
      onSubmit={handleSearch}
      className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl p-4 sm:p-5 border border-white/60 max-w-5xl mx-auto"
    >
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 md:gap-0 divide-y md:divide-y-0 md:divide-x divide-slate-200/80">
        {/* Destination */}
        <div className="px-3 sm:px-4 py-2">
          <label
            htmlFor="hero-destination"
            className="block text-[11px] font-bold uppercase tracking-wider text-[#0F2942] mb-1"
          >
            Destination / City
          </label>
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-[#D4AF37] shrink-0" />
            <input
              id="hero-destination"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="e.g. Addis Ababa, Paris, Dubai"
              className="w-full text-sm font-semibold text-[#0F172A] placeholder:text-slate-400 placeholder:font-normal focus:outline-none bg-transparent"
            />
          </div>
        </div>

        {/* Check-In */}
        <div className="px-3 sm:px-4 py-2">
          <label
            htmlFor="hero-checkin"
            className="block text-[11px] font-bold uppercase tracking-wider text-[#0F2942] mb-1"
          >
            Check-in Date
          </label>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#D4AF37] shrink-0" />
            <input
              id="hero-checkin"
              type="date"
              min={todayStr}
              value={checkIn}
              onChange={(e) => {
                setCheckIn(e.target.value)
                if (checkOut && e.target.value >= checkOut) {
                  setCheckOut('')
                }
              }}
              className="w-full text-sm font-semibold text-[#0F172A] focus:outline-none bg-transparent cursor-pointer"
            />
          </div>
        </div>

        {/* Check-Out */}
        <div className="px-3 sm:px-4 py-2">
          <label
            htmlFor="hero-checkout"
            className="block text-[11px] font-bold uppercase tracking-wider text-[#0F2942] mb-1"
          >
            Check-out Date
          </label>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#D4AF37] shrink-0" />
            <input
              id="hero-checkout"
              type="date"
              min={checkIn || todayStr}
              value={checkOut}
              onChange={(e) => setCheckOut(e.target.value)}
              className="w-full text-sm font-semibold text-[#0F172A] focus:outline-none bg-transparent cursor-pointer"
            />
          </div>
        </div>

        {/* Guests */}
        <div className="px-3 sm:px-4 py-2">
          <label className="block text-[11px] font-bold uppercase tracking-wider text-[#0F2942] mb-1">
            Guests
          </label>
          <GuestSelector value={guests} onChange={setGuests} />
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
        <span className="hidden sm:inline-block text-xs text-slate-400 font-medium">
          Best Rate Guarantee • Instant Confirmation • Verified Properties
        </span>
        <Button
          type="submit"
          variant="gold"
          size="md"
          loading={isPending}
          className="w-full sm:w-auto ml-auto px-8"
          leftIcon={<Search className="w-4 h-4" />}
        >
          {isPending ? 'Searching...' : 'Find Luxury Stays'}
        </Button>
      </div>
    </form>
  )
}
