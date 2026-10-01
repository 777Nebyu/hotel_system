'use client'

import { useLanguage } from '@/lib/i18n'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import { CalendarDays, ChevronRight, Plus, RefreshCw, Compass } from 'lucide-react'
import AuthGate from '@/components/AuthGate'
import { Button } from '@/components/ui/Button'
import { tripApi, type Trip } from '@/lib/services'
import { formatCacheAge, getCacheScope, readCachedValue, writeCachedValue } from '@/lib/offline-cache'

function TripListContent() {
  const { t } = useLanguage()
  const [trips, setTrips] = useState<Trip[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [staleAt, setStaleAt] = useState<number | null>(null)
  const [title, setTitle] = useState('')
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10))
  const [endDate, setEndDate] = useState(new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10))

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await tripApi.list()
      setTrips(response.data)
      setStaleAt(null)
      writeCachedValue('trips:list:' + getCacheScope(), response.data)
    } catch (err) {
      const cached = readCachedValue<Trip[]>('trips:list:' + getCacheScope())
      if (cached) {
        setTrips(cached.value)
        setStaleAt(cached.savedAt)
      } else {
        setError(err instanceof Error ? err.message : t('trips', 'loadError'))
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const createTrip = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!title.trim()) return
    setCreating(true)
    setError(null)
    try {
      const trip = await tripApi.create({ title: title.trim(), startDate, endDate })
      setTrips((current) => [...current, trip])
      setTitle('')
    } catch (err) {
      setError(err instanceof Error ? err.message : t('trips', 'createError'))
    } finally {
      setCreating(false)
    }
  }

  return (
    <main className="min-h-[85vh] bg-[#F8FAFC] px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#D4AF37]">{t('trips', 'travelCompanion')}</p>
            <h1 className="mt-1 font-serif text-3xl font-bold text-[#0F2942]">{t('trips', 'title')}</h1>
            <p className="mt-2 text-sm text-slate-500">{t('trips', 'subtitle')}</p>
          </div>
          <Link href="/discover" className="inline-flex items-center gap-2 text-sm font-semibold text-[#2563EB] hover:underline"><Compass className="h-4 w-4" /> {t('trips', 'discoverPlaces')}</Link>
        </div>

        <form onSubmit={createTrip} className="mt-8 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-center gap-2 text-sm font-bold text-[#0F2942]"><Plus className="h-4 w-4 text-[#D4AF37]" /> {t('trips', 'create')}</div>
          <div className="mt-4 grid gap-3 md:grid-cols-[1fr_160px_160px_auto]">
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('trips', 'titlePlaceholder')} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#D4AF37]" required />
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm" required />
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm" required />
            <Button type="submit" loading={creating}>{t('trips', 'createButton')}</Button>
          </div>
        </form>

        {staleAt && (
          <div className="mt-5 flex flex-col gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between">
            <span>{t('trips', 'staleBanner', { age: formatCacheAge(staleAt) })}</span>
            <button type="button" onClick={() => void load()} className="font-semibold underline underline-offset-2">{t('trips', 'refresh')}</button>
          </div>
        )}
        {error && <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
        <div className="mt-8 flex items-center justify-between">
          <h2 className="font-serif text-xl font-bold text-[#0F2942]">{t('trips', 'savedItineraries')}</h2>
          <button onClick={() => void load()} className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-[#0F2942]"><RefreshCw className="h-3.5 w-3.5" /> {t('trips', 'refresh')}</button>
        </div>
        {loading ? <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">{t('trips', 'loading')}</div> : trips.length === 0 ? (
          <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-12 text-center shadow-sm"><CalendarDays className="mx-auto h-10 w-10 text-slate-300" /><h3 className="mt-3 font-serif text-xl font-bold text-[#0F2942]">{t('trips', 'empty')}</h3><p className="mt-1 text-sm text-slate-500">{t('trips', 'emptyBody')}</p></div>
        ) : (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {trips.map((trip) => <Link key={trip.id} href={'/trips/' + trip.id} className="group rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-widest text-[#D4AF37]">{t('trips', 'itineraryItems', { count: trip.items.length })}</p><h3 className="mt-1 font-serif text-xl font-bold text-[#0F2942] group-hover:text-[#2563EB]">{trip.title}</h3></div><ChevronRight className="h-5 w-5 text-slate-400 group-hover:text-[#2563EB]" /></div><p className="mt-4 text-sm text-slate-500">{trip.startDate.slice(0, 10)} — {trip.endDate.slice(0, 10)}</p>{trip.hotel && <p className="mt-1 text-xs text-slate-400">{trip.hotel.name}</p>}</Link>)}
          </div>
        )}
      </div>
    </main>
  )
}

export default function TripsPage() {
  return (
    <AuthGate>
      <TripListContent />
    </AuthGate>
  )
}
