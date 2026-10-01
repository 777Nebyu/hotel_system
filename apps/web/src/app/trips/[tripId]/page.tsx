'use client'

import { useLanguage } from '@/lib/i18n'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'

import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Clock3,
  Compass,
  DollarSign,
  Hotel,
  Info,
  Landmark,
  Layers,
  MapPin,
  Plus,
  Printer,
  Sparkles,
  Tag,
  Trash2,
  Utensils,
  XCircle,
  Wand2,
} from 'lucide-react'
import AuthGate from '@/components/AuthGate'
import { Button } from '@/components/ui/Button'
import {
  tripApi,
  type Trip,
  type TripItem,
  type TripItemConflictResponse,
  type BuildDayResponse,
} from '@/lib/services'
import { formatCacheAge, getCacheScope, readCachedValue, writeCachedValue } from '@/lib/offline-cache'
import {
  formatEthiopianBirr,
  formatUSD,
  convertEtbToUsd,
} from '@/lib/currency'

function parseTimeToMinutes(timeStr?: string | null): number | null {
  if (!timeStr) return null
  const [hours, minutes] = timeStr.split(':').map(Number)
  if (isNaN(hours) || isNaN(minutes)) return null
  return hours * 60 + minutes
}

function minutesToTimeString(totalMinutes: number): string {
  const normalized = Math.min(23 * 60 + 59, Math.max(0, totalMinutes))
  const hours = Math.floor(normalized / 60)
  const mins = normalized % 60
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`
}

function getItemCategory(item: TripItem): 'STAY' | 'HERITAGE' | 'DINING' | 'ATTRACTION' | 'CUSTOM' {
  if (item.itemType === 'BOOKING' || item.booking) return 'STAY'
  if (item.place) {
    const cat = item.place.category?.toUpperCase() || ''
    if (cat.includes('HERITAGE') || cat.includes('MUSEUM')) return 'HERITAGE'
    if (cat.includes('RESTAURANT') || cat.includes('CAFE') || cat.includes('COFFEE') || cat.includes('DINING')) return 'DINING'
    return 'ATTRACTION'
  }
  const titleLower = item.title.toLowerCase()
  if (titleLower.includes('hotel') || titleLower.includes('check-in') || titleLower.includes('stay')) return 'STAY'
  if (titleLower.includes('museum') || titleLower.includes('heritage') || titleLower.includes('church')) return 'HERITAGE'
  if (titleLower.includes('coffee') || titleLower.includes('lunch') || titleLower.includes('dinner') || titleLower.includes('breakfast') || titleLower.includes('restaurant')) return 'DINING'
  return 'CUSTOM'
}

const BUILD_DAY_INTERESTS = [
  { id: 'HERITAGE', key: 'interestHeritage' },
  { id: 'DINING', key: 'interestDining' },
  { id: 'ATTRACTION', key: 'interestSightseeing' },
]

const CATEGORY_THEMES = {
  STAY: {
    badge: 'bg-amber-100 text-amber-900 border-amber-300',
    border: 'border-l-amber-500',
    icon: Hotel,
    key: 'catStay',
  },
  HERITAGE: {
    badge: 'bg-emerald-100 text-emerald-900 border-emerald-300',
    border: 'border-l-emerald-600',
    icon: Landmark,
    key: 'catHeritage',
  },
  DINING: {
    badge: 'bg-orange-100 text-orange-900 border-orange-300',
    border: 'border-l-orange-500',
    icon: Utensils,
    key: 'catDining',
  },
  ATTRACTION: {
    badge: 'bg-indigo-100 text-indigo-900 border-indigo-300',
    border: 'border-l-indigo-500',
    icon: Compass,
    key: 'catSightseeing',
  },
  CUSTOM: {
    badge: 'bg-slate-100 text-slate-800 border-slate-300',
    border: 'border-l-slate-400',
    icon: Clock,
    key: 'catCustom',
  },
}

function generateDateRange(startDateStr: string, endDateStr: string): string[] {
  const dates: string[] = []
  try {
    const current = new Date(startDateStr)
    const end = new Date(endDateStr)
    // Safety guard max 30 days
    let iterations = 0
    while (current <= end && iterations < 30) {
      dates.push(current.toISOString().slice(0, 10))
      current.setDate(current.getDate() + 1)
      iterations++
    }
  } catch {
    // Fallback if parsing fails
    dates.push(startDateStr.slice(0, 10))
  }
  return dates.length > 0 ? dates : [startDateStr.slice(0, 10)]
}

interface ConflictDetail {
  conflictingItemId: string
  conflictingItemTitle: string
  conflictingWindow: string
  currentItemId: string
  currentItemTitle: string
  suggestedStartTime: string
  dayDate: string
}

function TripDetailContent() {
  const { t } = useLanguage()
  const params = useParams<{ tripId: string }>()
  const tripId = params.tripId
  const [trip, setTrip] = useState<Trip | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [adjusting, setAdjusting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [staleAt, setStaleAt] = useState<number | null>(null)
  const [activeDay, setActiveDay] = useState<string>('ALL')
  const [showAddForm, setShowAddForm] = useState(false)

  // Add Item form state
  const [dayDate, setDayDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [costAmount, setCostAmount] = useState('')
  const [durationMin, setDurationMin] = useState('60')
  const [activeConflict, setActiveConflict] = useState<ConflictDetail | null>(null)
  const [showBuildDay, setShowBuildDay] = useState(false)
  const [buildDayDate, setBuildDayDate] = useState('')
  const [buildDuration, setBuildDuration] = useState<'2_HOURS' | 'HALF_DAY' | 'FULL_DAY'>('HALF_DAY')
  const [buildStartTime, setBuildStartTime] = useState('09:00')
  const [buildInterests, setBuildInterests] = useState<string[]>([])
  const [buildProposal, setBuildProposal] = useState<BuildDayResponse | null>(null)
  const [buildingDay, setBuildingDay] = useState(false)
  const [confirmingBuild, setConfirmingBuild] = useState(false)

  const loadTrip = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await tripApi.get(tripId)
      setTrip(response)
      setStaleAt(null)
      writeCachedValue('trip:' + getCacheScope() + ':' + tripId, response)
      if (!dayDate) {
        setDayDate(response.startDate.slice(0, 10))
      }
    } catch (err) {
      const cached = readCachedValue<Trip>('trip:' + getCacheScope() + ':' + tripId)
      if (cached) {
        setTrip(cached.value)
        setStaleAt(cached.savedAt)
        if (!dayDate) {
          setDayDate(cached.value.startDate.slice(0, 10))
        }
      } else {
        setError(err instanceof Error ? err.message : t('trips', 'loadTripError'))
      }
    } finally {
      setLoading(false)
    }
  }, [tripId, dayDate])

  useEffect(() => {
    if (tripId) void loadTrip()
  }, [tripId, loadTrip])

  // Days list calculation
  const tripDays = useMemo(() => {
    if (!trip) return []
    return generateDateRange(trip.startDate, trip.endDate)
  }, [trip])

  // Budget calculations
  const budgetStats = useMemo(() => {
    if (!trip) return { totalEtb: 0, totalUsd: 0, doneEtb: 0, plannedEtb: 0, byCategory: {} as Record<string, number> }
    let totalEtb = 0
    let doneEtb = 0
    let plannedEtb = 0
    const byCategory: Record<string, number> = {}

    trip.items.forEach((item) => {
      const amount = Number(item.costAmount) || 0
      if (amount > 0) {
        totalEtb += amount
        if (item.status === 'DONE') doneEtb += amount
        if (item.status === 'PLANNED') plannedEtb += amount
        const cat = getItemCategory(item)
        byCategory[cat] = (byCategory[cat] || 0) + amount
      }
    })

    return {
      totalEtb,
      totalUsd: convertEtbToUsd(totalEtb),
      doneEtb,
      plannedEtb,
      byCategory,
    }
  }, [trip])

  // Filtered items based on active tab
  const displayedItems = useMemo(() => {
    if (!trip) return []
    const list = activeDay === 'ALL'
      ? [...trip.items]
      : trip.items.filter((item) => item.dayDate.slice(0, 10) === activeDay)

    // Sort by dayDate, then startTime
    return list.sort((a, b) => {
      if (a.dayDate !== b.dayDate) return a.dayDate.localeCompare(b.dayDate)
      const aStart = a.startTime || '99:99'
      const bStart = b.startTime || '99:99'
      return aStart.localeCompare(bStart)
    })
  }, [trip, activeDay])

  // Conflict detector on client for rich inline feedback
  const checkForConflicts = (newItem: TripItem, allItems: TripItem[]): ConflictDetail | null => {
    if (!newItem.startTime || !newItem.durationMin) return null
    const startM = parseTimeToMinutes(newItem.startTime)
    if (startM === null) return null
    const endM = startM + newItem.durationMin

    const sameDayItems = allItems.filter(
      (item) =>
        item.id !== newItem.id &&
        item.dayDate.slice(0, 10) === newItem.dayDate.slice(0, 10) &&
        item.startTime &&
        item.status !== 'SKIPPED'
    )

    for (const other of sameDayItems) {
      const otherStart = parseTimeToMinutes(other.startTime)
      if (otherStart === null) continue
      const otherEnd = otherStart + (other.durationMin || 60)

      const isOverlap = Math.max(startM, otherStart) < Math.min(endM, otherEnd)
      if (isOverlap) {
        return {
          conflictingItemId: other.id,
          conflictingItemTitle: other.title,
          conflictingWindow: `${other.startTime} - ${minutesToTimeString(otherEnd)}`,
          currentItemId: newItem.id,
          currentItemTitle: newItem.title,
          suggestedStartTime: minutesToTimeString(otherEnd + 15),
          dayDate: newItem.dayDate.slice(0, 10),
        }
      }
    }
    return null
  }

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !dayDate || !trip) return
    setSaving(true)
    setError(null)
    setActiveConflict(null)

    try {
      const payload = {
        dayDate,
        title: title.trim(),
        itemType: 'CUSTOM' as const,
        startTime: startTime || undefined,
        durationMin: startTime ? Number(durationMin) || 60 : undefined,
        notes: notes.trim() || undefined,
        costAmount: costAmount ? Number(costAmount) : undefined,
        currency: 'ETB',
      }

      const response: TripItemConflictResponse = await tripApi.addItem(tripId, payload)
      const updatedTrip = { ...trip, items: [...trip.items, response.item] }
      setTrip(updatedTrip)

      // Check conflict
      if (response.hasConflict && response.conflictWith.length > 0) {
        const primary = response.conflictWith[0]
        const otherItem = trip.items.find((i) => i.id === primary.id)
        const otherEnd = otherItem && otherItem.startTime
          ? (parseTimeToMinutes(otherItem.startTime) || 0) + (otherItem.durationMin || 60)
          : 0

        setActiveConflict({
          conflictingItemId: primary.id,
          conflictingItemTitle: primary.title,
          conflictingWindow: primary.timeWindow,
          currentItemId: response.item.id,
          currentItemTitle: response.item.title,
          suggestedStartTime: otherEnd > 0 ? minutesToTimeString(otherEnd + 15) : '15:00',
          dayDate: response.item.dayDate.slice(0, 10),
        })
      } else {
        const clientConflict = checkForConflicts(response.item, updatedTrip.items)
        if (clientConflict) setActiveConflict(clientConflict)
      }

      // Reset form
      setTitle('')
      setNotes('')
      setCostAmount('')
      setStartTime('')
      setShowAddForm(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('trips', 'addError'))
    } finally {
      setSaving(false)
    }
  }

  const handleBuildDay = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!trip || !buildDayDate) return
    setBuildingDay(true)
    setError(null)
    try {
      const response = await tripApi.buildDay(tripId, {
        dayDate: buildDayDate,
        duration: buildDuration,
        startTime: buildStartTime,
        interests: buildInterests,
      })
      setBuildProposal(response)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('trips', 'buildDayError'))
    } finally {
      setBuildingDay(false)
    }
  }

  const handleConfirmBuildDay = async () => {
    if (!trip || !buildProposal || buildProposal.proposal.length === 0) return
    setConfirmingBuild(true)
    setError(null)
    try {
      const addedItems: TripItem[] = []
      let conflictCount = 0
      for (const proposal of buildProposal.proposal) {
        const response = await tripApi.addItem(tripId, {
          dayDate: proposal.dayDate,
          startTime: proposal.startTime,
          durationMin: proposal.durationMin,
          itemType: 'PLACE',
          placeId: proposal.placeId,
          title: proposal.title,
          notes: proposal.notes,
          costAmount: proposal.estimatedCostEtb,
          currency: 'ETB',
          createdBy: 'AI',
          userConfirmed: true,
        })
        addedItems.push(response.item)
        if (response.hasConflict) conflictCount += 1
      }
      setTrip({ ...trip, items: [...trip.items, ...addedItems] })
      setActiveDay(buildProposal.dayDate)
      setBuildProposal(null)
      setShowBuildDay(false)
      if (conflictCount > 0) {
        setError(t('trips', 'draftConflicts', { count: conflictCount }))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('trips', 'saveDayPlanError'))
    } finally {
      setConfirmingBuild(false)
    }
  }

  const handleAutoAdjustTime = async () => {
    if (!activeConflict || !trip) return
    setAdjusting(true)
    try {
      const response = await tripApi.updateItem(tripId, activeConflict.currentItemId, {
        startTime: activeConflict.suggestedStartTime,
      })
      setTrip({
        ...trip,
        items: trip.items.map((entry) =>
          entry.id === activeConflict.currentItemId ? response.item : entry
        ),
      })
      setActiveConflict(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('trips', 'adjustError'))
    } finally {
      setAdjusting(false)
    }
  }

  const handleStatusChange = async (item: TripItem, newStatus: TripItem['status']) => {
    if (!trip) return
    try {
      const response = await tripApi.updateItem(tripId, item.id, { status: newStatus })
      setTrip({
        ...trip,
        items: trip.items.map((entry) => (entry.id === item.id ? response.item : entry)),
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : t('trips', 'statusError'))
    }
  }

  const handleRemoveItem = async (item: TripItem) => {
    if (!trip) return
    try {
      await tripApi.removeItem(tripId, item.id)
      setTrip({
        ...trip,
        items: trip.items.filter((entry) => entry.id !== item.id),
      })
      if (activeConflict && (activeConflict.currentItemId === item.id || activeConflict.conflictingItemId === item.id)) {
        setActiveConflict(null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('trips', 'removeError'))
    }
  }

  if (loading) {
    return (
      <main className="min-h-[85vh] bg-[#F8FAFC] px-4 py-12 sm:px-6">
        <div className="mx-auto max-w-5xl animate-pulse space-y-6">
          <div className="h-6 w-32 rounded-lg bg-slate-200" />
          <div className="h-44 rounded-3xl bg-slate-200" />
          <div className="h-12 rounded-2xl bg-slate-200" />
          <div className="space-y-4">
            <div className="h-28 rounded-2xl bg-slate-200" />
            <div className="h-28 rounded-2xl bg-slate-200" />
          </div>
        </div>
      </main>
    )
  }

  if (!trip) {
    return (
      <main className="min-h-[85vh] bg-[#F8FAFC] px-4 py-16 text-center sm:px-6">
        <div className="mx-auto max-w-md rounded-3xl border border-red-200 bg-white p-8 shadow-sm">
          <XCircle className="mx-auto h-12 w-12 text-red-500" />
          <h1 className="mt-3 font-serif text-2xl font-bold text-[#0F2942]">{t('trips', 'notFoundTitle')}</h1>
          <p className="mt-2 text-sm text-slate-500">{error || t('trips', 'notFoundBody')}</p>
          <Link href="/trips" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#0F2942] px-4 py-2.5 text-xs font-bold text-white">
            <ArrowLeft className="h-4 w-4" /> {t('trips', 'backToMyTrips')}
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-[85vh] bg-[#F8FAFC] px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-5xl">
        {/* Navigation & Header Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
          <Link
            href="/trips"
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#0F2942] transition hover:text-[#D4AF37]"
          >
            <ArrowLeft className="h-4 w-4" /> {t('trips', 'backToTrips')}
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href="/discover"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-[#0F2942] shadow-sm transition hover:border-[#D4AF37] hover:text-[#D4AF37]"
            >
              <Compass className="h-3.5 w-3.5 text-[#D4AF37]" /> {t('trips', 'exploreNearby')}
            </Link>
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <Printer className="h-3.5 w-3.5" /> {t('trips', 'printItinerary')}
            </button>
          </div>
        </div>

        {/* Hero Trip Summary Card */}
        <div className="mt-5 overflow-hidden rounded-3xl bg-gradient-to-br from-[#0F2942] to-[#1E3A5F] p-6 text-white shadow-xl sm:p-8">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-start">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-[#D4AF37]/20 px-3 py-0.5 text-[11px] font-bold uppercase tracking-widest text-[#D4AF37]">
                  {t('trips', 'privateStayItinerary')}
                </span>
                <span className="text-xs text-white/60">· {trip.timezone}</span>
              </div>
              <h1 className="font-serif text-3xl font-bold tracking-tight sm:text-4xl">
                {trip.title}
              </h1>
              <p className="flex items-center gap-2 text-sm text-white/80">
                <Calendar className="h-4 w-4 text-[#D4AF37]" />
                {new Date(trip.startDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                {' — '}
                {new Date(trip.endDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                <span className="text-xs text-white/50">{t('trips', tripDays.length === 1 ? 'daySingular' : 'dayPlural', { count: tripDays.length })}</span>
              </p>
            </div>

            {/* Budget Tracker Pill */}
            <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-md">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#D4AF37]">
                {t('trips', 'budgetTracker')}
              </p>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-white">
                  {formatEthiopianBirr(budgetStats.totalEtb)}
                </span>
                <span className="text-sm font-semibold text-white/70">
                  (~{formatUSD(budgetStats.totalUsd)})
                </span>
              </div>
              <div className="mt-2 flex items-center gap-3 text-xs text-white/70">
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  {t('trips', 'doneLabel', { amount: formatEthiopianBirr(budgetStats.doneEtb) })}
                </span>
                <span>·</span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5 text-amber-300" />
                  {t('trips', 'plannedLabel', { amount: formatEthiopianBirr(budgetStats.plannedEtb) })}
                </span>
              </div>
            </div>
          </div>

          {/* Linked Hotel Stay Card */}
          {trip.hotel && (
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-4 py-3 text-sm">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-[#D4AF37]/20 p-2 text-[#D4AF37]">
                  <Hotel className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold text-white">{trip.hotel.name}</p>
                  <p className="text-xs text-white/70">{trip.hotel.address}</p>
                </div>
              </div>
              {trip.booking && (
                <div className="flex items-center gap-2 rounded-xl bg-black/20 px-3 py-1.5 text-xs text-white">
                  <Tag className="h-3.5 w-3.5 text-[#D4AF37]" />
                  <span>{t('trips', 'refLabel')} <strong>{trip.booking.bookingRef}</strong></span>
                  <span className="text-white/50">{t('trips', 'bookingRange', { from: trip.booking.checkIn.slice(0, 10), to: trip.booking.checkOut.slice(0, 10) })}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Global Error Banner */}
        {staleAt && (
          <div className="mb-5 flex flex-col gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between">
            <span>{t('trips', 'staleTripBanner', { age: formatCacheAge(staleAt) })}</span>
            <button type="button" onClick={() => void loadTrip()} className="font-semibold underline underline-offset-2">{t('trips', 'refresh')}</button>
          </div>
        )}

        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <XCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Schedule Overlap / Conflict Warning Banner (TRIP-005) */}
        {activeConflict && (
          <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              <div>
                <h4 className="text-sm font-bold text-amber-950">{t('trips', 'conflictTitle')}</h4>
                <p className="mt-0.5 text-xs text-amber-800">
                  {t('trips', 'conflictBody', { current: activeConflict.currentItemTitle, other: activeConflict.conflictingItemTitle, window: activeConflict.conflictingWindow })}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 self-end sm:self-center">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setActiveConflict(null)}
                className="border-amber-300 bg-white text-xs text-amber-900 hover:bg-amber-100"
              >
                {t('trips', 'keepBoth')}
              </Button>
              <Button
                size="sm"
                loading={adjusting}
                onClick={handleAutoAdjustTime}
                className="bg-amber-600 text-xs font-bold text-white hover:bg-amber-700"
              >
                <Wand2 className="mr-1.5 h-3.5 w-3.5" />
                {t('trips', 'autoAdjust', { time: activeConflict.suggestedStartTime })}
              </Button>
            </div>
          </div>
        )}

        {/* Day Selector Horizontal Tabs */}
        <div className="mt-8 flex items-center justify-between gap-4 border-b border-slate-200 pb-3">
          <div className="no-scrollbar flex items-center gap-2 overflow-x-auto">
            <button
              onClick={() => setActiveDay('ALL')}
              className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
                activeDay === 'ALL'
                  ? 'bg-[#0F2942] text-white shadow-sm'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {t('trips', 'allDays', { count: trip.items.length })}
            </button>
            {tripDays.map((dayStr, idx) => {
              const dayCount = trip.items.filter((item) => item.dayDate.slice(0, 10) === dayStr).length
              const isSelected = activeDay === dayStr
              const dateObj = new Date(dayStr)
              const formatted = dateObj.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })

              return (
                <button
                  key={dayStr}
                  onClick={() => setActiveDay(dayStr)}
                  className={`flex shrink-0 items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition ${
                    isSelected
                      ? 'bg-[#0F2942] text-white shadow-sm'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  <span>{t('trips', 'dayNumber', { number: idx + 1 })}</span>
                  <span className={`text-[11px] font-normal ${isSelected ? 'text-white/70' : 'text-slate-400'}`}>
                    · {formatted}
                  </span>
                  {dayCount > 0 && (
                    <span
                      className={`ml-1 rounded-full px-1.5 py-0.2 text-[10px] font-extrabold ${
                        isSelected ? 'bg-[#D4AF37] text-[#0F2942]' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {dayCount}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setBuildDayDate(activeDay === 'ALL' ? trip.startDate.slice(0, 10) : activeDay)
                setBuildProposal(null)
                setShowBuildDay(!showBuildDay)
              }}
              className="border-[#D4AF37] bg-white text-xs font-bold text-[#0F2942] hover:bg-[#FEF9E7]"
            >
              <Wand2 className="mr-1 h-3.5 w-3.5 text-[#D4AF37]" /> {t('trips', 'buildMyDay')}
            </Button>
            <Button
              size="sm"
              onClick={() => setShowAddForm(!showAddForm)}
              className="bg-[#0F2942] text-xs font-bold text-white hover:bg-[#1E3A5F]"
            >
              <Plus className="mr-1 h-3.5 w-3.5 text-[#D4AF37]" /> {t('trips', 'addActivity')}
            </Button>
          </div>
        </div>

        {/* Build My Day draft panel */}
        {showBuildDay && (
          <section className="mt-5 rounded-3xl border border-[#D4AF37]/40 bg-white p-5 shadow-md sm:p-6" aria-labelledby="build-day-title">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#D4AF37]">{t('trips', 'aiPlanning')}</p>
                <h2 id="build-day-title" className="mt-1 font-serif text-xl font-bold text-[#0F2942]">{t('trips', 'buildMyDay')}</h2>
                <p className="mt-1 text-xs text-slate-500">{t('trips', 'buildDaySubtitle')}</p>
              </div>
              <button type="button" onClick={() => { setShowBuildDay(false); setBuildProposal(null) }} className="text-xs font-semibold text-slate-400 hover:text-slate-700">{t('trips', 'dismiss')}</button>
            </div>

            {!buildProposal && (
              <form onSubmit={handleBuildDay} className="mt-5 space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-500">{t('trips', 'day')}</label>
                    <input type="date" value={buildDayDate} min={trip.startDate.slice(0, 10)} max={trip.endDate.slice(0, 10)} onChange={(e) => setBuildDayDate(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#D4AF37]" required />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-500">{t('trips', 'duration')}</label>
                    <select value={buildDuration} onChange={(e) => setBuildDuration(e.target.value as typeof buildDuration)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#D4AF37]">
                      <option value="2_HOURS">{t('trips', 'duration2h')}</option>
                      <option value="HALF_DAY">{t('trips', 'durationHalf')}</option>
                      <option value="FULL_DAY">{t('trips', 'durationFull')}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-500">{t('trips', 'startTime')}</label>
                    <input type="time" value={buildStartTime} onChange={(e) => setBuildStartTime(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#D4AF37]" required />
                  </div>
                </div>

                <div>
                  <span className="block text-xs font-bold uppercase text-slate-500">{t('trips', 'interests')}</span>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {BUILD_DAY_INTERESTS.map((interest) => {
                      const selected = buildInterests.includes(interest.id)
                      return (
                        <button
                          key={interest.id}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => setBuildInterests((current) => selected ? current.filter((value) => value !== interest.id) : [...current, interest.id])}
                          className={'rounded-full border px-3 py-1.5 text-xs font-bold transition ' + (selected ? 'border-[#0F2942] bg-[#0F2942] text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-[#D4AF37]')}
                        >
                          {t('trips', interest.key)}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="flex justify-end border-t border-slate-100 pt-4">
                  <Button type="submit" loading={buildingDay} className="bg-[#0F2942] text-xs font-bold text-white hover:bg-[#1E3A5F]">
                    <Wand2 className="mr-1.5 h-3.5 w-3.5 text-[#D4AF37]" /> {t('trips', 'generateDraft')}
                  </Button>
                </div>
              </form>
            )}

            {buildProposal && (
              <div className="mt-5">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-bold text-[#0F2942]">{t('trips', 'verifiedStops', { stops: buildProposal.proposal.length, minutes: buildProposal.totalDurationMin })}</p>
                    <span className="text-xs font-semibold text-slate-500">{t('trips', 'estimated', { amount: formatEthiopianBirr(buildProposal.estimatedBudgetEtb) })}</span>
                  </div>
                  <div className="mt-3 space-y-2">
                    {buildProposal.proposal.map((proposal) => (
                      <div key={proposal.placeId} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-[#0F2942]">{proposal.title}</p>
                          <p className="mt-1 text-xs text-slate-500">{t('trips', 'proposalMeta', { time: proposal.startTime, minutes: proposal.durationMin, address: proposal.place.address })}</p>
                        </div>
                        <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700">{proposal.category}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setBuildProposal(null)} className="text-xs">{t('trips', 'regenerate')}</Button>
                  <Button type="button" loading={confirmingBuild} onClick={() => void handleConfirmBuildDay()} className="bg-[#0F2942] text-xs font-bold text-white hover:bg-[#1E3A5F]">
                    <Check className="mr-1.5 h-3.5 w-3.5 text-emerald-300" /> {t('trips', 'confirmAddToTrip')}
                  </Button>
                </div>
              </div>
            )}
          </section>
        )}

        {/* Add Activity Form Panel */}
        {showAddForm && (
          <form
            onSubmit={handleAddItem}
            className="mt-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-md sm:p-6"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-serif text-lg font-bold text-[#0F2942]">{t('trips', 'addItineraryActivity')}</h3>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="text-xs font-semibold text-slate-400 hover:text-slate-600"
              >
                {t('trips', 'cancel')}
              </button>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold uppercase text-slate-500">{t('trips', 'activityTitle')}</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={t('trips', 'activityTitlePlaceholder')}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#D4AF37]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-500">{t('trips', 'date')}</label>
                <input
                  type="date"
                  value={dayDate}
                  min={trip.startDate.slice(0, 10)}
                  max={trip.endDate.slice(0, 10)}
                  onChange={(e) => setDayDate(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#D4AF37]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-500">{t('trips', 'estimatedCost')}</label>
                <input
                  type="number"
                  min="0"
                  step="50"
                  value={costAmount}
                  onChange={(e) => setCostAmount(e.target.value)}
                  placeholder={t('trips', 'costPlaceholder')}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#D4AF37]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-500">{t('trips', 'startTimeOptional')}</label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#D4AF37]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-500">{t('trips', 'durationMinutes')}</label>
                <select
                  value={durationMin}
                  onChange={(e) => setDurationMin(e.target.value)}
                  disabled={!startTime}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none disabled:bg-slate-50"
                >
                  <option value="30">{t('trips', 'durationOpt30')}</option>
                  <option value="60">{t('trips', 'durationOpt60')}</option>
                  <option value="90">{t('trips', 'durationOpt90')}</option>
                  <option value="120">{t('trips', 'durationOpt120')}</option>
                  <option value="180">{t('trips', 'durationOpt180')}</option>
                  <option value="240">{t('trips', 'durationOpt240')}</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold uppercase text-slate-500">{t('trips', 'notesLabel')}</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={t('trips', 'notesPlaceholder')}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#D4AF37]"
                />
              </div>
            </div>

            <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
              <p className="text-xs text-slate-400">
                <Info className="mr-1 inline h-3.5 w-3.5" />
                {t('trips', 'overlapInfo')}
              </p>
              <Button type="submit" loading={saving} className="bg-[#0F2942] text-xs font-bold text-white hover:bg-[#1E3A5F]">
                {t('trips', 'addToItinerary')}
              </Button>
            </div>
          </form>
        )}

        {/* Timeline Canvas Section */}
        <div className="mt-8">
          {displayedItems.length === 0 ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center shadow-sm">
              <Clock3 className="mx-auto h-12 w-12 text-slate-300" />
              <h3 className="mt-3 font-serif text-xl font-bold text-[#0F2942]">{t('trips', 'noActivitiesTitle')}</h3>
              <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
                {t('trips', 'noActivitiesBody')}
              </p>
              <div className="mt-6 flex justify-center gap-3">
                <Button
                  onClick={() => {
                    setDayDate(activeDay === 'ALL' ? trip.startDate.slice(0, 10) : activeDay)
                    setShowAddForm(true)
                  }}
                  className="bg-[#0F2942] text-xs font-bold text-white hover:bg-[#1E3A5F]"
                >
                  <Plus className="mr-1 h-3.5 w-3.5" /> {t('trips', 'addActivity')}
                </Button>
                <Link
                  href="/discover"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-sm hover:border-[#D4AF37]"
                >
                  <Compass className="h-3.5 w-3.5 text-[#D4AF37]" /> {t('trips', 'discoverPlacesTitle')}
                </Link>
              </div>
            </div>
          ) : (
            <div className="relative space-y-4 before:absolute before:bottom-3 before:left-[19px] before:top-3 before:w-0.5 before:bg-slate-200">
              {displayedItems.map((item) => {
                const category = getItemCategory(item)
                const theme = CATEGORY_THEMES[category]
                const IconComponent = theme.icon
                const isDone = item.status === 'DONE'
                const isSkipped = item.status === 'SKIPPED'
                const formattedDate = new Date(item.dayDate).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                })

                return (
                  <article
                    key={item.id}
                    className={`relative ml-10 rounded-2xl border border-slate-200 border-l-4 ${theme.border} bg-white p-5 shadow-sm transition hover:shadow-md ${
                      isDone ? 'opacity-75 bg-slate-50/70' : isSkipped ? 'opacity-50' : ''
                    }`}
                  >
                    {/* Circle Node on Timeline Track */}
                    <div className="absolute -left-[31px] top-5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-[#0F2942] text-white shadow-sm">
                      {isDone ? (
                        <Check className="h-3 w-3 text-emerald-400" />
                      ) : (
                        <div className="h-2 w-2 rounded-full bg-[#D4AF37]" />
                      )}
                    </div>

                    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                      {/* Left: Content & Badges */}
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${theme.badge}`}>
                            <IconComponent className="h-3 w-3" />
                            {t('trips', theme.key)}
                          </span>

                          {item.startTime ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                              <Clock className="h-3 w-3 text-slate-500" />
                              {item.startTime}
                              {item.durationMin ? ` (${item.durationMin} ${t('trips', 'minutesShort')})` : ''}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">{t('trips', 'flexibleTime')}</span>
                          )}

                          <span className="text-xs text-slate-400">· {formattedDate}</span>

                          {item.createdBy === 'AI' && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2 py-0.5 text-[10px] font-bold text-purple-700 border border-purple-200">
                              <Sparkles className="h-2.5 w-2.5" /> {t('trips', 'aiDrafted')}
                            </span>
                          )}
                        </div>

                        <h3 className={`font-serif text-lg font-bold text-[#0F2942] ${isDone ? 'line-through text-slate-500' : ''}`}>
                          {item.title}
                        </h3>

                        {item.place && (
                          <p className="flex items-center gap-1 text-xs text-slate-500">
                            <MapPin className="h-3 w-3 text-red-400" />
                            {item.place.address || item.place.name}
                          </p>
                        )}

                        {item.notes && (
                          <p className="text-xs text-slate-600 bg-slate-50 rounded-xl p-2.5 border border-slate-100 mt-2">
                            {item.notes}
                          </p>
                        )}
                      </div>

                      {/* Right: Budget & Status Controls */}
                      <div className="flex flex-row items-center justify-between gap-3 border-t border-slate-100 pt-3 sm:flex-col sm:items-end sm:border-0 sm:pt-0">
                        {item.costAmount && Number(item.costAmount) > 0 ? (
                          <div className="text-right">
                            <span className="text-sm font-bold text-[#0F2942]">
                              {formatEthiopianBirr(item.costAmount)}
                            </span>
                            <span className="block text-[11px] text-slate-400">
                              ~{formatUSD(convertEtbToUsd(item.costAmount))}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">{t('trips', 'noCost')}</span>
                        )}

                        <div className="flex items-center gap-2">
                          <select
                            value={item.status}
                            onChange={(e) => handleStatusChange(item, e.target.value as TripItem['status'])}
                            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 outline-none"
                          >
                            <option value="PLANNED">{t('trips', 'statusPlanned')}</option>
                            <option value="DONE">{t('trips', 'statusCompleted')}</option>
                            <option value="SKIPPED">{t('trips', 'statusSkipped')}</option>
                          </select>

                          <button
                            onClick={() => handleRemoveItem(item)}
                            title={t('trips', 'removeActivity')}
                            className="rounded-lg p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 transition"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}

export default function TripDetailPage() {
  return (
    <AuthGate>
      <TripDetailContent />
    </AuthGate>
  )
}
