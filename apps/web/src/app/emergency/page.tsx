'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  Building2,
  Check,
  Copy,
  ExternalLink,
  Flame,
  Globe2,
  HeartPulse,
  Hotel,
  Info,
  MapPin,
  Phone,
  PhoneCall,
  Printer,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Siren,
  Sparkles,
} from 'lucide-react'
import { discoverApi, type EmergencyContactItem } from '@/lib/services'
import { useMyBookingsQuery } from '@/hooks/use-booking'
import { useAuth } from '@/lib/auth-store'
import { useLanguage } from '@/lib/i18n'
import { formatCacheAge, readCachedValue, writeCachedValue } from '@/lib/offline-cache'

interface NationalHotline {
  number: string
  labelKey: string
  descriptionKey: string
  icon: typeof Siren
  color: string
  bg: string
  border: string
}

const NATIONAL_HOTLINES: NationalHotline[] = [
  {
    number: '991',
    labelKey: 'hotlinePoliceLabel',
    descriptionKey: 'hotlinePoliceDescription',
    icon: Siren,
    color: 'text-blue-700',
    bg: 'bg-blue-50',
    border: 'border-blue-200 hover:border-blue-400',
  },
  {
    number: '907',
    labelKey: 'hotlineAmbulanceLabel',
    descriptionKey: 'hotlineAmbulanceDescription',
    icon: HeartPulse,
    color: 'text-rose-700',
    bg: 'bg-rose-50',
    border: 'border-rose-200 hover:border-rose-400',
  },
  {
    number: '939',
    labelKey: 'hotlineFireLabel',
    descriptionKey: 'hotlineFireDescription',
    icon: Flame,
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-200 hover:border-amber-400',
  },
  {
    number: '945',
    labelKey: 'hotlineTrafficLabel',
    descriptionKey: 'hotlineTrafficDescription',
    icon: ShieldAlert,
    color: 'text-emerald-700',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200 hover:border-emerald-400',
  },
]

type CategoryFilter = 'ALL' | 'HOSPITAL' | 'EMBASSY' | 'POLICE' | 'HOTEL'

const CATEGORY_TABS: Array<{ id: CategoryFilter; labelKey: string; icon: typeof Shield }> = [
  { id: 'ALL', labelKey: 'tabAll', icon: Shield },
  { id: 'HOSPITAL', labelKey: 'tabHospitals', icon: HeartPulse },
  { id: 'EMBASSY', labelKey: 'tabEmbassies', icon: Globe2 },
  { id: 'POLICE', labelKey: 'tabPolice', icon: Siren },
  { id: 'HOTEL', labelKey: 'tabHotel', icon: Hotel },
]

