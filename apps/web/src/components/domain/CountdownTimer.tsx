'use client'

import { useEffect, useState } from 'react'
import { Timer, AlertTriangle, RefreshCw } from 'lucide-react'

interface CountdownTimerProps {
  initialSeconds: number
  onExpire?: () => void
  onRefresh?: () => void
  isRefreshing?: boolean
}

export function CountdownTimer({
  initialSeconds,
  onExpire,
  onRefresh,
  isRefreshing = false,
}: CountdownTimerProps) {
  const [secondsLeft, setSecondsLeft] = useState(initialSeconds)

  useEffect(() => {
    setSecondsLeft(initialSeconds)
  }, [initialSeconds])

  useEffect(() => {
    if (secondsLeft <= 0) {
      onExpire?.()
      return
    }

    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          onExpire?.()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [secondsLeft, onExpire])

  const minutes = Math.floor(secondsLeft / 60)
  const remainingSeconds = secondsLeft % 60
  const isUrgent = secondsLeft < 120 && secondsLeft > 0
  const isExpired = secondsLeft === 0

  return (
    <div
      role="timer"
      aria-live="polite"
      className={`rounded-2xl p-4 transition-all border flex flex-col sm:flex-row items-center justify-between gap-3 ${
        isExpired
          ? 'bg-rose-50 border-rose-200 text-rose-950'
          : isUrgent
            ? 'bg-amber-50 border-amber-300 text-amber-950 animate-pulse'
            : 'bg-[#F8FAFC] border-[#D4AF37]/30 text-[#0F2942]'
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
            isExpired
              ? 'bg-rose-100 text-rose-600'
              : isUrgent
                ? 'bg-amber-100 text-amber-600'
                : 'bg-[#D4AF37]/10 text-[#D4AF37]'
          }`}
        >
          {isExpired ? (
            <AlertTriangle className="w-5 h-5" />
          ) : (
            <Timer className="w-5 h-5" />
          )}
        </div>
        <div>
          <div className="font-semibold text-sm">
            {isExpired
              ? 'Room Hold Expired'
              : isUrgent
                ? 'Hold Expiring Soon'
                : 'Room Locked for Reservation'}
          </div>
          <p className="text-xs opacity-75">
            {isExpired
              ? 'Your 15-minute room hold has lapsed. Please recheck room availability to continue.'
              : 'This room is reserved exclusively for you while you complete your details.'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        {!isExpired ? (
          <div
            className={`font-mono text-lg font-bold px-3 py-1.5 rounded-xl border ${
              isUrgent
                ? 'bg-amber-100 border-amber-300 text-amber-900'
                : 'bg-white border-[#D4AF37]/20 text-[#0F2942] shadow-sm'
            }`}
          >
            {String(minutes).padStart(2, '0')}:{String(remainingSeconds).padStart(2, '0')}
          </div>
        ) : onRefresh ? (
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            Re-check Hold
          </button>
        ) : null}
      </div>
    </div>
  )
}
