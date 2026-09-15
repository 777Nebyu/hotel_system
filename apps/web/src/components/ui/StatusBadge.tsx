import * as React from 'react'
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  RotateCcw,
  LogIn,
  LogOut,
  RefreshCw,
} from 'lucide-react'

export type BookingStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'CHECKED_IN'
  | 'CHECKED_OUT'
  | 'CANCELLED'
  | 'REJECTED'

export type PaymentStatus =
  | 'IDLE'
  | 'VALIDATING'
  | 'PROCESSING'
  | 'AWAITING_EXTERNAL_CONFIRMATION'
  | 'PENDING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'REFUNDED'
  | 'PARTIALLY_REFUNDED'

export type RefundStatus =
  | 'REFUND_PENDING'
  | 'REFUNDED'
  | 'PARTIALLY_REFUNDED'
  | 'REFUND_FAILED'

export type AnyStatus = BookingStatus | PaymentStatus | RefundStatus | string

interface StatusBadgeProps {
  status: AnyStatus
  className?: string
  size?: 'sm' | 'md'
}

export function StatusBadge({ status, className = '', size = 'md' }: StatusBadgeProps) {
  const normalized = (status || '').toUpperCase()

  let label = normalized.replace(/_/g, ' ')
  let styles = 'bg-slate-100 text-slate-700 border-slate-200'
  let Icon = Clock

  switch (normalized) {
    // Succeeded & Confirmed
    case 'CONFIRMED':
    case 'SUCCEEDED':
      styles = 'bg-emerald-50 text-emerald-700 border-emerald-200'
      Icon = CheckCircle2
      label = normalized === 'CONFIRMED' ? 'Confirmed' : 'Paid'
      break

    case 'CHECKED_IN':
      styles = 'bg-blue-50 text-blue-700 border-blue-200'
      Icon = LogIn
      label = 'Checked In'
      break

    case 'CHECKED_OUT':
      styles = 'bg-slate-100 text-slate-700 border-slate-300'
      Icon = LogOut
      label = 'Checked Out'
      break

    // Pending / In-flight
    case 'PENDING':
    case 'VALIDATING':
      styles = 'bg-amber-50 text-amber-700 border-amber-200'
      Icon = Clock
      label = 'Pending'
      break

    case 'PROCESSING':
    case 'AWAITING_EXTERNAL_CONFIRMATION':
      styles = 'bg-sky-50 text-sky-700 border-sky-200 animate-pulse'
      Icon = RefreshCw
      label = normalized === 'PROCESSING' ? 'Processing' : 'Awaiting Payment'
      break

    // Failed / Cancelled / Rejected
    case 'CANCELLED':
      styles = 'bg-slate-100 text-slate-500 border-slate-200'
      Icon = XCircle
      label = 'Cancelled'
      break

    case 'FAILED':
    case 'REJECTED':
    case 'EXPIRED':
      styles = 'bg-red-50 text-red-700 border-red-200'
      Icon = AlertTriangle
      label = normalized === 'EXPIRED' ? 'Expired' : normalized === 'FAILED' ? 'Failed' : 'Rejected'
      break

    // Refund Semantics (Contract 2.D)
    case 'REFUND_PENDING':
      styles = 'bg-amber-50 text-amber-800 border-amber-300'
      Icon = Clock
      label = 'Refund Pending'
      break

    case 'REFUNDED':
      styles = 'bg-purple-50 text-purple-700 border-purple-200'
      Icon = RotateCcw
      label = 'Refunded'
      break

    case 'PARTIALLY_REFUNDED':
      styles = 'bg-purple-50 text-purple-700 border-purple-200'
      Icon = RotateCcw
      label = 'Partially Refunded'
      break

    case 'REFUND_FAILED':
      styles = 'bg-red-50 text-red-700 border-red-200'
      Icon = AlertTriangle
      label = 'Refund Failed'
      break

    default:
      styles = 'bg-slate-100 text-slate-700 border-slate-200'
      Icon = Clock
      label = normalized.replace(/_/g, ' ')
  }

  const sizeClass = size === 'sm' ? 'text-[11px] px-2 py-0.5 gap-1' : 'text-xs px-2.5 py-1 gap-1.5'

  return (
    <span
      className={`inline-flex items-center font-semibold rounded-full border tracking-wide uppercase ${sizeClass} ${styles} ${className}`}
    >
      <Icon className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5 shrink-0'} aria-hidden="true" />
      <span>{label}</span>
    </span>
  )
}
