'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { Booking, Hotel } from '@/lib/types'
import { formatEthiopianBirr } from '@/lib/currency'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { bookingService } from '@/services/booking.service'
import {
  CheckCircle2,
  Copy,
  Check,
  FileDown,
  Calendar,
  MapPin,
  Bed,
  CreditCard,
  User,
  ArrowRight,
  Loader2,
} from 'lucide-react'

interface ConfirmationPanelProps {
  booking: Booking
  hotel?: Hotel | null
  roomType?: string
  paymentMethod?: string
}

function formatDate(val: string) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(`${val}T00:00:00`))
  } catch {
    return val
  }
}

export function ConfirmationPanel({
  booking,
  hotel,
  roomType,
  paymentMethod = 'CREDIT_CARD',
}: ConfirmationPanelProps) {
  const [copied, setCopied] = useState(false)

  const copyReference = () => {
    if (!booking?.id) return
    navigator.clipboard.writeText(booking.id)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const [downloading, setDownloading] = useState(false)

  const handleDownloadInvoice = async () => {
    if (!booking?.id) return
    try {
      setDownloading(true)
      await bookingService.downloadInvoice(booking.id)
    } catch {
      window.open(bookingService.getInvoiceDownloadUrl(booking.id), '_blank')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto text-center py-6 animate-in fade-in duration-500">
      {/* Animated Success Badge */}
      <div className="w-20 h-20 bg-emerald-50 border-2 border-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-500/10">
        <CheckCircle2 className="w-10 h-10 text-emerald-600" />
      </div>

      <div className="inline-block mb-3">
        <StatusBadge status={booking.status} />
      </div>

      <h1 className="font-serif text-3xl sm:text-4xl font-bold text-[#0F2942] mb-2 tracking-tight">
        Reservation Confirmed
      </h1>
      <p className="text-slate-600 text-sm max-w-md mx-auto mb-8">
        Your booking at {hotel?.name || 'LuxStay'} has been successfully registered. A confirmation summary has been saved to your account.
      </p>

      {/* Booking Reference Hero Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden text-left mb-8">
        <div className="bg-slate-900 text-white p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-0.5">
              Booking Reference
            </div>
            <div className="font-mono text-xl font-bold text-[#D4AF37] tracking-wider">
              {booking.id}
            </div>
          </div>
          <button
            type="button"
            onClick={copyReference}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors cursor-pointer w-fit"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" /> Copied Reference
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" /> Copy Reference
              </>
            )}
          </button>
        </div>

        {/* Itemized summary details */}
        <div className="p-6 space-y-4 divide-y divide-slate-100 text-sm">
          <div className="flex items-start justify-between gap-4 pt-1">
            <span className="flex items-center gap-2 text-slate-500 shrink-0">
              <MapPin className="w-4 h-4 text-[#D4AF37]" /> Hotel Property
            </span>
            <div className="text-right">
              <div className="font-semibold text-slate-900">{hotel?.name || 'Luxury Hotel'}</div>
              <div className="text-xs text-slate-500">{hotel?.address || ''}</div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 pt-4">
            <span className="flex items-center gap-2 text-slate-500 shrink-0">
              <Bed className="w-4 h-4 text-[#D4AF37]" /> Reserved Suite
            </span>
            <span className="font-medium text-slate-900 capitalize">
              {roomType ? roomType.replace(/_/g, ' ') : 'Luxury Suite'}
            </span>
          </div>

          <div className="flex items-center justify-between gap-4 pt-4">
            <span className="flex items-center gap-2 text-slate-500 shrink-0">
              <Calendar className="w-4 h-4 text-[#D4AF37]" /> Check-in Date
            </span>
            <span className="font-medium text-slate-900">{formatDate(booking.checkIn)}</span>
          </div>

          <div className="flex items-center justify-between gap-4 pt-4">
            <span className="flex items-center gap-2 text-slate-500 shrink-0">
              <Calendar className="w-4 h-4 text-[#D4AF37]" /> Check-out Date
            </span>
            <span className="font-medium text-slate-900">{formatDate(booking.checkOut)}</span>
          </div>

          <div className="flex items-center justify-between gap-4 pt-4">
            <span className="flex items-center gap-2 text-slate-500 shrink-0">
              <CreditCard className="w-4 h-4 text-[#D4AF37]" /> Payment Method
            </span>
            <span className="font-medium text-slate-900 capitalize">
              {paymentMethod.replace(/_/g, ' ')}
            </span>
          </div>

          <div className="flex items-center justify-between gap-4 pt-4">
            <span className="text-slate-900 font-semibold">Total Amount</span>
            <span className="font-serif text-xl font-bold text-[#0F2942]">
              {formatEthiopianBirr(booking.totalPrice)}
            </span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
        <button
          type="button"
          onClick={handleDownloadInvoice}
          disabled={downloading}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
        >
          {downloading ? (
            <Loader2 className="w-4 h-4 animate-spin text-[#D4AF37]" />
          ) : (
            <FileDown className="w-4 h-4 text-[#D4AF37]" />
          )}
          <span>Download PDF Invoice</span>
        </button>

        <Link
          href="/dashboard"
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#0F2942] hover:bg-[#163859] text-white text-sm font-semibold transition-colors shadow-sm"
        >
          View in My Bookings <ArrowRight className="w-4 h-4" />
        </Link>

        <Link
          href="/search"
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-semibold transition-colors"
        >
          Explore More Hotels
        </Link>
      </div>
    </div>
  )
}
