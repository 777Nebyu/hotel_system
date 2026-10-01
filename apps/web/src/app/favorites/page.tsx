'use client'

import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft, Heart, MapPin, Star, Compass } from 'lucide-react'
import AuthGate from '@/components/AuthGate'
import { Skeleton } from '@/components/ui/Skeleton'
import { Button } from '@/components/ui/Button'
import { useFavoritesQuery } from '@/hooks/use-catalog'
import { useLanguage } from '@/lib/i18n'
import type { FavoriteHotel } from '@/lib/types'

const FALLBACK =
  'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ef/Swimming_pool_and_main_building_of_Amantaka_luxury_Resort_%26_Hotel_in_Luang_Prabang_Laos.jpg/960px-Swimming_pool_and_main_building_of_Amantaka_luxury_Resort_%26_Hotel_in_Luang_Prabang_Laos.jpg'

function FavoritesContent() {
  const { t } = useLanguage()
  const { data: favorites = [], isLoading, isError } = useFavoritesQuery()
  return <main className="min-h-[85vh] bg-[#F8FAFC] px-4 py-10 sm:px-6"><div className="mx-auto max-w-6xl"><Link href="/dashboard?tab=wishlist" className="inline-flex items-center gap-2 text-sm font-semibold text-[#0F2942] hover:text-[#D4AF37]"><ArrowLeft className="h-4 w-4" /> {t('account', 'backToDashboard')}</Link><div className="mt-6"><p className="text-xs font-bold uppercase tracking-[0.2em] text-[#D4AF37]">{t('account', 'yourCollection')}</p><h1 className="mt-1 font-serif text-3xl font-bold text-[#0F2942]">{t('account', 'savedStaysTitle')}</h1><p className="mt-2 text-sm text-slate-500">{t('account', 'savedStaysSubtitle')}</p></div>{isLoading ? <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3"><Skeleton className="h-80" /><Skeleton className="h-80" /><Skeleton className="h-80" /></div> : isError ? <div className="mt-8 rounded-3xl border border-red-200 bg-red-50 p-8 text-center text-sm text-red-700">{t('account', 'loadSavedStaysError')}</div> : favorites.length === 0 ? <div className="mt-8 rounded-3xl border border-slate-200 bg-white p-14 text-center shadow-sm"><Heart className="mx-auto h-10 w-10 text-slate-300" /><h2 className="mt-3 font-serif text-xl font-bold text-[#0F2942]">{t('account', 'emptySavedStaysTitle')}</h2><p className="mt-1 text-sm text-slate-500">{t('account', 'emptySavedStaysDesc')}</p><Link href="/search" className="mt-5 inline-flex"><Button><Compass className="h-4 w-4" /> {t('account', 'exploreHotelsCta')}</Button></Link></div> : <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{favorites.map((hotel: FavoriteHotel) => <Link href={`/hotel/${hotel.id}`} key={hotel.id} className="group overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl"><div className="relative aspect-[16/10] overflow-hidden bg-slate-100"><Image src={hotel.primaryImageUrl || FALLBACK} alt={hotel.name} fill sizes="(min-width: 640px) 50vw, 100vw" className="object-cover transition duration-500 group-hover:scale-105" /> <div className="absolute right-3 top-3 rounded-full bg-white/90 p-2 text-red-500 shadow"><Heart className="h-4 w-4 fill-current" /></div></div><div className="p-5"><h2 className="font-serif text-xl font-bold text-[#0F2942] group-hover:text-[#2563EB]">{hotel.name}</h2><div className="mt-2 flex items-center gap-1 text-xs text-slate-500"><MapPin className="h-3.5 w-3.5" /> {hotel.address}, {hotel.city?.name}</div><div className="mt-4 flex items-center justify-between"><span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600"><Star className="h-3.5 w-3.5 fill-current" /> {hotel.averageRating?.toFixed(1) || t('account', 'newRating')}</span>{hotel.minPricePerNight != null && <span className="text-sm font-bold text-[#0F2942]">{t('account', 'fromPrice', { price: Number(hotel.minPricePerNight).toLocaleString() })}</span>}</div></div></Link>)}</div>}</div></main>
}

export default function FavoritesPage() { return <AuthGate><FavoritesContent /></AuthGate> }