export default function EmergencyPage() {
  const { user } = useAuth()
  const { t } = useLanguage()
  const { data: bookingsData } = useMyBookingsQuery('upcoming')
  const [contacts, setContacts] = useState<EmergencyContactItem[]>([])
  const [loading, setLoading] = useState(true)
  const [staleAt, setStaleAt] = useState<number | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<CategoryFilter>('ALL')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // Active stay determination for Pocket Taxi Card
  const activeBooking = useMemo(() => {
    if (!bookingsData?.data || bookingsData.data.length === 0) return null
    return bookingsData.data[0]
  }, [bookingsData])
  const hotelName = activeBooking?.hotel?.name || 'LuxStay Addis Ababa Partner Hotel'
  const hotelAddress = activeBooking?.hotel?.address || 'Bole Sub-City, Near Airport & Meskel Square, Addis Ababa, Ethiopia'
  const hotelNameAm = activeBooking?.hotel?.name ? `ሆቴል ${activeBooking.hotel.name}` : 'ሉክስስቴይ አዲስ አበባ ሆቴል'
  const hotelAddressAm = activeBooking?.hotel?.address || 'ቦሌ ክፍለ ከተማ፣ ከአየር ማረፊያ እና ከመስቀል አደባባይ አቅራቢያ፣ አዲስ አበባ'
  const mapLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${hotelName}, ${hotelAddress}`)}`

  const loadContacts = () => {
    setLoading(true)
    discoverApi
      .emergency({ city: 'Addis Ababa' })
      .then((res) => {
        setContacts(res.data)
        setStaleAt(null)
        writeCachedValue('emergency:addis-ababa', res.data)
      })
      .catch(() => {
        const cached = readCachedValue<EmergencyContactItem[]>('emergency:addis-ababa')
        if (cached) {
          setContacts(cached.value)
          setStaleAt(cached.savedAt)
        } else {
          setContacts([])
        }
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadContacts()
  }, [])

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  // Filtered contacts calculation
  const filteredContacts = useMemo(() => {
    return contacts.filter((c) => {
      // Category match
      if (activeTab !== 'ALL') {
        const kind = c.kind.toUpperCase()
        if (activeTab === 'HOSPITAL' && !kind.includes('HOSPITAL') && !kind.includes('CLINIC') && !kind.includes('AMBULANCE')) return false
        if (activeTab === 'EMBASSY' && !kind.includes('EMBASSY') && !kind.includes('CONSULATE')) return false
        if (activeTab === 'POLICE' && !kind.includes('POLICE') && !kind.includes('FIRE') && !kind.includes('SECURITY')) return false
        if (activeTab === 'HOTEL' && !kind.includes('HOTEL')) return false
      }
      // Search query match
      if (searchQuery.trim().length > 0) {
        const q = searchQuery.toLowerCase()
        const matchName = c.name.toLowerCase().includes(q)
        const matchPhone = c.phone.includes(q)
        const matchCity = c.city?.toLowerCase().includes(q) || false
        const matchSource = c.source?.name?.toLowerCase().includes(q) || false
        return matchName || matchPhone || matchCity || matchSource
      }
      return true
    })
  }, [contacts, activeTab, searchQuery])

  return (
    <main className="min-h-[85vh] bg-[#F8FAFC] px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-5xl">
        {/* Top Header & Print Action */}
        <div className="flex flex-col justify-between gap-4 print:hidden sm:flex-row sm:items-end">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-rose-100 px-3 py-0.5 text-[11px] font-bold uppercase tracking-widest text-rose-800">
                {t('emergency', 'verifiedSafetyDirectory')}
              </span>
              <span className="text-xs text-slate-400">· {t('emergency', 'officialSourcesOnly')}</span>
            </div>
            <h1 className="mt-1.5 font-serif text-3xl font-bold text-[#0F2942] sm:text-4xl">
              {t('emergency', 'title')}
            </h1>
            <p className="mt-1.5 max-w-2xl text-sm text-slate-600">
              {t('emergency', 'subtitle')}
            </p>
          </div>

          <button
            onClick={() => window.print()}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0F2942] px-5 py-3 text-xs font-bold text-white shadow-md transition hover:bg-[#1E3A5F]"
          >
            <Printer className="h-4 w-4 text-[#D4AF37]" /> {t('emergency', 'print')}
          </button>
        </div>

        {/* Safety Warning Banner */}
        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900 shadow-sm print:hidden">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div>
            {t('emergency', 'safetyNoticeTitle')} {t('emergency', 'safetyNoticeBody')}
          </div>
        </div>

        {staleAt && (
          <div className="mt-5 flex flex-col gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 print:hidden sm:flex-row sm:items-center sm:justify-between">
            <span>{t('emergency', 'staleBanner', { age: formatCacheAge(staleAt) })}</span>
            <button type="button" onClick={loadContacts} className="font-semibold underline underline-offset-2">{t('emergency', 'refresh')}</button>
          </div>
        )}

        {/* 1-Click National Hotlines Grid */}
        <section className="mt-8 print:hidden">
          <h2 className="font-serif text-lg font-bold text-[#0F2942]">{t('emergency', 'hotlinesTitle')}</h2>
          <p className="text-xs text-slate-500">{t('emergency', 'hotlinesSubtitle')}</p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {NATIONAL_HOTLINES.map((hotline) => {
              const Icon = hotline.icon
              return (
                <a
                  key={hotline.number}
                  href={`tel:${hotline.number}`}
                  className={`group relative flex flex-col justify-between rounded-2xl border bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${hotline.border}`}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${hotline.bg} ${hotline.color}`}>
                        <Icon className="h-5 w-5" />
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-700">
                        <PhoneCall className="h-3 w-3 text-emerald-600" /> {t('emergency', 'oneTap')}
                      </span>
                    </div>

                    <h3 className="mt-3 font-serif text-base font-bold text-[#0F2942]">
                      {t('emergency', hotline.labelKey)}
                    </h3>
                    <p className="mt-1 text-xs text-slate-400">{t('emergency', hotline.descriptionKey)}</p>
                  </div>

                  <div className="mt-4 flex items-baseline justify-between border-t border-slate-100 pt-3">
                    <span className="font-mono text-2xl font-extrabold tracking-tight text-[#0F2942] group-hover:text-[#2563EB]">
                      {hotline.number}
                    </span>
                    <span className="text-xs font-bold text-[#2563EB] group-hover:underline">
                      {t('emergency', 'callNow')}
                    </span>
                  </div>
                </a>
              )
            })}
          </div>
        </section>

        {/* ==================================================================== */}
        {/* PRINTABLE POCKET TAXI SAFETY CARD (Visible on Screen & in Print)      */}
        {/* ==================================================================== */}
        <section className="mt-10 overflow-hidden rounded-3xl border-2 border-dashed border-[#D4AF37] bg-white p-6 shadow-md sm:p-8 print:m-0 print:border-2 print:border-black print:p-6 print:shadow-none">
          <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-4 sm:flex-row sm:items-center print:border-black">
            <div>
              <span className="rounded-full bg-[#D4AF37]/20 px-3 py-0.5 text-[10px] font-extrabold uppercase tracking-widest text-[#0F2942] print:border print:border-black">
                {t('emergency', 'pocketCardBadge')}
              </span>
              <h2 className="mt-2 font-serif text-xl font-bold text-[#0F2942] print:text-black">
                {t('emergency', 'driverCardTitle')}
              </h2>
            </div>
            <div className="text-right text-xs text-slate-400 print:text-black">
              <span>{t('emergency', 'localEmergencyLabel')} <strong>991 / 907</strong></span>
            </div>
          </div>

          <div className="mt-5 grid gap-6 md:grid-cols-2">
            {/* Left: Amharic Directions to Hotel */}
            <div className="rounded-2xl bg-slate-50 p-5 border border-slate-200 print:bg-white print:border-black">
              <p className="text-xs font-bold uppercase tracking-wider text-[#D4AF37] print:text-black">
                {t('emergency', 'taxiDriverLabel')}
              </p>
              <p className="mt-2 font-serif text-lg font-bold text-[#0F2942] print:text-black">
                እባክዎ ወደዚህ አድራሻ ይውሰዱኝ፦
              </p>
              <div className="mt-3 rounded-xl bg-white p-3.5 border border-slate-200 shadow-sm print:border-black">
                <p className="text-sm font-bold text-[#0F2942] print:text-black">{hotelName}</p>
                <p className="text-sm font-semibold text-[#0F2942] print:text-black">{hotelNameAm}</p>
                <p className="mt-1 text-xs text-slate-600 print:text-black">{hotelAddress}</p>
                <p className="mt-1 text-xs text-slate-600 print:text-black">{hotelAddressAm}</p>
                <p className="mt-2 text-xs font-semibold text-[#0F2942] print:text-black">
                  {t('emergency', 'receptionLabel')}
                </p>
              </div>
              {user && (
                <div className="mt-3 flex items-center justify-between text-xs text-slate-500 print:text-black">
                  <span>{t('emergency', 'guestLabel')} <strong>{user.fullName}</strong></span>
                  {activeBooking?.id && <span>{t('emergency', 'refLabel')} <strong>{activeBooking.id.slice(0, 8).toUpperCase()}</strong></span>}
                </div>
              )}
            </div>

            {/* Right: Quick Emergency Reference for Card */}
            <div className="rounded-2xl bg-slate-50 p-5 border border-slate-200 print:bg-white print:border-black">
              <p className="text-xs font-bold uppercase tracking-wider text-[#0F2942] print:text-black">
                {t('emergency', 'essentialContactsTitle')}
              </p>
              <ul className="mt-3 divide-y divide-slate-200 text-xs text-slate-700 print:divide-black print:text-black">
                <li className="flex justify-between py-2">
                  <span>{t('emergency', 'cardPolice')}</span>
                  <strong className="font-mono">991</strong>
                </li>
                <li className="flex justify-between py-2">
                  <span>{t('emergency', 'cardAmbulance')}</span>
                  <strong className="font-mono">907</strong>
                </li>
                <li className="flex justify-between py-2">
                  <span>{t('emergency', 'cardFire')}</span>
                  <strong className="font-mono">939</strong>
                </li>
                <li className="flex justify-between py-2">
                  <span>{t('emergency', 'cardHospital')}</span>
                  <strong className="font-mono">+251 929 105 653</strong>
                </li>
              </ul>
              <div className="mt-4 border-t border-slate-200 pt-3 print:border-black">
                <p className="text-[11px] font-bold text-[#0F2942] print:text-black">{t('emergency', 'mapLinkLabel')}</p>
                <a href={mapLink} className="mt-1 block break-all text-[11px] text-[#2563EB] underline print:text-black">{t('emergency', 'mapLink')}</a>
              </div>
              <p className="mt-3 text-[11px] text-slate-400 print:text-black">
                {t('emergency', 'verifiedByLine')}
              </p>
            </div>
          </div>
        </section>

        {/* Directory Search & Filter Tabs */}
        <div className="mt-10 print:hidden">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h2 className="font-serif text-xl font-bold text-[#0F2942]">{t('emergency', 'directory')}</h2>
              <p className="text-xs text-slate-500">{t('emergency', 'directorySubtitle')}</p>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('emergency', 'searchPlaceholder')}
                className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 py-2.5 text-xs outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]"
              />
            </div>
          </div>

          {/* Category Filter Tabs */}
          <div className="no-scrollbar mt-4 flex items-center gap-2 overflow-x-auto border-b border-slate-200 pb-3">
            {CATEGORY_TABS.map((tab) => {
              const TabIcon = tab.icon
              const isSelected = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex shrink-0 items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition ${
                    isSelected
                      ? 'bg-[#0F2942] text-white shadow-sm'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  <TabIcon className="h-3.5 w-3.5" />
                  <span>{t('emergency', tab.labelKey)}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Contacts Grid */}
        <section className="mt-6 print:hidden">
          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="h-36 rounded-3xl bg-slate-200 animate-pulse" />
              <div className="h-36 rounded-3xl bg-slate-200 animate-pulse" />
            </div>
          ) : filteredContacts.length === 0 ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center shadow-sm">
              <ShieldAlert className="mx-auto h-10 w-10 text-slate-300" />
              <h3 className="mt-3 font-serif text-lg font-bold text-[#0F2942]">{t('emergency', 'noContactsTitle')}</h3>
              <p className="mt-1 text-xs text-slate-500">{t('emergency', 'noContactsBody')}</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {filteredContacts.map((contact) => {
                const isCopied = copiedId === contact.id
                return (
                  <article
                    key={contact.id}
                    className="flex flex-col justify-between rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-700">
                          {contact.kind}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
                          <ShieldCheck className="h-3.5 w-3.5" /> {t('emergency', 'verified')}
                        </span>
                      </div>

                      <h3 className="mt-3 font-serif text-lg font-bold text-[#0F2942]">
                        {contact.name}
                      </h3>

                      {contact.city && (
                        <p className="flex items-center gap-1 text-xs text-slate-500 mt-1">
                          <MapPin className="h-3 w-3 text-slate-400" />
                          {contact.city}
                        </p>
                      )}
                    </div>

                    <div className="mt-5 border-t border-slate-100 pt-3">
                      <div className="flex items-center justify-between gap-2">
                        <a
                          href={`tel:${contact.phone}`}
                          className="inline-flex items-center gap-2 text-base font-bold text-[#2563EB] hover:underline"
                        >
                          <Phone className="h-4 w-4" /> {contact.phone}
                        </a>
                        <button
                          onClick={() => copyToClipboard(contact.phone, contact.id)}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                          title={t('emergency', 'copyPhone')}
                        >
                          {isCopied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                        </button>
                      </div>

                      <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
                        <span>{t('emergency', 'sourceLabel')} {contact.source?.name || t('emergency', 'officialRegistry')}</span>
                        <span>{new Date(contact.lastVerifiedAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
