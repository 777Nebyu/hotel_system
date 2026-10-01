'use client'

import Link from 'next/link'
import { useState } from 'react'
import { ArrowLeft, CreditCard, FileDown, Receipt, AlertCircle } from 'lucide-react'
import AuthGate from '@/components/AuthGate'
import { Skeleton } from '@/components/ui/Skeleton'
import { Button } from '@/components/ui/Button'
import { useMyPaymentsQuery } from '@/hooks/use-payment'
import { bookingService } from '@/services/booking.service'
import { formatEthiopianBirr } from '@/lib/currency'
import { useLanguage } from '@/lib/i18n'
import type { Payment } from '@/lib/types'

function dateLabel(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value))
}

function PaymentHistoryContent() {
  const { t } = useLanguage()
  const { data, isLoading, isError, refetch } = useMyPaymentsQuery()
  const [downloading, setDownloading] = useState<string | null>(null)
  const payments = data?.data ?? []

  const downloadInvoice = async (payment: Payment) => {
    if (!payment.bookingId) return
    setDownloading(payment.bookingId)
    try {
      await bookingService.downloadInvoice(payment.bookingId)
    } finally {
      setDownloading(null)
    }
  }

  return (
    <main className="min-h-[85vh] bg-[#F8FAFC] px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <Link href="/dashboard?tab=payments" className="inline-flex items-center gap-2 text-sm font-semibold text-[#0F2942] hover:text-[#D4AF37]">
          <ArrowLeft className="h-4 w-4" /> {t('hotel', 'backToDashboard')}
        </Link>
        <div className="mt-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#D4AF37]">{t('hotel', 'accountFinance')}</p>
            <h1 className="mt-1 font-serif text-3xl font-bold text-[#0F2942]">{t('hotel', 'paymentHistoryTitle')}</h1>
            <p className="mt-2 text-sm text-slate-500">{t('hotel', 'paymentHistorySubtitle')}</p>
          </div>
          <div className="rounded-2xl bg-[#0F2942] px-5 py-3 text-white shadow-lg">
            <div className="flex items-center gap-2 text-xs text-white/70"><CreditCard className="h-4 w-4 text-[#D4AF37]" /> {t('hotel', 'paymentsLabel')}</div>
            <div className="mt-1 text-2xl font-bold">{payments.length}</div>
          </div>
        </div>

        <section className="mt-8 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          {isLoading ? (
            <div className="space-y-4 p-6"><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /></div>
          ) : isError ? (
            <div className="p-10 text-center"><AlertCircle className="mx-auto h-10 w-10 text-red-500" /><p className="mt-3 text-sm text-slate-600">{t('hotel', 'paymentHistoryError')}</p><Button className="mt-4" size="sm" onClick={() => refetch()}>{t('hotel', 'tryAgain')}</Button></div>
          ) : payments.length === 0 ? (
            <div className="p-14 text-center"><Receipt className="mx-auto h-10 w-10 text-slate-300" /><h2 className="mt-3 font-serif text-xl font-bold text-[#0F2942]">{t('hotel', 'noPaymentsTitle')}</h2><p className="mt-1 text-sm text-slate-500">{t('hotel', 'noPaymentsDescription')}</p><Link href="/search" className="mt-5 inline-flex"><Button size="sm">{t('hotel', 'exploreHotels')}</Button></Link></div>
          ) : (
            <div className="divide-y divide-slate-100">
              {payments.map((payment) => {
                const status = payment.status.toLowerCase()
                return <div key={payment.id} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                  <div className="flex min-w-0 items-start gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0F2942]/5 text-[#0F2942]"><CreditCard className="h-5 w-5" /></div><div className="min-w-0"><p className="truncate font-semibold text-[#0F2942]">{payment.booking?.hotel?.name || t('hotel', 'hotelBookingFallback')}</p><p className="mt-1 text-xs text-slate-500">{dateLabel(payment.createdAt)} · {payment.method}</p><p className="mt-1 text-xs text-slate-400">{t('hotel', 'bookingReferenceLine', { reference: payment.bookingId })}</p></div></div>
                  <div className="flex items-center justify-between gap-4 sm:justify-end"><div className="text-right"><p className="font-bold text-[#0F2942]">{formatEthiopianBirr(Number(payment.amount))}</p><span className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${status === 'succeeded' ? 'bg-emerald-50 text-emerald-700' : status === 'failed' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>{status === 'succeeded' ? t('hotel', 'statusSucceeded') : status === 'failed' ? t('hotel', 'statusFailed') : status === 'pending' ? t('hotel', 'statusPending') : payment.status}</span></div><Button size="sm" variant="outline" onClick={() => downloadInvoice(payment)} loading={downloading === payment.bookingId} disabled={!payment.bookingId}><FileDown className="h-4 w-4" /> {t('hotel', 'invoiceLabel')}</Button></div>
                </div>
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}

export default function PaymentHistoryPage() {
  return <AuthGate><PaymentHistoryContent /></AuthGate>
}
